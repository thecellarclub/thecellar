-- Add status column, default active
ALTER TABLE customers ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
-- Backfill: existing active=false → deactivated, active=true → active
UPDATE customers SET status = 'deactivated' WHERE active = false;
UPDATE customers SET status = 'active' WHERE active = true;
-- Add check constraint
ALTER TABLE customers ADD CONSTRAINT customers_status_check
  CHECK (status IN ('active', 'dormant', 'deactivated'));
