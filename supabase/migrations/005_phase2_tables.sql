-- Migration 005: Phase 2 schema additions
-- ─────────────────────────────────────────────────────────────────────────────
-- Run after 001–004. All statements use IF NOT EXISTS / ADD COLUMN IF NOT EXISTS
-- so this is safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- SHIPMENTS: shipping fee for early (sub-12-bottle) paid shipments
ALTER TABLE shipments
  ADD COLUMN IF NOT EXISTS shipping_fee_pence int DEFAULT 0;

-- CUSTOMERS: snooze offer texts until this timestamp (SNOOZE command)
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS texts_snoozed_until timestamptz;

-- SPECIAL_REQUESTS
-- Triggered when customer texts REQUEST [message]
CREATE TABLE IF NOT EXISTS special_requests (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid references customers(id),
  message      text not null,
  status       text default 'new',   -- 'new' | 'in_progress' | 'resolved'
  created_at   timestamptz default now(),
  resolved_at  timestamptz
);

-- CONCIERGE_MESSAGES
-- Triggered when customer texts QUESTION [message]. Tracks full inbound/outbound thread.
CREATE TABLE IF NOT EXISTS concierge_messages (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid references customers(id),
  direction    text not null,        -- 'inbound' | 'outbound'
  message      text not null,
  created_at   timestamptz default now()
);

-- REFUNDS
-- Tracks refunds issued from the admin panel per bottle / per order.
CREATE TABLE IF NOT EXISTS refunds (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid references orders(id),
  customer_id      uuid references customers(id),
  cellar_id        uuid references cellar(id),
  quantity         int not null,
  amount_pence     int not null,
  stripe_refund_id text,
  reason           text,
  created_at       timestamptz default now()
);

-- RLS: enable on new tables (anon key gets zero access, matching existing tables)
ALTER TABLE special_requests    ENABLE ROW LEVEL SECURITY;
ALTER TABLE concierge_messages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds             ENABLE ROW LEVEL SECURITY;
