-- 1. Allow partial customer rows from Step 1 (phone-only).
--    stripe_customer_id must also be nullable so legacy signup_progress rows
--    that never reached Step 2 (no Stripe customer was created) can be backfilled.
ALTER TABLE customers ALTER COLUMN dob DROP NOT NULL;
ALTER TABLE customers ALTER COLUMN first_name DROP NOT NULL;
ALTER TABLE customers ALTER COLUMN stripe_customer_id DROP NOT NULL;
-- (last_name was added nullable in 016; email is nullable since 020.)

-- 2. Welcome tracking lives on the customer row.
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS welcome_pending_at timestamptz,
  ADD COLUMN IF NOT EXISTS welcome_sent_at    timestamptz;

CREATE INDEX IF NOT EXISTS customers_welcome_pending_idx
  ON customers(welcome_pending_at)
  WHERE welcome_sent_at IS NULL AND welcome_pending_at IS NOT NULL;

-- 3. Backfill any signup_progress phones that are NOT already in customers.
--    welcome_pending_at = NULL and welcome_sent_at = now() so the new hourly
--    cron does not re-welcome legacy contacts on first deploy.
INSERT INTO customers (phone, first_name, last_name, dob, email,
                       stripe_customer_id, stripe_payment_method_id,
                       active, welcome_pending_at, welcome_sent_at)
SELECT sp.phone,
       sp.first_name,
       sp.last_name,
       sp.dob,
       sp.email,
       sp.stripe_customer_id,
       sp.stripe_payment_method_id,
       true,
       NULL,
       now()
FROM signup_progress sp
LEFT JOIN customers c ON c.phone = sp.phone
WHERE c.id IS NULL
  AND sp.phone IS NOT NULL;

-- 4. Drop the table.
DROP TABLE IF EXISTS signup_progress;
