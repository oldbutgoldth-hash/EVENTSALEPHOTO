-- KO'AKE Event Photo v1.4.0 — automatic slip verification (SlipOK)
-- Run after 20260727_fix_order_rpc_pgcrypto.sql. Safe on an existing database.
--
-- Stores the result of the automatic slip check (amount match + duplicate-slip
-- detection via SlipOK) so the photographer can see it next to each order
-- without opening the slip image every time.

alter table public.event_photo_orders
  add column if not exists slip_auto_check_note text,
  add column if not exists slip_trans_ref text;
