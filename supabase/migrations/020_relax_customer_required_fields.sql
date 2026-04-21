-- Allow customers to be created at Step 2 of signup without email, card, or address.
-- Email uniqueness is preserved: Postgres allows multiple NULLs under a UNIQUE constraint.
ALTER TABLE customers ALTER COLUMN email DROP NOT NULL;
