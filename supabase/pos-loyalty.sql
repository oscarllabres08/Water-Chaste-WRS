-- POS loyalty points. Safe to run once in the Supabase SQL Editor.
-- Walk-in customers (no app) are stored by name. App customers get the points on their account.

create table if not exists public.pos_loyalty_balances (
  seller_id uuid not null references public.profiles(user_id) on delete cascade,
  customer_name_key text not null,
  display_name text not null,
  points_balance int not null default 0 check (points_balance >= 0),
  updated_at timestamptz not null default now(),
  primary key (seller_id, customer_name_key)
);

create table if not exists public.pos_loyalty_awards (
  pos_sale_id uuid primary key references public.pos_sales(id) on delete cascade,
  seller_id uuid not null references public.profiles(user_id) on delete cascade,
  customer_id uuid references public.profiles(user_id) on delete set null,
  customer_name_key text,
  points_awarded int not null check (points_awarded >= 0),
  created_at timestamptz not null default now()
);

alter table public.pos_loyalty_balances enable row level security;
alter table public.pos_loyalty_awards enable row level security;

drop policy if exists "pos_loyalty_balances seller read" on public.pos_loyalty_balances;
create policy "pos_loyalty_balances seller read"
on public.pos_loyalty_balances for select
using (
  public.is_seller(auth.uid())
  and seller_id = public.seller_business_id(auth.uid())
);

drop policy if exists "pos_loyalty_awards seller read" on public.pos_loyalty_awards;
create policy "pos_loyalty_awards seller read"
on public.pos_loyalty_awards for select
using (
  public.is_seller(auth.uid())
  and seller_id = public.seller_business_id(auth.uid())
);

revoke insert, update, delete on public.pos_loyalty_balances from authenticated;
revoke insert, update, delete on public.pos_loyalty_awards from authenticated;

