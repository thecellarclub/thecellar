ALTER TABLE customers ADD COLUMN IF NOT EXISTS concierge_status text DEFAULT 'open';
-- Values: 'open' | 'closed'
