-- KO’AKE Event Photo v1.1.0
-- Run once in Supabase SQL Editor after creating a backup.

create extension if not exists pgcrypto;

create table if not exists public.event_photo_events (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) on delete set null,
  title text not null,
  slug text not null unique,
  share_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  event_date date,
  venue text,
  description text,
  status text not null default 'draft' check (status in ('draft','published','closed')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_photo_categories (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.event_photo_events(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  unique(event_id, name)
);

create table if not exists public.event_photo_price_tiers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.event_photo_events(id) on delete cascade,
  photo_count integer not null check (photo_count between 1 and 10),
  price_satang integer not null check (price_satang > 0),
  label text,
  is_active boolean not null default true,
  unique(event_id, photo_count)
);

-- Public-safe metadata only. Original ImageKit path is deliberately isolated.
create table if not exists public.event_photo_photos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.event_photo_events(id) on delete cascade,
  photo_code text not null,
  category text,
  filename text not null,
  preview_url text not null,
  width integer,
  height integer,
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  unique(event_id, photo_code)
);

create table if not exists public.event_photo_photo_assets (
  photo_id uuid primary key references public.event_photo_photos(id) on delete cascade,
  imagekit_file_id text not null,
  imagekit_original_path text not null,
  original_filename text not null,
  byte_size bigint,
  checksum_sha256 text,
  created_at timestamptz not null default now()
);

create table if not exists public.event_photo_orders (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.event_photo_events(id) on delete restrict,
  order_number text not null unique,
  public_token text not null unique default encode(gen_random_bytes(32), 'hex'),
  buyer_phone text,
  selected_count integer not null check (selected_count between 1 and 10),
  amount_satang integer not null check (amount_satang > 0),
  currency text not null default 'thb',
  order_status text not null default 'pending' check (order_status in ('pending','confirmed','cancelled','expired')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','processing','paid','failed','refunded')),
  provider_checkout_id text,
  provider_payment_id text,
  paid_at timestamptz,
  download_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_photo_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.event_photo_orders(id) on delete cascade,
  photo_id uuid not null references public.event_photo_photos(id) on delete restrict,
  unique(order_id, photo_id)
);

create table if not exists public.event_photo_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.event_photo_orders(id) on delete cascade,
  provider text not null,
  provider_event_id text not null unique,
  provider_payment_id text,
  amount_satang integer not null,
  status text not null check (status in ('processing','paid','failed','refunded')),
  raw_payload jsonb,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists event_photo_events_share_token_idx on public.event_photo_events(share_token);
create index if not exists event_photo_photos_event_idx on public.event_photo_photos(event_id, is_visible, sort_order);
create index if not exists event_photo_orders_public_token_idx on public.event_photo_orders(public_token);
create index if not exists event_photo_order_items_order_idx on public.event_photo_order_items(order_id);

create or replace function public.event_photo_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists event_photo_events_touch on public.event_photo_events;
create trigger event_photo_events_touch before update on public.event_photo_events
for each row execute function public.event_photo_touch_updated_at();

drop trigger if exists event_photo_orders_touch on public.event_photo_orders;
create trigger event_photo_orders_touch before update on public.event_photo_orders
for each row execute function public.event_photo_touch_updated_at();

-- Price schedule chosen for this project:
-- 1=50, 2=80, 3=100, 4=130, 5=150, 6=170, 7=190, 8=210, 9=230, 10=250 THB.
create or replace function public.seed_event_photo_price_tiers(p_event_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.event_photo_price_tiers(event_id, photo_count, price_satang, label)
  values
    (p_event_id,1,5000,'เริ่มต้น'),
    (p_event_id,2,8000,'ประหยัด 20฿'),
    (p_event_id,3,10000,'ขายดี'),
    (p_event_id,4,13000,'ครอบครัว'),
    (p_event_id,5,15000,'คุ้มขึ้น'),
    (p_event_id,6,17000,'เฉลี่ย 28฿'),
    (p_event_id,7,19000,'เก็บครบช่วง'),
    (p_event_id,8,21000,'คุ้มมาก'),
    (p_event_id,9,23000,'เกือบครบชุด'),
    (p_event_id,10,25000,'คุ้มสุด')
  on conflict(event_id, photo_count) do update
  set price_satang = excluded.price_satang, label = excluded.label, is_active = true;
end;
$$;

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
  select * into v_event
  from public.event_photo_events
  where share_token = p_share_token
    and status = 'published'
    and (expires_at is null or expires_at > now());
  if not found then raise exception 'EVENT_NOT_AVAILABLE'; end if;

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

-- Tables are accessed through server APIs. RLS still acts as defense in depth.
alter table public.event_photo_events enable row level security;
alter table public.event_photo_categories enable row level security;
alter table public.event_photo_price_tiers enable row level security;
alter table public.event_photo_photos enable row level security;
alter table public.event_photo_photo_assets enable row level security;
alter table public.event_photo_orders enable row level security;
alter table public.event_photo_order_items enable row level security;
alter table public.event_photo_payments enable row level security;

-- Authenticated event owner can manage public metadata through Supabase tools if needed.
create policy "event owners manage events" on public.event_photo_events
for all to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());

create policy "event owners manage categories" on public.event_photo_categories
for all to authenticated
using (exists(select 1 from public.event_photo_events e where e.id = event_id and e.created_by = auth.uid()))
with check (exists(select 1 from public.event_photo_events e where e.id = event_id and e.created_by = auth.uid()));

create policy "event owners manage tiers" on public.event_photo_price_tiers
for all to authenticated
using (exists(select 1 from public.event_photo_events e where e.id = event_id and e.created_by = auth.uid()))
with check (exists(select 1 from public.event_photo_events e where e.id = event_id and e.created_by = auth.uid()));

create policy "event owners manage photos" on public.event_photo_photos
for all to authenticated
using (exists(select 1 from public.event_photo_events e where e.id = event_id and e.created_by = auth.uid()))
with check (exists(select 1 from public.event_photo_events e where e.id = event_id and e.created_by = auth.uid()));

create policy "event owners manage assets" on public.event_photo_photo_assets
for all to authenticated
using (exists(select 1 from public.event_photo_photos p join public.event_photo_events e on e.id=p.event_id where p.id=photo_id and e.created_by=auth.uid()))
with check (exists(select 1 from public.event_photo_photos p join public.event_photo_events e on e.id=p.event_id where p.id=photo_id and e.created_by=auth.uid()));
