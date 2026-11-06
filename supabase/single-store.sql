-- One store for every approved rider and admin account.
-- Safe to run once in the Supabase SQL editor.
-- After this, online orders, products, and the rest of the station
-- belong to the first approved store owner, and every other approved
-- account reads that same store.

create or replace function public.seller_business_id(uid uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_store uuid;
begin
  if not exists (
    select 1
    from public.profiles p
    where p.user_id = uid
      and p.role = 'seller'
      and coalesce(p.seller_join_status, 'approved') = 'approved'
      and (
        p.seller_team_role is null
        or p.seller_team_role = 'owner'
        or p.seller_team_role = 'staff'
      )
  ) then
    return null;
  end if;

  select o.user_id
  into v_store
  from public.profiles o
  where o.role = 'seller'
    and o.seller_team_role = 'owner'
    and coalesce(o.seller_join_status, 'approved') = 'approved'
  order by o.created_at asc
  limit 1;

  return coalesce(v_store, uid);
end;
$$;

revoke all on function public.seller_business_id(uuid) from public;
grant execute on function public.seller_business_id(uuid) to authenticated;
grant execute on function public.seller_business_id(uuid) to service_role;

do $$
declare
  v_store uuid;
begin
  select o.user_id
  into v_store
  from public.profiles o
  where o.role = 'seller'
    and o.seller_team_role = 'owner'
    and coalesce(o.seller_join_status, 'approved') = 'approved'
  order by o.created_at asc
  limit 1;

  if v_store is null then
    select o.user_id
    into v_store
    from public.profiles o
    where o.role = 'seller'
    order by o.created_at asc
    limit 1;
  end if;

  if v_store is null then
    return;
  end if;

  update public.orders
  set seller_id = v_store
  where seller_id <> v_store
    and seller_id in (select user_id from public.profiles where role = 'seller');

  update public.products
  set seller_id = v_store
  where seller_id <> v_store
    and seller_id in (select user_id from public.profiles where role = 'seller');

  if to_regclass('public.pos_sales') is not null then
    update public.pos_sales
    set seller_id = v_store
    where seller_id <> v_store
      and seller_id in (select user_id from public.profiles where role = 'seller');
  end if;

  if to_regclass('public.business_expenses') is not null then
    update public.business_expenses
    set seller_id = v_store
    where seller_id <> v_store
      and seller_id in (select user_id from public.profiles where role = 'seller');
  end if;

  if to_regclass('public.order_loyalty_awards') is not null then
    update public.order_loyalty_awards
    set seller_id = v_store
    where seller_id <> v_store
      and seller_id in (select user_id from public.profiles where role = 'seller');
  end if;

  if to_regclass('public.loyalty_vouchers') is not null then
    update public.loyalty_vouchers
    set seller_id = v_store
    where seller_id <> v_store
      and seller_id in (select user_id from public.profiles where role = 'seller');
  end if;

  if to_regclass('public.seller_container_movements') is not null then
    update public.seller_container_movements
    set seller_id = v_store
    where seller_id <> v_store
      and seller_id in (select user_id from public.profiles where role = 'seller');
  end if;

  if to_regclass('public.seller_pos_container_movements') is not null then
    update public.seller_pos_container_movements
    set seller_id = v_store
    where seller_id <> v_store
      and seller_id in (select user_id from public.profiles where role = 'seller');
  end if;

  if to_regclass('public.ewallet_accounts') is not null then
    delete from public.ewallet_accounts extra
    using public.ewallet_accounts keep
    where extra.seller_id <> v_store
      and extra.provider = keep.provider
      and (
        keep.seller_id = v_store
        or (keep.seller_id <> v_store and keep.created_at < extra.created_at)
        or (keep.seller_id <> v_store and keep.created_at = extra.created_at and keep.id < extra.id)
      );
    update public.ewallet_accounts
    set seller_id = v_store
    where seller_id <> v_store
      and seller_id in (select user_id from public.profiles where role = 'seller');
  end if;

  if to_regclass('public.loyalty_balances') is not null then
    update public.loyalty_balances dst
    set points_balance = dst.points_balance + src.points_balance,
        updated_at = now()
    from public.loyalty_balances src
    where dst.seller_id = v_store
      and src.seller_id <> v_store
      and dst.customer_id = src.customer_id;
    delete from public.loyalty_balances src
    using public.loyalty_balances dst
    where src.seller_id <> v_store
      and src.customer_id = dst.customer_id
      and (
        dst.seller_id = v_store
        or (dst.seller_id <> v_store and dst.updated_at < src.updated_at)
        or (dst.seller_id <> v_store and dst.updated_at = src.updated_at and dst.seller_id < src.seller_id)
      );
    update public.loyalty_balances
    set seller_id = v_store
    where seller_id <> v_store
      and seller_id in (select user_id from public.profiles where role = 'seller');
  end if;

  if to_regclass('public.seller_customer_container_balance') is not null then
    update public.seller_customer_container_balance dst
    set outstanding_count = dst.outstanding_count + src.outstanding_count,
        identifier_notes = coalesce(dst.identifier_notes, src.identifier_notes),
        updated_at = now()
    from public.seller_customer_container_balance src
    where dst.seller_id = v_store
      and src.seller_id <> v_store
      and dst.customer_id = src.customer_id;
    delete from public.seller_customer_container_balance src
    using public.seller_customer_container_balance dst
    where src.seller_id <> v_store
      and src.customer_id = dst.customer_id
      and (
        dst.seller_id = v_store
        or (dst.seller_id <> v_store and dst.updated_at < src.updated_at)
        or (dst.seller_id <> v_store and dst.updated_at = src.updated_at and dst.seller_id < src.seller_id)
      );
    update public.seller_customer_container_balance
    set seller_id = v_store
    where seller_id <> v_store
      and seller_id in (select user_id from public.profiles where role = 'seller');
  end if;

  if to_regclass('public.seller_pos_container_balance') is not null then
    update public.seller_pos_container_balance dst
    set outstanding_count = dst.outstanding_count + src.outstanding_count,
        identifier_notes = coalesce(dst.identifier_notes, src.identifier_notes),
        display_name = coalesce(dst.display_name, src.display_name),
        updated_at = now()
    from public.seller_pos_container_balance src
    where dst.seller_id = v_store
      and src.seller_id <> v_store
      and dst.customer_name_key = src.customer_name_key;
    delete from public.seller_pos_container_balance src
    using public.seller_pos_container_balance dst
    where src.seller_id <> v_store
      and src.customer_name_key = dst.customer_name_key
      and (
        dst.seller_id = v_store
        or (dst.seller_id <> v_store and dst.updated_at < src.updated_at)
        or (dst.seller_id <> v_store and dst.updated_at = src.updated_at and dst.seller_id < src.seller_id)
      );
    update public.seller_pos_container_balance
    set seller_id = v_store
    where seller_id <> v_store
      and seller_id in (select user_id from public.profiles where role = 'seller');
  end if;

  if to_regclass('public.seller_hidden_customers') is not null then
    delete from public.seller_hidden_customers extra
    using public.seller_hidden_customers keep
    where extra.seller_id <> v_store
      and extra.customer_id = keep.customer_id
      and (
        keep.seller_id = v_store
        or (keep.seller_id <> v_store and keep.created_at < extra.created_at)
        or (keep.seller_id <> v_store and keep.created_at = extra.created_at and keep.seller_id < extra.seller_id)
      );
    update public.seller_hidden_customers
    set seller_id = v_store
    where seller_id <> v_store
      and seller_id in (select user_id from public.profiles where role = 'seller');
  end if;

  if to_regclass('public.seller_hidden_pos_customers') is not null then
    delete from public.seller_hidden_pos_customers extra
    using public.seller_hidden_pos_customers keep
    where extra.seller_id <> v_store
      and extra.customer_name_key = keep.customer_name_key
      and (
        keep.seller_id = v_store
        or (keep.seller_id <> v_store and keep.created_at < extra.created_at)
        or (keep.seller_id <> v_store and keep.created_at = extra.created_at and keep.seller_id < extra.seller_id)
      );
    update public.seller_hidden_pos_customers
    set seller_id = v_store
    where seller_id <> v_store
      and seller_id in (select user_id from public.profiles where role = 'seller');
  end if;

  if to_regclass('public.seller_pos_customers') is not null then
    delete from public.seller_pos_customers extra
    using public.seller_pos_customers keep
    where extra.seller_id <> v_store
      and extra.customer_name_key = keep.customer_name_key
      and (
        keep.seller_id = v_store
        or (keep.seller_id <> v_store and keep.created_at < extra.created_at)
        or (keep.seller_id <> v_store and keep.created_at = extra.created_at and keep.seller_id < extra.seller_id)
      );
    update public.seller_pos_customers
    set seller_id = v_store
    where seller_id <> v_store
      and seller_id in (select user_id from public.profiles where role = 'seller');
  end if;

  update public.profiles
  set seller_workspace_owner_id = v_store
  where role = 'seller'
    and seller_team_role = 'staff'
    and user_id <> v_store
    and seller_workspace_owner_id is distinct from v_store;

  update public.profiles
  set
    seller_team_role = 'staff',
    seller_join_status = 'approved',
    seller_workspace_owner_id = v_store
  where role = 'seller'
    and user_id <> v_store
    and coalesce(seller_join_status, 'approved') = 'approved'
    and (seller_team_role is null or seller_team_role = 'owner');

  update public.profiles
  set seller_workspace_owner_id = v_store
  where user_id = v_store
    and seller_workspace_owner_id is distinct from v_store;
end $$;

create unique index if not exists profiles_single_approved_owner_idx
on public.profiles (seller_team_role)
where role = 'seller'
  and seller_team_role = 'owner'
  and coalesce(seller_join_status, 'approved') = 'approved';

-- Every approved admin and rider receives the same new-order alert.
create or replace function public.notify_seller_new_order()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_order public.orders%rowtype;
  v_item_count int;
  v_body text;
begin
  if new.product_id is null and coalesce(new.product_name, '') ilike 'delivery%' then
    return new;
  end if;

  begin
    select * into v_order from public.orders where id = new.order_id;
    if not found then
      return new;
    end if;

    perform pg_advisory_xact_lock(hashtext(v_order.id::text));

    if exists (
      select 1
      from public.notifications n
      where n.order_id = v_order.id
        and n.kind = 'new_order'
        and n.recipient_id = v_order.seller_id
    ) then
      return new;
    end if;

    select count(*)::int
    into v_item_count
    from public.order_items oi
    where oi.order_id = new.order_id
      and oi.product_id is not null;

    v_body := coalesce(v_order.customer_name, 'Customer') || ' placed an order';
    if v_item_count > 1 then
      v_body := v_body || ' (' || v_item_count::text || ' items).';
    else
      v_body := v_body || '. ' || coalesce(new.product_name, 'Item') || ' • Qty ' || new.quantity::text;
    end if;

    insert into public.notifications(recipient_id, order_id, kind, title, body, data)
    values (
      v_order.seller_id,
      v_order.id,
      'new_order',
      'New order',
      v_body,
      jsonb_build_object(
        'orderId', v_order.id,
        'app', 'seller',
        'customerName', v_order.customer_name,
        'itemCount', v_item_count,
        'firstItem', new.product_name,
        'qty', new.quantity
      )
    )
    on conflict do nothing;

    insert into public.notifications(recipient_id, order_id, kind, title, body, data)
    select
      p.user_id,
      v_order.id,
      'new_order',
      'New order',
      v_body,
      jsonb_build_object(
        'orderId', v_order.id,
        'app', 'seller',
        'customerName', v_order.customer_name,
        'itemCount', v_item_count,
        'firstItem', new.product_name,
        'qty', new.quantity
      )
    from public.profiles p
    where p.user_id <> v_order.seller_id
      and public.seller_business_id(p.user_id) = v_order.seller_id
    on conflict do nothing;
  exception
    when others then
      raise warning 'notify_seller_new_order skipped: %', sqlerrm;
  end;

  return new;
end;
$$;

drop policy if exists "business_expenses owner read" on public.business_expenses;
create policy "business_expenses owner read"
on public.business_expenses for select
using (
  public.is_seller(auth.uid())
  and seller_id = public.seller_business_id(auth.uid())
);

drop policy if exists "business_expenses owner insert" on public.business_expenses;
create policy "business_expenses owner insert"
on public.business_expenses for insert
with check (
  public.is_seller(auth.uid())
  and seller_id = public.seller_business_id(auth.uid())
);

drop policy if exists "business_expenses owner update" on public.business_expenses;
create policy "business_expenses owner update"
on public.business_expenses for update
using (
  public.is_seller(auth.uid())
  and seller_id = public.seller_business_id(auth.uid())
)
with check (
  public.is_seller(auth.uid())
  and seller_id = public.seller_business_id(auth.uid())
);

drop policy if exists "business_expenses owner delete" on public.business_expenses;
create policy "business_expenses owner delete"
on public.business_expenses for delete
using (
  public.is_seller(auth.uid())
  and seller_id = public.seller_business_id(auth.uid())
);
