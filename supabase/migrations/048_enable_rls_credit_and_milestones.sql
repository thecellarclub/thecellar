-- Supabase security advisor flagged credit_ledger and milestone_awards as
-- publicly accessible (RLS disabled) — an oversight in the migrations that
-- introduced them (043, 045). Every other table already has RLS enabled with
-- no policies (deny-all to anon/authenticated; the app only ever talks to
-- Supabase via the service-role client, which bypasses RLS regardless).
-- Bringing these two in line with that same pattern. No policies needed —
-- nothing but the service role should ever touch these tables.

alter table credit_ledger enable row level security;
alter table milestone_awards enable row level security;
