-- Migration 035: Collection workflow scheduling fields
-- collection_venue, collection_date, collection_time are only populated
-- for type = 'collection' shipments. Nullable on delivery shipments.

ALTER TABLE shipments
  ADD COLUMN IF NOT EXISTS collection_venue text,
  ADD COLUMN IF NOT EXISTS collection_date  date,
  ADD COLUMN IF NOT EXISTS collection_time  time;
