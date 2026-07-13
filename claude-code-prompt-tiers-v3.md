# Spec: Tiers v3 — reward every case: tier ladder + lifetime milestones

## Status & relationship to other specs

This **supersedes `claude-code-prompt-tiers-v2.md`** (which superseded `tiers-update`
and `tier-benefits`). Where they conflict, this document wins. Tiers-v2 was never
implemented — implement this instead.

**Credit/rebate mechanics live in `claude-code-prompt-credit-wallet.md`** (canonical,
may already be implemented — check `IMPLEMENTATION-LOG.md`). This spec defines the tier
ladder that feeds `rebatePctForTier()` and the milestone system; it does not touch
wallet mechanics.

Core design change vs v2: **every completed case earns something.** Two overlapping
systems:

- **Tiers** (Bailey / Elvet / Palatine at 2 / 4 / 6 cases) — ongoing perks, computed on
  a rolling 12-month window, soft-demoted at anniversary.
- **Milestones** (lifetime cases 1, 3, 5, 6) — one-time-ever rewards, never reset,
  never clawed back.

1 case = 12 bottles from confirmed orders (same source as the cellar).

| Cases | Reward | System |
|---|---|---|
| 1 | One-shot free shipping at 6 bottles | Milestone |
| 2 | **Bailey**: 5% rebate, £7 delivery | Tier |
| 3 | 6 Riedel glasses **or** 2 tasting tickets | Milestone |
| 4 | **Elvet**: 10% rebate, £5 delivery | Tier |
| 5 | Free bottle (Daniel's pick) **or** 2 tasting tickets | Milestone |
| 6 | **Palatine**: texts 2hrs early, unlimited concierge + **Coravin** (milestone) | Tier + milestone |

> **Naming note (unchanged from v2, still deliberate):** `bailey` is the ENTRY tier and
> `elvet` is the MID tier — swapped vs the old spend-based code. Do not "correct" this.
> `tierRank = { none: 0, bailey: 1, elvet: 2, palatine: 3 }`.

---

## 1. Tiers (rolling window, ongoing perks)

### 1a. Thresholds

Rolling 12-month window from the customer's first-purchase anniversary (same window
logic v2 described; see §4 for reset).

```typescript
export function tierFromCases(cases: number): 'none' | 'bailey' | 'elvet' | 'palatine' {
  if (cases >= 6) return 'palatine'
  if (cases >= 4) return 'elvet'
  if (cases >= 2) return 'bailey'
  return 'none'
}
```

Note: v2 had 1/3/6 — v3 is **2/4/6**.

### 1b. Ongoing perks per tier

| Perk | none | Bailey (2) | Elvet (4) | Palatine (6) |
|---|---|---|---|---|
| Rebate to credit (see credit-wallet spec) | — | 5% | 10% | 10% |
| Delivery fee (under free-shipping threshold) | £10 | £7 | £5 | £5 |
| Wine texts | 2/week | 2/week | 2/week | **2 hrs early** |
| Concierge requests (display only) | — | 2/month | 5/month | Unlimited |

- **Concierge/wine-text counts are DISPLAY ONLY** — no metering or enforcement
  (unchanged from v2). "2 hrs early" IS a real mechanic (§5).
- **Delivery fee**: wherever the £10 under-threshold fee is charged/quoted (SHIP flow,
  case-nudge copy, portal), it becomes tier-dependent: £10 / £7 / £5 / £5. Add a
  `deliveryFeePence(tier)` helper in `lib/tiers.ts` and replace hardcoded £10s in the
  wine-order shipping flow. Grep for hardcoded `£10` / `1000` fee values and update the
  copy that quotes it. (The free-shipping *threshold* logic — 12, or 6 for palatine /
  flagged customers — is unchanged.)
- **Rebate**: percentages above feed `rebatePctForTier()` (credit-wallet spec §4a). An
  order earns at the tier held **before** that order — the order that completes your
  2nd case earns 0%, the next earns 5%. Accrual ordering is specified in the credit
  spec; don't duplicate logic here.

### 1c. Tier assignment (`lib/tiers.ts`)

- Add `getRollingCases(customerId, sb)`: bottles from confirmed orders in the current
  anniversary window, integer-divided by 12. Reuse the window logic of the existing
  `getRollingSpend`.
