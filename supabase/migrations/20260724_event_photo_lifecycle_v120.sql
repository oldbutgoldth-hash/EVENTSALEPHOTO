-- KO’AKE Event Photo v1.2.0 — Album Lifecycle 7/30 days
-- Run after 20260724_event_photo_complete.sql.
-- Policy: sell online for 7 days, keep independent watermarked previews,
-- purge online originals after 30 days, and keep album metadata/previews visible.

alter table public.event_photo_events
  add column if not exists sale_starts_at timestamptz,
  add column if not exists sale_ends_at timestamptz,
  add column if not exists original_purge_at timestamptz,
  add column if not exists archived_at timestamptz,
  add column if not exists originals_purged_at timestamptz,
  add column if not exists contact_line_url text,
  add column if not exists contact_phone text;

-- Remove the v1.1 status constraint before translating legacy statuses.
alter table public.event_photo_events
  drop constraint if exists event_photo_events_status_check;

update public.event_photo_events
set status = case
  when status = 'published' then 'active'
  when status = 'closed' then 'expired'
  else status
end;

update public.event_photo_events
set
  sale_starts_at = coalesce(sale_starts_at, created_at),
  sale_ends_at = coalesce(sale_ends_at, expires_at, created_at + interval '7 days'),
  original_purge_at = coalesce(original_purge_at, created_at + interval '30 days'),
  expires_at = coalesce(expires_at, sale_ends_at, created_at + interval '7 days');

alter table public.event_photo_events
  alter column sale_starts_at set default now(),
  alter column status set default 'draft';

alter table public.event_photo_events
  add constraint event_photo_events_status_check
  check (status in ('draft','active','expired','reactivated','archived','purged'));

alter table public.event_photo_photo_assets
  add column if not exists preview_imagekit_file_id text,
  add column if not exists preview_imagekit_path text,
  add column if not exists preview_byte_size bigint,
  add column if not exists original_storage_status text not null default 'online',
  add column if not exists original_purged_at timestamptz,
  add column if not exists original_purge_error text;

alter table public.event_photo_photo_assets
  drop constraint if exists event_photo_photo_assets_original_storage_status_check;

alter table public.event_photo_photo_assets
  add constraint event_photo_photo_assets_original_storage_status_check
  check (original_storage_status in ('online','purging','purged','error'));

create index if not exists event_photo_events_sale_end_idx
  on public.event_photo_events(sale_ends_at, status);

create index if not exists event_photo_events_original_purge_idx
  on public.event_photo_events(original_purge_at, originals_purged_at);

create index if not exists event_photo_assets_purge_idx
  on public.event_photo_photo_assets(original_storage_status, original_purged_at);

create or replace function public.event_photo_refresh_lifecycle()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expired integer := 0;
  v_purged integer := 0;
begin
  update public.event_photo_events
  set
    status = 'expired',
    archived_at = coalesce(archived_at, now())
  where status in ('active','reactivated')
    and sale_ends_at is not null
    and sale_ends_at <= now();
  get diagnostics v_expired = row_count;

  update public.event_photo_events
  set status = 'purged'
  where status in ('expired','archived')
    and originals_purged_at is not null;
  get diagnostics v_purged = row_count;

  return jsonb_build_object('expired', v_expired, 'purged', v_purged, 'refreshedAt', now());
end;
$$;

revoke all on function public.event_photo_refresh_lifecycle() from public;
grant execute on function public.event_photo_refresh_lifecycle() to service_role;

-- Replace order creation so an expired/archived album cannot create a new order.
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

  v_order_number := 'EP-' || to_char(now() at time zone 'Asia/Bangkok', 'YYYYMMDD') || '-' || upper(substr(encode(gen_random_bytes(5), 'hex'), 1, 8));

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

revoke all on function public.create_event_photo_order(text, uuid[], text) from public;
grant execute on function public.create_event_photo_order(text, uuid[], text) to anon, authenticated, service_role;
