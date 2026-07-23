# Spec: Tiers v3.2 — the relative climb (year-two ladder mechanics)

## Context

Delta on the **implemented** tiers-v3/v3.1 system (see IMPLEMENTATION-LOG entries
2026-07-13 and 2026-07-22). Julia has redefined how the ladder behaves across
membership years. Nothing here is urgent-live-risk: the first anniversaries land
~March 2027 and there are currently zero palatine and two bailey members — but the
portal Club view (`claude-code-prompt-portal-club-progress.md`) renders this model,
so **implement this before or together with that spec**.

**The confirmed model — the ladder is a position, not yearly thresholds:**

- A member's ladder position = their **cycle start rung** + **cases this cycle**.
  Every completed case moves them exactly one rung.
- At each anniversary they don't restart from zero: they resume **one tier-rung
  below where they finished**, and rungs above that deselect.
- Gift rungs passed again in a later year award **that year's gift** — a different
  gift each year (Julia will name year-2+ gifts later); nobody ever receives the
  same gift twice.
- Tier is derived from position: a member who finished year one as Palatine starts
  year two at rung 4 (Elvet) and regains Palatine after **2** cases, not 6.

Year-one members are unaffected: start rung 0 makes position = cases, identical to
today's behaviour.

## 1. Schema — migration `051_relative_climb.sql`

Latest applied migration is `050_security_advisor_fixes.sql` — verify with
`ls supabase/migrations/` before numbering.

- `customers`: add `cycle_start_rung integer not null default 0` and
  `cycle_year integer not null default 1`.
- `milestone_awards`: add `cycle_year integer not null default 1`; drop
  `unique (customer_id, milestone)` (look up the real constraint/index name in
  `pg_constraint`/`pg_indexes`) and create
  `unique (customer_id, milestone, cycle_year)`. Per-(rung, year) uniqueness is the
  new idempotency guarantee. All existing rows are year-1 rows — the default is
  correct for them.
- `milestone_awards` has RLS enabled (migration 048) — confirm the new column
  doesn't need policy changes (service-role access only; it shouldn't).

## 2. Position & tier (`lib/tiers.ts`)

- Add `rungOfTier(tier)`: none → 0, bailey → 2, elvet → 4, palatine → 6. Add
  `tierFromRung(rung)`: ≥6 palatine, ≥4 elvet, ≥2 bailey, else none.
- Position = `customers.cycle_start_rung + getRollingCases(...)` (cases since
  `tier_since`, unchanged). Expose a `getLadderPosition(customerId, sb)` helper so
  the portal spec and tier logic share one definition.
- `checkAndApplyTierUpgrade`: compare `tierFromRung(position)` against the current
  tier instead of `tierFromCases(cases)`. Still upgrade-only mid-cycle; still
  anchors `tier_since`/`tier_review_at` only on the first-ever upgrade (per the v3
  implementation decision). Keep `tierFromCases` only if something else still uses
  it; otherwise remove it.
- `rebatePctForTier`, `deliveryFeePence`, `deliveryThreshold` unchanged — perks
  still follow the tier string; only how the tier is reached changes.

## 3. Anniversary reset (case-nudges cron, tier-review section)

Replace the current unconditional one-rank demote with:

- `cycle_start_rung = rungOfTier(one rank below current tier)` — palatine → 4,
  elvet → 2, bailey → 2 (bailey floor is never stripped), none → 0.
- `tier = tierFromRung(cycle_start_rung)` (same resulting tier as today's demote).
- `cycle_year = cycle_year + 1`; reset the cycle as today
  (`tier_since = now`, `tier_review_at = +1 year`).
- Demote SMS: reword to resume-point framing, e.g. Palatine → "You're starting your
  new Club year at Elvet — two cases puts you back on top." (Julia will polish;
  keep the two-cases fact accurate per tier.)

## 4. Milestones re-keyed to rungs passed (`lib/milestones.ts`)

- `awardMilestones` changes from lifetime-cases detection to **rungs passed this
  cycle**: award gift rungs in `(cycle_start_rung, position]` ∩ `{1, 3, 5, 7}`
  that have no `milestone_awards` row for `(customer_id, rung, cycle_year)`.
  Idempotent via the new unique constraint (keep swallowing unique-violations).
