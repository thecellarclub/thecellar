ALTER TABLE customers ADD COLUMN IF NOT EXISTS sms_awaiting text DEFAULT NULL;
-- Values: 'request' | 'question' | null
