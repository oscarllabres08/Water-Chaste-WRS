import { useMemo, useState } from 'react';

import {
  containerLabelsForCustomer,
  joinContainerIds,
  parseContainerIds,
  recordContainerReturn,
} from '../lib/containerReturn';
import { CheckBoxIcon } from './UiIcons';
import { supabase } from '../lib/supabase';

type Props = {
  customerId: string;
  customerName: string;
  outstanding: number;
  identifierNotes: string | null;
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
  onSuccess: () => void;
  onError: (message: string) => void;
};

export function ContainerReturnPanel({
  customerId,
  customerName,
  outstanding,
  identifierNotes,
  busy,
  onBusyChange,
  onSuccess,
  onError,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [modalOpen, setModalOpen] = useState(false);

  const parsedIds = useMemo(() => parseContainerIds(identifierNotes), [identifierNotes]);
  const labels = useMemo(
    () => containerLabelsForCustomer(identifierNotes, outstanding),
    [identifierNotes, outstanding]
  );
  const hasNumberedIds = parsedIds.length > 0;

  if (outstanding < 1) return <>—</>;

  function toggle(label: string) {
    if (busy) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  async function runReturn(quantity: number, labelsToReturn: string[]) {
    if (busy || quantity < 1) return;

    let containerNumbers: string | null = null;
    if (hasNumberedIds && labelsToReturn.length > 0) {
      const real = labelsToReturn.filter((l) => !l.startsWith('#'));
      if (real.length > 0) containerNumbers = joinContainerIds(real);
    }

    onBusyChange(true);
    onError('');
    try {
      const result = await recordContainerReturn(supabase, {
        customerId,
        customerName,
        quantity,
        containerNumbers,
      });

      if (!result.ok) {
        onError(result.message);
        return;
      }
      setSelected(new Set());
      setModalOpen(false);
      onSuccess();
    } finally {
      onBusyChange(false);
    }
  }

  function openModal() {
    setSelected(new Set());
    setModalOpen(true);
  }

  const selectedLabels = Array.from(selected);

  return (
    <>
      <div className="container-return">
        <span className="chip pending">{outstanding} borrowed</span>
        <button
          type="button"
          className="btn btn-primary btn-sm container-return-open"
          disabled={busy}
          onClick={openModal}
        >
          {busy ? 'Saving…' : 'Return'}
        </button>
      </div>

      {modalOpen ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => {
            if (!busy) setModalOpen(false);
          }}
        >
          <div
            className="modal-card confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="container-return-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="confirm-modal-body">
              <h2 id="container-return-title" className="confirm-modal-title">
                Return containers
              </h2>
              <p className="confirm-modal-message">
                Select which borrowed container{labels.length === 1 ? '' : 's'} to return for {customerName}.
              </p>
              <div className="container-return-picks">
                {labels.map((label) => {
                  const isOn = selected.has(label);
                  const shown = label.startsWith('#') ? `Container ${label.slice(1)}` : label;
                  return (
                    <button
                      key={label}
                      type="button"
                      className={`container-return-pick${isOn ? ' is-on' : ''}`}
                      disabled={busy}
                      onClick={() => toggle(label)}
                    >
                      <CheckBoxIcon checked={isOn} />
                      <span>{shown}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="container-return-modal-actions">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={busy || selectedLabels.length < 1}
                onClick={() => void runReturn(selectedLabels.length, selectedLabels)}
              >
                {busy ? 'Saving…' : `Return selected${selectedLabels.length > 0 ? ` (${selectedLabels.length})` : ''}`}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={busy}
                onClick={() => void runReturn(outstanding, labels)}
              >
                Return all
              </button>
              <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setModalOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
