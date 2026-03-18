-- Migration 003: Add is_active flag to texts table
-- Run this in the Supabase SQL editor.
--
-- Replaces the "ORDER BY sent_at DESC LIMIT 1" approach in the inbound webhook
-- with an explicit is_active = true flag. Only one row can be the active offer
-- at any time. When a new blast is sent, the send endpoint sets the new row
-- to is_active = true and all others to is_active = false.

ALTER TABLE texts
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT false;

-- Partial unique index: at most one row can have is_active = true at a time.
-- This enforces the invariant at the database level.
CREATE UNIQUE INDEX IF NOT EXISTS texts_one_active_offer_idx
  ON texts (is_active)
  WHERE is_active = true;

-- Back-fill: if there are existing rows, mark the most recent one as active.
-- Safe to run even if the table is empty.
UPDATE texts
SET is_active = true
WHERE id = (
  SELECT id FROM texts ORDER BY sent_at DESC LIMIT 1
);