- Replace `tierFromSpend` with `tierFromCases` (above); update
  `checkAndApplyTierUpgrade()` to use them + the rank map. Keep "only upgrade here,
  never downgrade".
- **Congrats SMS on upgrade**, reworded for v3 (Julia will polish copy — flag drafts in
  the PR/log):
  - `→ bailey`: welcome to Bailey — 5% back in credit on every order from here, cheaper
    delivery.
  - `→ elvet`: rebate doubles to 10%, £5 delivery.
  - `→ palatine`: wine texts 2hrs before everyone else — and Daniel will be in touch
    about your Coravin (the milestone row handles fulfilment, §2).
- `deliveryThreshold(tier, freeShippingAt6)` unchanged (palatine or flag → 6). The
  one-shot `free_shipping_at_6` flag and its admin toggle stay exactly as implemented
  (migration 042) — the case-1 milestone reuses them (§2b).

### 1d. Data migration — `044_tier_v3_recompute.sql`

(Verify latest migration number first — credit-wallet spec takes 043; there are
multiple 039s.)

- Full recompute of every customer's `tier` from rolling cases with the v3 thresholds
  (not a rename — meanings and thresholds both changed vs live code).
- Keep existing `tier_since` where set; set `tier_review_at` = next first-purchase
  anniversary.
- Customers with no confirmed order stay `none`.

---

## 2. Milestones (lifetime, one-time-ever)

### 2a. Schema — `045_milestone_awards.sql`

```sql
create table milestone_awards (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  milestone integer not null check (milestone in (1, 3, 5, 6)),
  reward_choice text,          -- null until chosen; see options below
  chosen_at timestamptz,
  fulfilled_at timestamptz,
  fulfilled_by uuid references admin_users(id),
  notes text,
  created_at timestamptz not null default now(),
  unique (customer_id, milestone)
);
```

The unique constraint IS the one-time-ever guarantee. Rows are never deleted on
anniversary reset — milestones ignore the rolling window entirely.

Reward options (hardcode as constants, Daniel can edit later):