create or replace function public.seller_award_pos_loyalty(
  p_pos_sale_id uuid,
  p_profile_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_business uuid := public.seller_business_id(auth.uid());
  v_sale public.pos_sales%rowtype;
  v_display text;
  v_key text;
  v_pts int := 0;
  v_customer uuid;
  v_match_count int := 0;
  v_balance int := 0;
  v_linked boolean := false;
begin
  if auth.uid() is null or not public.is_seller(auth.uid()) or v_business is null then
    return jsonb_build_object('ok', false, 'error', 'not_seller', 'message', 'Only the store can add loyalty points.');
  end if;
  if p_pos_sale_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing_sale', 'message', 'Missing sale.');
  end if;

  select * into v_sale
  from public.pos_sales s
  where s.id = p_pos_sale_id
    and s.seller_id = v_business;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'sale_not_found', 'message', 'That sale was not found.');
  end if;

  v_display := regexp_replace(trim(coalesce(v_sale.customer_name, '')), '\s+', ' ', 'g');
  v_key := nullif(lower(v_display), '');
  if v_key is null then
    return jsonb_build_object('ok', false, 'error', 'missing_name', 'message', 'Customer name is required to add loyalty points.');
  end if;

  if exists (select 1 from public.pos_loyalty_awards a where a.pos_sale_id = p_pos_sale_id) then
    return jsonb_build_object('ok', true, 'already_awarded', true, 'points_awarded', 0, 'message', 'Points were already added for this sale.');
  end if;

  select coalesce(sum(i.quantity), 0)::int into v_pts
  from public.pos_sale_items i
  join public.products pr on pr.id = i.product_id
  where i.pos_sale_id = p_pos_sale_id
    and pr.earn_loyalty_points = true;

  if v_pts <= 0 then
    insert into public.pos_loyalty_awards (pos_sale_id, seller_id, customer_name_key, points_awarded)
    values (p_pos_sale_id, v_business, v_key, 0);
    return jsonb_build_object(
      'ok', true,
      'points_awarded', 0,
      'points_balance', 0,
      'linked_app', false,
      'customer_name', v_display,
      'message', 'No products in this sale earn loyalty points. Mark them in Inventory.'
    );
  end if;

  if p_profile_user_id is not null then
    select p.user_id into v_customer
    from public.profiles p
    where p.user_id = p_profile_user_id
      and p.role = 'customer'
      and lower(regexp_replace(trim(coalesce(p.display_name, '')), '\s+', ' ', 'g')) = v_key;
  end if;

  if v_customer is null then
    select count(*)::int into v_match_count
    from public.profiles p
    where p.role = 'customer'
      and lower(regexp_replace(trim(coalesce(p.display_name, '')), '\s+', ' ', 'g')) = v_key;
    if v_match_count = 1 then
      select p.user_id into v_customer
      from public.profiles p
      where p.role = 'customer'
        and lower(regexp_replace(trim(coalesce(p.display_name, '')), '\s+', ' ', 'g')) = v_key
      limit 1;
    end if;
  end if;

  if v_customer is not null then
    v_linked := true;
    insert into public.loyalty_balances (customer_id, seller_id, points_balance, updated_at)
    values (v_customer, v_business, v_pts, now())
    on conflict (customer_id, seller_id) do update
    set
      points_balance = public.loyalty_balances.points_balance + v_pts,
      updated_at = now()
    returning points_balance into v_balance;

    insert into public.pos_loyalty_awards (pos_sale_id, seller_id, customer_id, customer_name_key, points_awarded)
    values (p_pos_sale_id, v_business, v_customer, v_key, v_pts);

    begin
      insert into public.notifications (recipient_id, order_id, kind, title, body, data)
      values (
        v_customer,
        null,
        'loyalty_points',
        'You earned loyalty points',
        'You earned ' || v_pts::text || ' loyalty point' || case when v_pts = 1 then '' else 's' end
          || ' from a store visit. You now have ' || v_balance::text || ' points.',
        jsonb_build_object('points', v_pts, 'points_balance', v_balance, 'app', 'customer', 'source', 'pos')
      );
    exception when others then
      null;
    end;
  else
    insert into public.pos_loyalty_balances (seller_id, customer_name_key, display_name, points_balance, updated_at)
    values (v_business, v_key, v_display, v_pts, now())
    on conflict (seller_id, customer_name_key) do update
    set
      display_name = excluded.display_name,
      points_balance = public.pos_loyalty_balances.points_balance + v_pts,
      updated_at = now()
    returning points_balance into v_balance;

    insert into public.pos_loyalty_awards (pos_sale_id, seller_id, customer_name_key, points_awarded)
    values (p_pos_sale_id, v_business, v_key, v_pts);
  end if;

  return jsonb_build_object(
    'ok', true,
    'points_awarded', v_pts,
    'points_balance', v_balance,
    'linked_app', v_linked,
    'customer_name', v_display,
    'message', case
      when v_linked then 'Points were added to the customer app account.'
      else 'Points were saved on the Loyalty page. This customer has no app account.'
    end
  );
end;
$$;

create or replace function public.seller_give_walkin_free_refill(p_customer_name_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_business uuid := public.seller_business_id(auth.uid());
  v_key text := nullif(lower(regexp_replace(trim(coalesce(p_customer_name_key, '')), '\s+', ' ', 'g')), '');
  v_left int;
  v_name text;
begin
  if auth.uid() is null or not public.is_seller(auth.uid()) or v_business is null then
    return jsonb_build_object('ok', false, 'error', 'not_seller', 'message', 'Only the store can give a free refill.');
  end if;
  if v_key is null then
    return jsonb_build_object('ok', false, 'error', 'missing_customer', 'message', 'Choose a customer.');
  end if;

  update public.pos_loyalty_balances b
  set
    points_balance = b.points_balance - 10,
    updated_at = now()
  where b.seller_id = v_business
    and b.customer_name_key = v_key
    and b.points_balance >= 10
  returning b.points_balance, b.display_name into v_left, v_name;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'error', 'insufficient_points',
      'message', 'This customer does not have 10 points yet.'
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'points_remaining', v_left,
    'customer_name', v_name
  );
end;
$$;

revoke all on function public.seller_award_pos_loyalty(uuid, uuid) from public;
grant execute on function public.seller_award_pos_loyalty(uuid, uuid) to authenticated;
grant execute on function public.seller_award_pos_loyalty(uuid, uuid) to service_role;

revoke all on function public.seller_give_walkin_free_refill(text) from public;
grant execute on function public.seller_give_walkin_free_refill(text) to authenticated;
grant execute on function public.seller_give_walkin_free_refill(text) to service_role;

do $pos_loyalty_rt$ begin
  begin alter publication supabase_realtime add table public.pos_loyalty_balances; exception when others then null; end;
end $pos_loyalty_rt$;
