-- Run once in the Supabase SQL Editor.
-- Admin Remind notifies every rider/admin account on this store.

drop function if exists public.request_pending_order_reminder(uuid);

create or replace function public.request_pending_order_reminder(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_order public.orders%rowtype;
  v_uid uuid := auth.uid();
  v_body text;
  v_sent integer := 0;
  v_recipient uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'sent', 0, 'message', 'Sign in first.');
  end if;

  select * into v_order from public.orders where id = p_order_id;
  if not found or v_order.status <> 'pending' then
    return jsonb_build_object('ok', false, 'sent', 0, 'message', 'That order is no longer pending.');
  end if;

  if v_order.created_at > now() - interval '30 minutes' then
    return jsonb_build_object('ok', false, 'sent', 0, 'message', 'This order is not old enough for a reminder yet.');
  end if;

  if public.seller_business_id(v_uid) is distinct from v_order.seller_id then
    return jsonb_build_object('ok', false, 'sent', 0, 'message', 'Only this store can send a reminder.');
  end if;

  v_body := coalesce(v_order.customer_name, 'A customer')
    || '''s order is still pending. The status has not moved. Open it in the rider app.';

  for v_recipient in
    select distinct p.user_id
    from public.profiles p
    where public.seller_business_id(p.user_id) = v_order.seller_id
  loop
    if exists (
      select 1
      from public.notifications n
      where n.order_id = p_order_id
        and n.kind = 'pending_order_reminder'
        and n.recipient_id = v_recipient
        and n.created_at > now() - interval '30 minutes'
    ) then
      continue;
    end if;

    insert into public.notifications(recipient_id, order_id, kind, title, body, data)
    values (
      v_recipient,
      p_order_id,
      'pending_order_reminder',
      'Order still pending',
      v_body,
      jsonb_build_object(
        'orderId', p_order_id,
        'app', 'seller',
        'kind', 'pending_order_reminder',
        'customerName', v_order.customer_name
      )
    );
    v_sent := v_sent + 1;
  end loop;

  if v_sent = 0 then
    return jsonb_build_object(
      'ok', true,
      'sent', 0,
      'message', 'A reminder was already sent to the rider app in the last 30 minutes.'
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'sent', v_sent,
    'message', 'Reminder sent to the rider app.'
  );
end;
$$;

grant execute on function public.request_pending_order_reminder(uuid) to authenticated;
grant execute on function public.request_pending_order_reminder(uuid) to service_role;