| Milestone | Options for `reward_choice` |
|---|---|
| 1 | `free_ship_at_6` (no choice — auto) |
| 3 | `riedel_glasses` (6) or `tasting_tickets` (2) |
| 5 | `free_bottle` (Daniel's pick) or `tasting_tickets` (2) |
| 6 | `coravin` (no choice) |

### 2b. Detection & awarding

In `handlePostCharge` (after the cellar insert, alongside the tier-upgrade check),
compute **lifetime cases** = floor(total bottles from ALL confirmed orders / 12) — no
window. For each milestone value ≤ lifetime cases with no existing row, in ascending
order:

- Insert the `milestone_awards` row (`reward_choice` prefilled for 1 and 6, null for
  3 and 5).
- **Milestone 1** is self-fulfilling: set `customers.free_shipping_at_6 = true` (the
  existing one-shot flag — auto-consumed on next shipment per migration 042 behaviour),
  set `fulfilled_at = now()`, `fulfilled_by = null`, log `inbox_activity`
  (`free_shipping_at_6_set`, `actor_id: null`, detail: 'milestone: first case').
  SMS:
  > First case done! Your next shipment is free at just 6 bottles — a little reward
  > from us. Reply BALANCE any time to check your credit.

  If the flag is somehow already true, still create the milestone row but skip
  re-setting the flag.
- **Milestones 3 / 5**: SMS congratulating + telling them Daniel will be in touch to
  take their pick (glasses vs tickets / bottle vs tickets). `notifyAdmin()` so the team
  sees it same-day.
- **Milestone 6**: SMS congratulating (this coincides with the Palatine upgrade —
  coordinate so they get ONE combined message, not two). `notifyAdmin()`.
- Idempotent by the unique constraint — swallow unique violations as already-awarded.
- Fire-and-forget: never block order confirmation on milestone failures (log +
  continue), same principle as rebate accrual.

### 2c. Backfill at launch

Part of `045` (or a one-time script — implementer's choice, but it must be dry-runnable):

- For every customer, compute lifetime cases and insert any earned-but-missing
  `milestone_awards` rows.
- **No SMS for backfilled rows** — Julia messages these members personally. Mark
  backfilled rows with `notes = 'backfilled at v3 launch'`.
- **Milestone 1 backfill**: do NOT set `free_shipping_at_6` for customers who already
  have the flag `true` OR have ever had it granted (check `inbox_activity` for
  `free_shipping_at_6_set`) — the July 2026 engagement campaign already granted it to
  most eligible members. For those, create the milestone row already fulfilled with
  `notes = 'pre-granted via engagement campaign'`. Only set the flag for 1-case
  customers who never received it.
- **Dry-run first**: produce a report (customer, lifetime cases, which milestone rows
  would be created, whether the flag would be set) and share it with Julia before
  executing. Expected shape as of 2026-07-13: 1 customer at milestone 3 (Daniel Roe),
  none at 5 or 6, ~15 at milestone 1 (mostly pre-granted).

> **Operational note (no code):** rebate credit is NOT backfilled. After the credit
> wallet's admin grant control is live, Julia manually grants Daniel Roe £16.88
> (reason: "rebate backdate to v3 launch" — 5% of his £337.50 spend since completing
> his 2nd case). Nothing to build.

### 2d. Admin fulfilment queue

Same idea as v2's gift queue, now over `milestone_awards`: an admin list of rows
`where fulfilled_at is null`, showing customer, milestone, options, chosen reward (or
"not yet chosen"), with controls to set `reward_choice` (+ `chosen_at`) and mark
fulfilled (`fulfilled_at`, `fulfilled_by`). Simple page or a section on an existing
admin page — implementer's judgment; it just must not let earned rewards be forgotten.
Member-facing self-select in the portal is a fast-follow, not v1.

---

## 3. Portal display

Where account/tier info renders in the portal: current tier, cases this cycle +
cases-to-next-tier, and earned milestones (with fulfilled status). Credit balance
display is the credit-wallet spec's concern (may already exist).

---

## 4. Anniversary reset (soft demote) — unchanged from v2 in spirit

On each member's first-purchase anniversary (`tier_review_at`, existing tier-review
cron or equivalent):

- New cycle's rolling case count starts fresh.
- Soft-demote one rank as a floor: `palatine → elvet`, `elvet → bailey`,
  `bailey → bailey`, `none → none`.
- Ongoing perks follow the current tier. Credit balance is **never** touched.
  Milestones are **never** touched.
- Set next `tier_review_at`.
- Gentle "new year" SMS framing, not punitive; correct v3 display names and perk
  descriptions.

---

## 5. Palatine early access (2 hrs early) — unchanged from v2

When a wine campaign is sent, `tier='palatine'` recipients get it ~2 hours before
everyone else. Confirm how offers are currently sent before choosing the mechanism
(split batch with delay vs scheduler); flag if a manual/cron two-pass split is
preferable for v1.

---

## 6. Out of scope

- No metering of concierge/wine-request counts (display only).
- No member-facing milestone self-select in v1.
- No credit backfill machinery (manual grant, see §2c note).
- Rebate/wallet mechanics (credit-wallet spec owns them).

## Files (anticipated — verify against repo)

- `lib/tiers.ts` — `tierFromCases` (2/4/6), `getRollingCases`, `deliveryFeePence`,
  congrats SMS, rank map
- `supabase/migrations/044_tier_v3_recompute.sql`, `045_milestone_awards.sql` (+
  backfill; verify numbering)
- `lib/post-charge.ts` — milestone detection/awarding
- `lib/milestones.ts` (new) — constants + award logic if post-charge gets crowded
- Admin — fulfilment queue page/section
- Portal — tier + milestone display
- Offer-send path — Palatine early access
- Tier-review cron — soft demote
- SHIP flow / copy — tier-dependent delivery fee

## Verification

- 0/1/2/3/4/5/6 rolling cases → none/none/bailey/bailey/elvet/elvet/palatine.
- Completing lifetime case 1 sets the free-shipping flag + fulfilled milestone row +
  SMS; completing it again is impossible (unique).
- Lifetime cases 3/5/6 create choice rows + admin notification; queue records choice
  and fulfilment; milestone 6 coincides with ONE combined Palatine SMS.
- Anniversary: palatine with a quiet year → elvet; keeps credit and all milestone rows.
- Delivery fee quotes £10/£7/£5/£5 by tier; free-shipping threshold logic unchanged.
- Backfill dry-run matches expectations (1× milestone-3, ~15× milestone-1 mostly
  pre-granted, no flag double-grants, no SMS sent).
- Rebate: order completing case 2 earns 0%; next order earns 5% (verifies the
  before-order tier rule via the credit spec's accrual).