- **Gift catalogue becomes per-year**: restructure the exported constants
  (`MILESTONE_OPTIONS`, `AUTO_REWARD`, `REWARD_LABELS`, SMS copy) to be keyed by
  `(rung, cycle_year)`. **Year 1 = exactly the current live values — zero
  behavioural change for year-1 members.** Year 2+ entries are deliberately absent:
  if a member passes a gift rung and the catalogue has no entry for their cycle
  year, create NO award row, `notifyAdmin` ("no gift defined for rung R, year Y —
  define it in lib/milestones.ts"), and send no member SMS. Adding a year must be a
  data edit, not a logic change.
- A member's floor means re-passed rungs are always above it: a year-two
  Elvet-floor member passes 5 and 7 only; only floor-0 members can ever re-pass
  rung 1. No special-casing needed beyond the range logic.
- `getLifetimeCases` is no longer the milestone driver — remove it if nothing else
  uses it (grep first).
- Consumers of the constants (admin `/admin/milestones` page + PATCH route
  validation, portal) must pass/receive the member's `cycle_year` so options and
  labels resolve per year. The admin queue should show the cycle year on each row.
- `scripts/backfill-milestones.ts`: update to the new keying (all its rows are
  year 1); it remains a no-op if rerun.

## 5. /club page copy (one paragraph)

Replace the "How the year works" paragraph on `app/club/page.tsx` (§7 of the
club-page spec) with:

> "Your climb runs over your membership year — twelve months from your first order,
> the day you began your first case. When your anniversary comes round, you step
> back to the tier below where you finished — Palatine begins the new year as
> Elvet, Elvet as Bailey, and Bailey is yours for good — then climb on from there:
> every case still moves you up one rung. Your credit and your gifts are untouched.
> Order like you did last year and you'll be back where you were, collecting the
> new rewards we put on the ladder each year."

Don't describe the year as "starting from zero" anywhere.

## Out of scope

- Year-2+ gift contents (Julia defines before March 2027; the catalogue structure
  just has to be ready).
- No changes to credit mechanics, rebate rates, delivery fees, or the
  `free_shipping_at_6` flag.
- Ladder rungs beyond 7: position past 7 awards/changes nothing (future data edit).
- The portal Club view itself (its own spec; consumes `getLadderPosition`,
  `cycle_start_rung`, `cycle_year`, and the per-year catalogue from here).

## Files (anticipated — verify)

- `supabase/migrations/051_relative_climb.sql`
- `lib/tiers.ts` — `rungOfTier`, `tierFromRung`, `getLadderPosition`, upgrade check
- `lib/milestones.ts` — rung-range detection, per-year catalogue
- Case-nudges cron tier-review section — reset semantics + demote SMS
- `app/admin/(protected)/milestones/page.tsx` + `app/api/admin/milestones/[id]` —
  cycle-year-aware options/labels/validation
- `app/portal/dashboard/DashboardClient.tsx` — only if it consumes changed
  constants (full portal rework is the separate spec)
- `app/club/page.tsx` — §5 paragraph
- `scripts/backfill-milestones.ts`

## Verification

- Year-1 member (start rung 0): position = cases; tier and milestone behaviour
  byte-identical to today for cases 1–7 (regression-check against current tests /
  the tiers-v3-1 verification list).
- Simulated anniversary for a rung-6 finisher: `cycle_start_rung 4`, tier elvet,
  `cycle_year 2`. Next case → position 5: no year-2 catalogue entry → no award row,
  `notifyAdmin` fired, no member SMS. Second case → position 6 → Palatine congrats.
- Unique constraint allows (customer, 5, 2) alongside (customer, 5, 1); replaying
  the same award is still swallowed.
- Bailey-floor member's year-2 first case lands on rung 3 (not rung 1); floor-0
  member can re-earn rung 1.
- Existing 18 milestone rows read back as cycle_year 1; backfill script rerun is a
  no-op.
- Demote SMS states the correct number of cases back to the prior tier (2).
- /club paragraph replaced; grep the page for "starts fresh" / "from zero".
