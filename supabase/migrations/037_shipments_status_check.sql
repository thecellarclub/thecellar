-- Migration 037: Add collection_booked to shipments status check constraint
ALTER TABLE shipments
  DROP CONSTRAINT IF EXISTS shipments_status_check;

ALTER TABLE shipments
  ADD CONSTRAINT shipments_status_check
  CHECK (status IN ('pending', 'confirmed', 'collection_booked', 'dispatched', 'delivered', 'paused'));
