-- Migration 036: Courier booking fields for delivery shipments
-- courier_collection_date: when the courier is booked to collect from the bar
-- courier_collection_location: which bar ('crush' or 'norse')
-- Only populated for type = 'delivery' shipments.

ALTER TABLE shipments
  ADD COLUMN IF NOT EXISTS courier_collection_date     date,
  ADD COLUMN IF NOT EXISTS courier_collection_location text;
