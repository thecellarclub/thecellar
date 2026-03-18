-- Migration 004: Formalise shipment status values
-- ─────────────────────────────────────────────────────────────────────────────
-- The status column was created as plain text with no CHECK constraint.
-- This migration adds a constraint documenting all valid values:
--
--   pending    → shipment created, awaiting customer address
--   confirmed  → customer submitted address, ready for dispatch
--   paused     → customer paused shipment (Phase 2 PAUSE command)
--   dispatched → admin marked as dispatched (tracking number entered)
--   delivered  → admin marked as delivered
--
-- Safe to run on an empty table or a live table — uses DO $$ to skip
-- if the constraint already exists.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint
    WHERE  conname    = 'shipments_status_check'
      AND  conrelid   = 'shipments'::regclass
  ) THEN
    ALTER TABLE shipments
      ADD CONSTRAINT shipments_status_check
      CHECK (status IN ('pending', 'confirmed', 'paused', 'dispatched', 'delivered'));
  END IF;
END $$;
