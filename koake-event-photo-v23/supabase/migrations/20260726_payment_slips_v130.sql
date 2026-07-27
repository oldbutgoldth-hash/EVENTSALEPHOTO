-- KO’AKE Event Photo v1.3.0 — private payment slips + manual approval
-- Run after 20260724_event_photo_lifecycle_v120.sql.

alter table public.event_photo_orders
  add column if not exists payment_slip_path text,
  add column if not exists payment_slip_content_type text,
  add column if not exists payment_slip_size bigint,
  add column if not exists payment_slip_uploaded_at timestamptz,
  add column if not exists payment_reviewed_at timestamptz,
  add column if not exists payment_review_note text;

alter table public.event_photo_orders
  drop constraint if exists event_photo_orders_payment_status_check;

alter table public.event_photo_orders
  add constraint event_photo_orders_payment_status_check
  check (payment_status in ('unpaid','processing','under_review','paid','failed','rejected','refunded'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-slips',
  'payment-slips',
  false,
  6291456,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- No public storage.objects policy is created. Upload and review access is
-- granted only through short-lived signed URLs made by the server service role.
