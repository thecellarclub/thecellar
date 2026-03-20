ALTER TABLE concierge_messages ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general';
ALTER TABLE concierge_messages ADD COLUMN IF NOT EXISTS context TEXT;
