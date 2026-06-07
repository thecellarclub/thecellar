-- Ensure any legacy active=false rows are deactivated before dropping the column.
UPDATE customers SET status = 'deactivated' WHERE active = false AND status != 'deactivated';

-- Drop the old boolean column — status is the single source of truth going forward.
ALTER TABLE customers DROP COLUMN IF EXISTS active;
