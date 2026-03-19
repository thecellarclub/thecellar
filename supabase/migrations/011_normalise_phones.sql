-- Normalise all customer phone numbers to E.164 format (+447xxxxxxxxx)
-- Run once to fix any numbers stored in national format.

-- National format: 07xxxxxxxxx → +447xxxxxxxxx
UPDATE customers
SET phone = '+44' || substring(phone from 2)
WHERE phone ~ '^07\d{9}$';

-- Missing + prefix: 447xxxxxxxxx → +447xxxxxxxxx
UPDATE customers
SET phone = '+' || phone
WHERE phone ~ '^447\d{9}$';

-- Edge case: +440xxxxxxxxx → +447xxxxxxxxx (double-zero after country code)
UPDATE customers
SET phone = '+44' || substring(phone from 5)
WHERE phone ~ '^\+440\d{9}$';
