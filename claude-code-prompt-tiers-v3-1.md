# Spec: Tiers v3.1 — ladder reshuffle (Elvet 7%, milestone swap, Coravin at 7, Palatine free shipping)

## Context

Delta on the implemented tiers-v3 system (`claude-code-prompt-tiers-v3.md`,
implemented 2026-07-13 — see IMPLEMENTATION-LOG). Julia has revised the ladder. This
spec changes **logic and copy**; the companion `claude-code-prompt-club-page-v3.md`
(still unimplemented) has been updated separately with matching page copy —
implement both together if picking up both.

**The new ladder (canonical — supersedes the tables in tiers-v3):**

| Case | Reward | System |
|---|---|---|
| 1 | Free-shipping voucher — next shipment free at just 6 bottles | Milestone |
| 2 | **Bailey** — 5% back as credit, under-case delivery £7 | Tier |
| 3 | Free bottle chosen by Daniel, **or** 2 tasting-event tickets | Milestone |
| 4 | **Elvet** — **7%** back as credit, under-case delivery £5 | Tier |
| 5 | Six Riedel glasses, **or** 2 tasting-event tickets | Milestone |
| 6 | **Palatine** — **10%** back as credit, texts 2 hrs early, **free shipping on any amount, anytime** | Tier |
| 7 | **Coravin Timeless** — try your wine without pulling the cork | Milestone |

Diffs vs implemented v3: Elvet rebate 10% → **7%**; milestones 3 and 5 **swap**
(free bottle now at 3, Riedel at 5); Coravin moves from milestone 6 to a **new
milestone 7**; Palatine's shipping perk upgrades from "free at 6 bottles" to
**free on any amount, anytime**.

