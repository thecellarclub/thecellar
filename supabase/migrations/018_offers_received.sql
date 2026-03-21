ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS offers_received INT NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION increment_offers_received(customer_id uuid)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE customers
  SET offers_received = offers_received + 1
  WHERE id = customer_id;
$$;
