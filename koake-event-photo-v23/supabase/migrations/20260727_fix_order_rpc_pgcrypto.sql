-- KO'AKE Event Photo v1.3.10 hotfix
-- Run after 20260726_event_photo_hardening_v131.sql. Safe to run on an existing database.
--
-- Problem: create_event_photo_order() is SECURITY DEFINER with `set search_path = public`.
-- On Supabase projects where the pgcrypto extension was installed into the `extensions`
-- schema (Supabase's default location for new extensions), gen_random_bytes() is not
-- visible inside this function even though pgcrypto is enabled. Buying a photo then
-- fails with: function gen_random_bytes(integer) does not exist.
--
-- Fix: stop depending on pgcrypto inside this function and its related column default.
-- Use gen_random_uuid(), which ships in Postgres core (pg_catalog) and is always
-- visible regardless of which schema extensions are installed into.

alter table public.event_photo_orders
  alter column public_token
  set default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''));

create or replace function public.create_event_photo_order(
  p_share_token text,
  p_photo_ids uuid[],
  p_buyer_phone text default null
)
returns table(order_id uuid, order_number text, public_token text, amount_satang integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.event_photo_events%rowtype;
  v_tier public.event_photo_price_tiers%rowtype;
  v_count integer;
  v_order_id uuid;
  v_order_number text;
begin
  perform public.event_photo_refresh_lifecycle();

  select * into v_event
  from public.event_photo_events
  where share_token = p_share_token
    and status in ('active','reactivated')
    and (sale_starts_at is null or sale_starts_at <= now())
    and (sale_ends_at is null or sale_ends_at > now());
  if not found then raise exception 'EVENT_SALE_CLOSED'; end if;

  select count(distinct photo_id) into v_count from unnest(p_photo_ids) as photo_id;
  if v_count < 1 or v_count > 10 then raise exception 'PHOTO_COUNT_OUT_OF_RANGE'; end if;

  select * into v_tier
  from public.event_photo_price_tiers
  where event_id = v_event.id and photo_count = v_count and is_active = true;
  if not found then raise exception 'PRICE_TIER_NOT_AVAILABLE'; end if;

  if exists (
    select 1
    from unnest(p_photo_ids) selected_id
    left join public.event_photo_photos p
      on p.id = selected_id and p.event_id = v_event.id and p.is_visible = true
    where p.id is null
  ) then raise exception 'INVALID_PHOTO_SELECTION'; end if;

  v_order_number := 'EP-' || to_char(now() at time zone 'Asia/Bangkok', 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.event_photo_orders(event_id, order_number, buyer_phone, selected_count, amount_satang)
  values(v_event.id, v_order_number, nullif(trim(p_buyer_phone), ''), v_count, v_tier.price_satang)
  returning id into v_order_id;

  insert into public.event_photo_order_items(order_id, photo_id)
  select distinct v_order_id, selected_id from unnest(p_photo_ids) selected_id;

  return query
  select o.id, o.order_number, o.public_token, o.amount_satang
  from public.event_photo_orders o where o.id = v_order_id;
end;
$$;

revoke all on function public.create_event_photo_order(text, uuid[], text) from public, anon, authenticated;
grant execute on function public.create_event_photo_order(text, uuid[], text) to service_role;
