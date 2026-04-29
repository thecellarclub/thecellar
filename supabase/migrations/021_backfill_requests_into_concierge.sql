-- Backfill special_requests rows into concierge_messages so the Inbox
-- can show them as thread messages. Uses category='special_request' so
-- the UI can render the badge. WHERE NOT EXISTS makes re-runs safe.
INSERT INTO concierge_messages (customer_id, direction, message, category, context, created_at)
SELECT
  sr.customer_id,
  'inbound',
  sr.message,
  'special_request',
  'Special request',
  sr.created_at
FROM special_requests sr
WHERE NOT EXISTS (
  SELECT 1 FROM concierge_messages cm
  WHERE cm.customer_id = sr.customer_id
    AND cm.message = sr.message
    AND cm.category = 'special_request'
);
