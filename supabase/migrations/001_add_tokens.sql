-- Migration 001: add token columns needed by the ordering webhook
-- Run this in the Supabase SQL editor.

-- auth_token: short-lived UUID for the /authenticate?token= link (3DS flow)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS auth_token text;

-- token: short-lived UUID for the /ship?token= link (SHIP flow)
ALTER TABLE shipments
  ADD COLUMN IF NOT EXISTS token text;

-- Unique partial index so each token is only used once
CREATE UNIQUE INDEX IF NOT EXISTS orders_auth_token_idx
  ON orders (auth_token)
  WHERE auth_token IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS shipments_token_idx
  ON shipments (token)
  WHERE token IS NOT NULL;

-- Idempotency guard: one order per customer per text blast.
-- Safe to add now since there are no duplicate (customer_id, text_id) rows.
-- If this fails, check for duplicates first:
--   SELECT customer_id, text_id, count(*) FROM orders GROUP BY 1,2 HAVING count(*) > 1;
CREATE UNIQUE INDEX IF NOT EXISTS orders_customer_text_unique_idx
  ON orders (customer_id, text_id);
