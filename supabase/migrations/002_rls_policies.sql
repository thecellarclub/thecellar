-- Migration 002: Enable Row Level Security on all tables
-- Run this in the Supabase SQL editor.
--
-- Strategy: enable RLS with NO permissive policies.
-- This means the anon key has ZERO read/write access to any table.
-- All database access in this app uses the service role key server-side,
-- which bypasses RLS automatically — no policies needed for that path.

ALTER TABLE customers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE wines             ENABLE ROW LEVEL SECURITY;
ALTER TABLE texts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders            ENABLE ROW LEVEL SECURITY;
ALTER TABLE cellar            ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_codes ENABLE ROW LEVEL SECURITY;

-- Verify: confirm RLS is enabled on all tables.
-- Expected: rowsecurity = true for every row.
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'customers', 'wines', 'texts', 'orders',
    'cellar', 'shipments', 'verification_codes'
  )
ORDER BY tablename;
