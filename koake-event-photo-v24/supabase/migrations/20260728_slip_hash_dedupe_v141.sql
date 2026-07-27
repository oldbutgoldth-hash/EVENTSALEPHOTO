-- KO'AKE Event Photo v1.4.1 — free duplicate-slip detection (no external API)
-- Run after 20260727_slip_auto_verification_v140.sql. Safe on an existing database.
--
-- Stores a SHA-256 hash of every uploaded slip image. If the exact same image is
-- later uploaded against a different order, it's flagged/rejected as a reused slip
-- without needing any paid slip-verification service.

alter table public.event_photo_orders
  add column if not exists slip_file_sha256 text;

create index if not exists event_photo_orders_slip_hash_idx
  on public.event_photo_orders(slip_file_sha256) where slip_file_sha256 is not null;