**Live-data facts (verified against production 2026-07-22):** `milestone_awards`
contains only milestone-1 rows (17) and ONE milestone-3 row (Daniel Roe, no
`reward_choice` yet, unfulfilled). Zero rows at 5 or 6. So: no data migration for
the 3/5 swap (Daniel simply gets offered the new options — bottle or tickets, which
is what he'd have anyway under the new ladder), and nothing blocks moving 6 → 7.

---

## 1. Rebate: Elvet 10% → 7%

`lib/tiers.ts` → `rebatePctForTier()`: `bailey 0.05`, `elvet 0.07`, `palatine 0.10`.

- The earn-at-tier-held-before-the-order rule (credit-wallet spec) is unchanged.
- Forward-only: no recalculation of any existing `credit_ledger` rows, whether or not
  `CREDIT_REBATE_ENABLED` is on (last known state: still off).
- Grep for any user-facing "10%" tied to Elvet (portal tier display, congrats SMS —
  the Elvet congrats currently says the rebate "doubles"; reword to "7%") and fix.

## 2. Milestones 3 and 5 swap rewards

New option sets (reward_choice values unchanged as strings, just reassigned):

- Milestone 3: `free_bottle` **or** `tasting_tickets`
- Milestone 5: `riedel_glasses` **or** `tasting_tickets`

The v3 implementation left these option lists in three uncentralised places
(logged gotcha): `VALID_CHOICES` in `PATCH /api/admin/milestones/[id]`,
`MILESTONE_OPTIONS`/`REWARD_LABELS` in the `/admin/milestones` page, and the portal
`MilestonesList`. **Centralise now** — a single exported constant in
`lib/milestones.ts` consumed by all three — since this is the second time the menu
has changed. Update milestone 3/5 SMS wording to match ("a free bottle Daniel picks
for you, or two tickets…" / "six Riedel glasses, or two tickets…").

No data migration: the only existing milestone-3 row has no choice recorded.

## 3. Coravin moves to milestone 7

### Migration `047_milestone_seven.sql` (verify latest number first)

- Replace the `milestone in (1, 3, 5, 6)` CHECK constraint with
  `milestone in (1, 3, 5, 7)`. Look up the actual constraint name in `pg_constraint`
  rather than guessing it.
- Guard: raise if any `milestone = 6` rows exist (there are none as of 2026-07-22,
  but fail loudly rather than silently reshaping data if that's changed by
  apply-time).

### `lib/milestones.ts`

- Milestone set becomes `{1, 3, 5, 7}`. Milestone 7 = `coravin`, prefilled
  `reward_choice`, goes to the fulfilment queue, `notifyAdmin`, SMS:
  > Seven cases. Your Coravin Timeless is on its way — Daniel will be in touch.
  > Thank you for being one of our very best members.
  (Julia may polish; keep meaning.)
- **Remove the milestone-6 special case**: v3 suppressed the milestone SMS when the
  same post-charge call also upgraded the customer to Palatine, sending one combined
  message. Milestone 7 no longer coincides with the Palatine upgrade, so this
  coupling goes away entirely — Palatine congrats and Coravin award are now separate
  events a case apart.
- Update the Palatine congrats SMS in `lib/tiers.ts`: drop the Coravin mention;
  lead with 10% credit back, texts 2 hrs early, and free shipping anytime (§4). Can
  tease "one case from your Coravin" if it reads well.
- Update `scripts/backfill-milestones.ts`'s milestone set to match (nobody is at 7;
  the change just keeps the script correct if rerun).

## 4. Palatine: free shipping on any amount, anytime

Old perk: delivery threshold 6 (case auto-completes/ships free at 6 bottles).
New perk: **Palatine never pays delivery, at any bottle count** — and no forced
early case-split.

- `deliveryFeePence('palatine')` → **0** (others unchanged: £10 / £7 Bailey /
  £5 Elvet).
- `deliveryThreshold`: palatine reverts to **12** — a case is a case; palatine
  members are no longer auto-completed at 6. The `free_shipping_at_6` one-shot flag
  still drops anyone (including palatine) to 6, unchanged.
- Everywhere the under-case delivery fee is charged or quoted — `handleShip` /
  `handleShipConfirm` in the Twilio webhook, the case-nudges cron's auto-ship charge
  and nudge SMS, and any fee copy — a palatine customer is charged **£0**. Where the
  fee is £0, **skip the Stripe PaymentIntent entirely** (Stripe rejects zero-amount
  charges; mirror how the credit-wallet full-credit path skips the PI) and word the
  SMS accordingly ("Free shipping — one of the perks.").
- Behaviour-change note: pre-recompute there are zero palatine customers, so this
  changes nothing live today; it matters once migration 044 runs.

## 5. Copy sweep

Grep-and-fix every user-facing description of the ladder against the canonical table
above: portal (`TierProgress`, `MilestonesList`, tier descriptions), congrats/demote
SMS in `lib/tiers.ts`, milestone SMS in `lib/milestones.ts`, the STATUS keyword reply
if it mentions perks, and the generic delivery-fee FAQ line on `app/page.tsx`
(still accurate — "less for members on higher tiers" — but verify). The `/club` page
copy is owned by `claude-code-prompt-club-page-v3.md` (already updated to this
ladder).

## Out of scope

- No changes to credit-wallet mechanics, BALANCE/CARD flow, or `apply_credit()`.
- No retroactive ledger adjustments for the Elvet rate change.
- Migration 044 (tier recompute) go-live remains a separate, Julia-gated decision —
  unchanged by this spec.

## Files (anticipated — verify)

- `lib/tiers.ts` — `rebatePctForTier` (elvet 0.07), `deliveryFeePence` (palatine 0),
  `deliveryThreshold` (palatine 12), congrats SMS copy
- `lib/milestones.ts` — set {1,3,5,7}, swapped options, centralised constants,
  milestone-7 handling, removal of the combined-SMS special case
- `supabase/migrations/047_milestone_seven.sql`
- `app/api/admin/milestones/[id]` PATCH, `/admin/milestones` page, portal
  `MilestonesList` — consume centralised constants
- Twilio webhook SHIP flows + case-nudges cron — £0 palatine fee, no zero-amount PI
- `scripts/backfill-milestones.ts` — milestone set

## Verification

- Elvet order accrues 7% (when `CREDIT_REBATE_ENABLED` on); bailey 5%, palatine 10%;
  existing ledger rows untouched.
- Milestone 3 offers bottle/tickets, 5 offers Riedel/tickets — consistently in admin
  queue, portal, and PATCH validation (single source).
- Constraint migration applied; a 7th lifetime case creates a coravin row + SMS +
  admin notification; case 6 produces ONLY the Palatine congrats (no Coravin
  mention, no milestone row).
- Palatine SHIP at 3 bottles: £0 charged, no Stripe PI created, correct SMS; Bailey
  same scenario still charged £7. Palatine case completes at 12, not 6;
  `free_shipping_at_6` flag still gives a 6-bottle free shipment to anyone.
- Grep finds no stale "10%"-for-Elvet, no "free shipping at 6" attached to Palatine,
  no Coravin-at-6 copy anywhere.
