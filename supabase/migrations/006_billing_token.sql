-- Migration 006: billing token for customer card update page
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS billing_token text,
  ADD COLUMN IF NOT EXISTS billing_token_expires_at timestamptz;
