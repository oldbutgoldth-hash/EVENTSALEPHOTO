-- KO’AKE Event Photo v1.3.1 — safe payment transitions and RPC hardening
-- Run after 20260726_payment_slips_v130.sql. Safe for an existing database.

-- The browser never needs to call order creation directly. Orders are created
-- only by the Vercel API using the service role, which prevents direct RPC spam.
revoke all on function public.create_event_photo_order(text, uuid[], text) from public, anon, authenticated;
grant execute on function public.create_event_photo_order(text, uuid[], text) to service_role;

create or replace function public.review_event_photo_payment(
  p_order_id uuid,
  p_decision text,
  p_note text default null
)
returns table(payment_status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.event_photo_orders%rowtype;
  v_next_status text;
  v_now timestamptz := now();
begin
  if p_decision not in ('approve', 'reject') then
    raise exception 'INVALID_REVIEW_DECISION';
  end if;

  select * into v_order
  from public.event_photo_orders
  where id = p_order_id
  for update;

  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.payment_status <> 'under_review' then
    raise exception 'PAYMENT_NOT_UNDER_REVIEW';
  end if;
  if v_order.payment_slip_path is null then
    raise exception 'PAYMENT_SLIP_REQUIRED';
  end if;

  if p_decision = 'approve' and exists (
    select 1
    from public.event_photo_order_items oi
    left join public.event_photo_photo_assets asset on asset.photo_id = oi.photo_id
    where oi.order_id = p_order_id
      and (
        asset.photo_id is null
        or asset.original_storage_status <> 'online'
        or asset.original_purged_at is not null
      )
  ) then
    raise exception 'ORIGINAL_NOT_AVAILABLE';
  end if;

  v_next_status := case when p_decision = 'approve' then 'paid' else 'rejected' end;

  update public.event_photo_orders
  set
    payment_status = v_next_status,
    order_status = case when p_decision = 'approve' then 'confirmed' else 'pending' end,
    paid_at = case when p_decision = 'approve' then v_now else null end,
    download_expires_at = case when p_decision = 'approve' then v_now + interval '7 days' else null end,
    payment_reviewed_at = v_now,
    payment_review_note = nullif(trim(p_note), '')
  where id = p_order_id;

  return query select v_next_status;
end;
$$;

revoke all on function public.review_event_photo_payment(uuid, text, text) from public, anon, authenticated;
grant execute on function public.review_event_photo_payment(uuid, text, text) to service_role;
