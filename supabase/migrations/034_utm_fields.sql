-- Migration 034: UTM attribution fields on customers
-- Captured from URL query params when the customer first enters their phone number.

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS utm_source   text,
  ADD COLUMN IF NOT EXISTS utm_medium   text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS utm_term     text,
  ADD COLUMN IF NOT EXISTS utm_content  text;
