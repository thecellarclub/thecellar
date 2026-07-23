-- Tiers v3.2: the relative climb (year-two ladder mechanics).
-- The ladder becomes a position (cycle_start_rung + cases this cycle), not a
-- yearly from-zero threshold. See claude-code-prompt-tiers-v3-2-relative-climb.md.
--
-- customers.cycle_start_rung: the rung a member starts their current
-- membership year standing on (0-7). Position = cycle_start_rung + cases
-- this cycle. Default 0 makes position = cases for every year-1 member —
-- identical to today's behaviour.
--
-- customers.cycle_year: which membership year the member is currently in.
-- Increments on each anniversary soft-demote (case-nudges cron). Default 1
-- for everyone, including existing rows.
--
-- milestone_awards.cycle_year: which membership year a gift-rung award was
-- earned in. A re-passed rung in a later year gets a NEW row (that year's
-- gift), not an update to the old one. All existing rows are year-1 rows —
-- default 1 is correct for them.

alter table customers
  add column cycle_start_rung integer not null default 0,
  add column cycle_year integer not null default 1;

alter table milestone_awards
  add column cycle_year integer not null default 1;

-- Real constraint name confirmed via pg_constraint before writing this
-- (milestone_awards_customer_id_milestone_key) rather than assumed.
alter table milestone_awards drop constraint milestone_awards_customer_id_milestone_key;
alter table milestone_awards add constraint milestone_awards_customer_id_milestone_cycle_year_key
  unique (customer_id, milestone, cycle_year);

-- milestone_awards has RLS enabled with zero policies (migration 048) — the
-- app only ever talks to Supabase via the service-role client, which
-- bypasses RLS regardless. The new column needs no policy changes.
