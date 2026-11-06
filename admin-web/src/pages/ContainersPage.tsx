import { useCallback, useEffect, useMemo, useState } from 'react';

import { ModulePageHeader } from '../components/ModulePageHeader';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';

type ContainerRow = {
  id: string;
  code: string;
  customer: string;
  status: 'borrowed' | 'returned';
  when: string;
};

type BalanceRow = {
  key: string;
  customer: string;
  count: number;
  notes: string | null;
};

export function ContainersPage() {
  const { businessId } = useAuth();
  const [rows, setRows] = useState<ContainerRow[]>([]);
  const [balances, setBalances] = useState<BalanceRow[]>([]);
  const [filter, setFilter] = useState<'all' | 'borrowed' | 'returned'>('all');
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!businessId) return;
    setError(null);
    const [onlineMoves, posMoves, onlineBal, posBal, profiles] = await Promise.all([
      supabase
        .from('seller_container_movements')
        .select('id,customer_id,movement_type,quantity,container_numbers,created_at')
        .eq('seller_id', businessId)
        .order('created_at', { ascending: false })
        .limit(200),
      supabase
        .from('seller_pos_container_movements')
        .select('id,customer_name_key,movement_type,quantity,container_numbers,created_at')
        .eq('seller_id', businessId)
        .order('created_at', { ascending: false })
        .limit(200),
      supabase
        .from('seller_customer_container_balance')
        .select('customer_id,outstanding_count,identifier_notes')
        .eq('seller_id', businessId)
        .gt('outstanding_count', 0),
      supabase
        .from('seller_pos_container_balance')
        .select('customer_name_key,display_name,outstanding_count,identifier_notes')
        .eq('seller_id', businessId)
        .gt('outstanding_count', 0),
      supabase.from('profiles').select('user_id,display_name').eq('role', 'customer'),
    ]);

    const failed = [onlineMoves.error, posMoves.error, onlineBal.error, posBal.error].find(Boolean);
    if (failed) {
      setError(failed.message);
      return;
    }

    const names = new Map<string, string>();
    for (const profile of profiles.data ?? []) {
      const row = profile as { user_id: string; display_name: string | null };
      names.set(row.user_id, row.display_name?.trim() || 'Customer');
    }

    const nextRows: ContainerRow[] = [];
    for (const move of onlineMoves.data ?? []) {
      const row = move as {
        id: string;
        customer_id: string;
        movement_type: string;
        quantity: number;
        container_numbers: string | null;
        created_at: string;
      };
      const codes = (row.container_numbers ?? '')
        .split(/[,|\n]/)
        .map((code) => code.trim())
        .filter(Boolean);
      const label = codes.length > 0 ? codes : [`${row.quantity} container${row.quantity === 1 ? '' : 's'}`];
      label.forEach((code, index) => {
        nextRows.push({
          id: `${row.id}-${index}`,
          code,
          customer: names.get(row.customer_id) ?? 'Customer',
          status: row.movement_type === 'return' ? 'returned' : 'borrowed',
          when: row.created_at,
        });
      });
    }
    for (const move of posMoves.data ?? []) {
      const row = move as {
        id: string;
        customer_name_key: string;
        movement_type: string;
        quantity: number;
        container_numbers: string | null;
        created_at: string;
      };
      const codes = (row.container_numbers ?? '')
        .split(/[,|\n]/)
        .map((code) => code.trim())
        .filter(Boolean);
      const label = codes.length > 0 ? codes : [`${row.quantity} container${row.quantity === 1 ? '' : 's'}`];
      label.forEach((code, index) => {
        nextRows.push({
          id: `pos-${row.id}-${index}`,
          code,
          customer: row.customer_name_key,
          status: row.movement_type === 'return' ? 'returned' : 'borrowed',
          when: row.created_at,
        });
      });
    }

    const nextBalances: BalanceRow[] = [
      ...((onlineBal.data ?? []) as { customer_id: string; outstanding_count: number; identifier_notes: string | null }[]).map(
        (row) => ({
          key: row.customer_id,
          customer: names.get(row.customer_id) ?? 'Customer',
          count: row.outstanding_count,
          notes: row.identifier_notes,
        })
      ),
      ...((posBal.data ?? []) as {
        customer_name_key: string;
        display_name: string | null;
        outstanding_count: number;
        identifier_notes: string | null;
      }[]).map((row) => ({
        key: row.customer_name_key,
        customer: row.display_name?.trim() || row.customer_name_key,
        count: row.outstanding_count,
        notes: row.identifier_notes,
      })),
    ];

    setRows(nextRows);
    setBalances(nextBalances);
  }, [businessId]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter !== 'all' && row.status !== filter) return false;
      if (!q) return true;
      return row.code.toLowerCase().includes(q) || row.customer.toLowerCase().includes(q);
    });
  }, [filter, query, rows]);

  const borrowedCount = balances.reduce((sum, row) => sum + row.count, 0);

  return (
    <div className="containers-page">
      <ModulePageHeader
        title="Containers"
        subtitle="Borrowed and returned container codes from POS and customer orders."
      />

      <section className="card station-panel">
        <div className="station-panel-head">
          <h2>All containers</h2>
          <span className="muted-block">
            {borrowedCount} still out · {balances.length} customer{balances.length === 1 ? '' : 's'}
          </span>
        </div>
        {error ? <p className="error-text">{error}</p> : null}
        <div className="containers-toolbar">
          {(['all', 'borrowed', 'returned'] as const).map((key) => (
            <button
              key={key}
              type="button"
              className={`containers-filter${filter === key ? ' active' : ''}`}
              onClick={() => setFilter(key)}
            >
              {key === 'all' ? 'All' : key === 'borrowed' ? 'Borrowed' : 'Returned'}
            </button>
          ))}
          <input
            className="containers-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search code or customer"
          />
        </div>

        {balances.length > 0 ? (
          <ul className="station-tx-list containers-balance-list">
            {balances.map((row) => (
              <li key={row.key}>
                <div>
                  <strong>{row.customer}</strong>
                  <small>{row.notes?.trim() || 'No code notes'}</small>
                </div>
                <span className="sales-pill unpaid">{row.count} borrowed</span>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Customer</th>
                <th>Status</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={4}>No container records yet. Codes are saved when a borrow or return is recorded at POS.</td>
                </tr>
              ) : (
                visible.map((row) => (
                  <tr key={row.id}>
                    <td>{row.code}</td>
                    <td>{row.customer}</td>
                    <td>
                      <span className={`sales-pill ${row.status === 'returned' ? 'paid' : 'unpaid'}`}>
                        {row.status === 'returned' ? 'Returned' : 'Borrowed'}
                      </span>
                    </td>
                    <td>{new Date(row.when).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
