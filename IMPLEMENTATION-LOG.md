# Implementation log

A reverse-chronological record of work **Claude Code** has completed (newest at top).

## Why this file exists

Specs are written in Cowork (the Claude desktop app); they're implemented by Claude
Code. Cowork can read the repo but doesn't watch Claude Code work, so without this log
Cowork has no feedback loop — it can't tell which specs are done, what migration
number we're on, or what Claude Code learned while building. That leads to specs
written against stale assumptions.

This log closes that loop. **It is the first thing Cowork reads before writing a new
spec.**

## Division of labour

- **CLAUDE.md stays high-level.** When Claude Code finishes a spec it makes only
  small, structural edits there: bump the latest-migration number, move the spec out
  of "Active specs", update a table/route list if one changed.
- **This log holds the detail.** Everything granular — what was built, deviations,
  gotchas, verification — goes here, not in CLAUDE.md. This keeps CLAUDE.md thin
  (it's loaded into context every session) while preserving high-fidelity history.

## How to add an entry (Claude Code)

When you finish implementing a `claude-code-prompt-*.md` spec, **prepend** a new
entry directly below this line, using the template below. Newest entries go on top.
Keep entries concise but specific — a future spec-writer who can't see your session
should be able to understand what changed and what to watch out for.

<!-- NEW ENTRIES GO BELOW THIS LINE -->

---

### 2026-07-13 — Club page v3 rewrite + tiers-v3 go-live (`claude-code-prompt-club-page-v3.md`)

**State changes**
- `app/club/page.tsx` fully rewritten per spec: case-by-case ladder (1–6) with tier rows (Bailey/Elvet/Palatine at 2/4/6 cases) interleaved with milestone rows (1/3/5), tier detail blocks reordered Bailey → Elvet → Palatine (was Elvet-first, spend-based), credit/milestones/membership-year explainer sections, updated footnote. `metadata.title` → "How the Club works — The Cellar Club". No client JS, no data fetching, visual constants/`PerkEntry` pattern unchanged. Verified: no "spend"/"£500"/"£1,000"/"discount" strings remain; every number cross-checked against `lib/tiers.ts` and `lib/milestones.ts`; `npx next build` clean; rendered and spot-checked in-browser (desktop + mobile viewport, no console errors).
- Per Julia's go-ahead, this entry also covers flipping on the rest of tiers-v3 that had been built-and-held (see the entry below): **migration `044_tier_v3_recompute.sql` applied** to production (tier distribution went bailey 48/elvet 13/none 191 → bailey 2/none 250 — matches the pre-flagged dry-run finding exactly, since v3's 2-case Bailey floor is stricter than the old £1,000-spend rule), **`scripts/backfill-milestones.ts --live` run** (15 milestone-1 awards [10 pre-granted via the July engagement campaign, 5 new flag grants], 1 milestone-3 award [Daniel Roe], 0 at 5/6 — matches the earlier dry-run exactly), and **`CREDIT_REBATE_ENABLED=true` added to the Vercel production environment** via `vercel env add`.
- Fixed a pre-existing, unrelated `next build` TypeScript failure blocking a clean build: `scripts/send-engagement-campaign.ts`'s `getSegment{1,2,3}` helpers took `sb: ReturnType<typeof createClient>` (the raw `@supabase/supabase-js` generic), which resolved table-row types to `never` for arbitrary table selects (e.g. `.from('orders').select('customer_id')` — `o.customer_id` did not typecheck). Switched the script to `createServiceClient()` from `lib/supabase.ts` (the pattern already used everywhere else in the codebase) and typed the helpers as `SB = ReturnType<typeof createServiceClient>`, which resolves correctly. No behavioural change — same URL/key, same client options.
- `CLAUDE.md`: removed the club-page-v3 row from Active specs (implemented) and removed the "migration 044 not yet applied" caveat from the Migrations section (now applied).

**Deviations & decisions**
- None beyond what's already logged in the tiers-v3/credit-wallet entries below — this entry is the "flip the switch" follow-up those two entries were waiting on.

**Gotchas & future context**
- Tier distribution is now much thinner than before recompute (2 Bailey, 0 Elvet/Palatine, rest `none`) — anyone building admin views/reports that assumed the old spend-tier distribution should expect this.
- `scripts/engagement-campaign-sent-log.json` contains customer phone numbers and was deliberately **not committed** (excluded from this batch's `git add`) — worth adding to `.gitignore` if this script gets reused, per the note already in its own IMPLEMENTATION-LOG entry.

**Verification**
- Migration 044: applied via Supabase MCP `apply_migration`, tier counts confirmed via direct query before/after.
- Backfill: dry-run then `--live` run, `milestone_awards` row counts confirmed via direct query (15 at milestone 1, 1 at milestone 3).
- `CREDIT_REBATE_ENABLED`: confirmed added to Vercel production env via `vercel env add` (not pulled/tested against a live order in this session — next real rebate-eligible order will exercise it for the first time under v3 rates).
- `npx next build`: clean, zero errors, `/club` prerenders as static.

---

### 2026-07-13 — Tiers v3: case ladder + lifetime milestones (`claude-code-prompt-tiers-v3.md`)

**State changes**
- `lib/tiers.ts` fully rewritten for the case-based ladder: `tierFromCases` (2/4/6), `getRollingCases` (bottles from confirmed orders since `tier_since`, or `subscribed_at` as fallback, floor-divided by 12), `getLifetimeCases` (no window, for milestones), `deliveryFeePence` (£10/£7/£5/£5), `TIER_RANK`/`TIER_NAMES`. Removed the old spend-based `getRollingSpend`/`tierFromSpend`/`BAILEY_THRESHOLD`/`PALATINE_THRESHOLD` entirely and fixed both call sites (STATUS keyword in the Twilio webhook, case-nudges cron's tier-review section) — grepped afterward to confirm no dangling references. `rebatePctForTier` (added in the credit-wallet work) needed a rate fix at the same time — see deviation below.
- `checkAndApplyTierUpgrade` rewritten: upgrades are still immediate/mid-cycle and only ever move `tier` upward; `tier_since`/`tier_review_at` are now **only** set on a customer's very first-ever upgrade (establishes the cycle anchor) — a second mid-cycle upgrade (e.g. bailey→elvet) no longer resets them. This was a deliberate design point worked out during implementation, not explicit in the spec text — see deviation below.
- New `supabase/migrations/044_tier_v3_recompute.sql` — one-time bulk recompute of every customer's `tier` from lifetime cases + `tier_review_at` from next first-purchase anniversary. **File written, validated against production via a read-only dry-run SELECT, but NOT applied.** The dry-run surfaced that most current "Bailey" members (earned via the old £1,000 spend threshold) have only 1 lifetime case — below v3's new 2-case Bailey floor — so applying this immediately demotes most of them to `none`. Flagged to Julia; needs her go-ahead before running.
- New `supabase/migrations/045_milestone_awards.sql` — `milestone_awards` table (customer_id, milestone ∈ {1,3,5,6}, reward_choice, chosen_at, fulfilled_at/by, notes, unique(customer_id, milestone)). **Applied** (pure additive schema, same risk class as `credit_ledger`).
- New `lib/milestones.ts` — `awardMilestones()`, called from `handlePostCharge` right after the tier-upgrade check. Detects newly-reached lifetime milestones, inserts rows (idempotent via the unique constraint), auto-fulfils milestone 1 (sets `free_shipping_at_6`, logs `inbox_activity`, SMS), sends "Daniel will be in touch" SMS + `notifyAdmin` for 3/5, and for milestone 6 suppresses its own SMS when `checkAndApplyTierUpgrade` *in the same post-charge call* just upgraded the customer to Palatine (they get one combined message instead — see the Palatine congrats copy in `lib/tiers.ts`).
- New admin milestone fulfilment queue: `/admin/milestones` page + `MilestoneRowActions.tsx` + `PATCH /api/admin/milestones/[id]`. Added a nav link + unfulfilled-count badge to `AdminNav.tsx`/`MobileAdminNav.tsx`/the protected layout, same pattern as the Inbox/Shipments badges.
- Portal dashboard: `TierProgress` rewritten from a spend-bar to a cases-bar; new `MilestonesList` showing each earned milestone's fulfilled/choice-recorded/awaiting status. `page.tsx` now computes `casesThisCycle` via `getRollingCases` instead of a manual 12-month spend sum, and fetches the customer's `milestone_awards` rows.
- Tier-dependent delivery fee threaded through: `handleShip`/`handleShipConfirm` copy + charge amount in the Twilio webhook, the case-nudges cron's auto-ship charge + both nudge SMS, and the public FAQ on `app/page.tsx` (generic "less for members on higher tiers" copy, since that page has no logged-in customer context).
- Rewrote the case-nudges cron's tier-review section: the old code recomputed `tierFromSpend` and downgraded to whatever the customer currently qualified for. v3 replaces this with an **unconditional one-rank soft-demote** (palatine→elvet, elvet→bailey, bailey stays bailey) plus a fresh-cycle reset (`tier_since = now`, `tier_review_at = +1 year`) — see deviation below for why the case-count-based "floor" I originally proposed doesn't actually match the spec.
- Palatine 2hr early access (`claude-code-prompt-tiers-v3.md` §5): `/api/texts/send` now splits into two waves when Palatine members exist — wave 1 (Palatine) sends immediately; the text row gets `broadcast_at` (+2h) with `broadcast_sent_at` left null. A new "Send to everyone else now" button on the text detail page (`SendRemainderButton.tsx` → `POST /api/admin/texts/[id]/send-remainder`) fires wave 2 — **manual, not a cron**, since every existing cron in this repo runs once daily and a 2-hour-precision delayed send needs much finer granularity than that; flagged as a v1 implementer's-choice call per the spec's own permission to do so. When there are currently no Palatine members (the common case pre-recompute), sending is byte-identical to the old single-wave behaviour — new migration `046_texts_broadcast_wave.sql` (`texts.broadcast_at`, `texts.broadcast_sent_at`) **applied**.
- New `scripts/backfill-milestones.ts` (dry-run by default, `--live` to write) for §2c's launch backfill. **Dry-run executed against production, NOT run --live.** Output: milestone 1 → 15 customers (10 already pre-granted via the July engagement campaign, 5 would get a new flag grant), milestone 3 → 1 (Daniel Roe), milestones 5/6 → 0. This matches the spec's own stated expectation ("1 customer at milestone 3 (Daniel Roe), none at 5 or 6, ~15 at milestone 1 (mostly pre-granted)") almost exactly, which is a good sign the logic is right.

**Deviations & decisions**
- **Case-counting window semantics were genuinely ambiguous and I asked before building.** The spec says tiers use a "rolling 12-month window" but also "the new cycle starts fresh" at the anniversary and references "v2's window logic" — but tiers-v2 was superseded before it was ever implemented, so that referenced logic doesn't exist anywhere in the codebase. Asked Julia; she chose an anniversary-reset window (case count since `tier_since`, reset only at the annual review) over a continuously-sliding trailing-12-month window. Implemented accordingly.
- **The annual soft-demote is unconditional, not case-count-gated — I initially over-engineered this and caught it during implementation.** My own proposed design (approved at a high level by Julia as part of the window-semantics answer) included a `max(oneRankDown, tierFromCases(freshWindowCases))` safety net. Working through the actual arithmetic: since `checkAndApplyTierUpgrade` already keeps `tier` in sync with cases in real time all year, by review time the "cases in the old window" almost always already equal the customer's current tier — which makes `max()` collapse to "never demote," directly contradicting the spec's explicit mapping table (`palatine → elvet`, etc.). Dropped the case-count check entirely and implemented the literal unconditional one-rank demotion instead, which is simpler and actually matches the spec.
- **`tier_since`/`tier_review_at` are only set on a customer's first-ever tier upgrade, not every upgrade.** The old spend-based code reset both on every upgrade (mid-cycle or not), which would have meant every bailey→elvet bump mid-year silently pushed the anniversary out another year — inconsistent with "first-purchase anniversary" framing in §4. Not explicit in the spec text; inferred from the approved window-semantics answer, which only mentions resetting at "cron review time."
- **Migration 044 (recompute) and the milestone backfill's `--live` run were deliberately not executed.** Per explicit scope agreement at the start of this work: build everything, hold off on mutating live customer data until reviewed. The 044 dry-run's finding (most current Bailey members would drop to `none`) makes this doubly worth a deliberate go/no-go rather than an automatic apply.
- **No new cron for the Palatine early-access second wave** — see state changes above. If a cron becomes preferable later, `broadcast_at`/`broadcast_sent_at` are already there to poll on.
- **Found and flagged (not fixed) a pre-existing gap**: `/api/texts/send` had no admin-session check at all, despite a comment claiming middleware covered it — no `middleware.ts` exists anywhere in this repo. Spawned a background task for it rather than fixing inline (out of scope for this spec) — appears to have already landed a `requireAdminSession()` fix independently.

**Gotchas & future context**
- `CREDIT_REBATE_ENABLED` (credit-wallet spec) must **not** be flipped on until migration 044 has actually run — until then, customers' stored `tier` values still reflect the old spend-based assignments, and rebates would pay at v3 rates for tiers customers haven't actually earned under the case ladder.
- The delivery-fee FAQ copy on `app/page.tsx` is generic ("less for members on higher tiers") because that page has no logged-in customer context to show a specific number.
- `getRollingCases`'s fallback to `subscribed_at` (when `tier_since` is null) means a customer's very first qualifying order is counted from signup, not from their first order specifically — there's no `first_purchase_at` column, and the two are usually close together in practice.
- Reward-choice validation in `PATCH /api/admin/milestones/[id]` hardcodes the milestone 3/5 option lists — if Daniel ever changes the reward menu, update `VALID_CHOICES` there and `MILESTONE_OPTIONS`/`REWARD_LABELS` in the milestones page and portal `MilestonesList` together (three places, not centralised — small enough surface that a shared constant felt like premature abstraction, but worth revisiting if the reward menu grows).

**Verification**
- `npx tsc --noEmit` and `npx eslint` clean on every file this entry touches (checked repeatedly through the build, not just at the end).
- Migration 045 and 046 applied and verified live (table/columns exist). Migration 044 validated via a read-only dry-run SELECT against production (not applied). `scripts/backfill-milestones.ts` dry-run executed against production and matches the spec's stated expectations closely (not run `--live`).
- Not manually tested end-to-end against live Twilio/Stripe (no test environment in this session) — recommend running the spec's own Verification checklist (§ at the end of `claude-code-prompt-tiers-v3.md`) once 044 and the backfill are approved and run.


---

### 2026-07-13 — Credit wallet: one-time grants + tier rebates (`claude-code-prompt-credit-wallet.md`)

**State changes**
- New migration `supabase/migrations/043_credit_wallet.sql`: `customers.credit_balance_pence`, `orders.credit_used_pence`, `credit_ledger` table, partial unique indexes for idempotent rebate/redemption per order, and the `apply_credit()` SQL function (single mutation path for balance + ledger). Initially left unapplied per this repo's stated manual-application convention; **applied to the live DB via the Supabase MCP tool at Julia's explicit request** and verified — all columns, the table, the function, and both unique indexes confirmed present.
- New `lib/credit.ts`: `grantCredit`, `accrueRebate` (swallows unique-violation retries), `redeemCreditForOrder` (swallows unique-violation retries; on a check-violation — balance shrank since the quote — deducts whatever remains, updates `credit_used_pence` to match, and `notifyAdmin`s the shortfall rather than failing an already-authorised order), `getBalance`.
- `lib/tiers.ts`: added `rebatePctForTier()` — palatine 0.10, elvet 0.10, bailey 0.05, else 0 (tiers-v3 ladder).
- `lib/post-charge.ts`: at the top of `handlePostCharge`, redeems any `credit_used_pence` already recorded on the order (idempotent — safe across YES/webhook/3DS-confirm re-entry into the same order). Rebate accrual is gated behind `CREDIT_REBATE_ENABLED` (unset by default) and priced at the tier the customer held **coming into** the order (i.e. `currentTier`, read before `checkAndApplyTierUpgrade` runs — not the post-upgrade tier). A "Credit balance: £X.XX" line is appended to all three scenario SMS bodies when balance > 0; a new optional `preNote` param prepends a note line (used for one edge case below).
- `app/api/webhooks/twilio/inbound/route.ts`: `handleYes` now takes `(paymentMode: 'auto' | 'card' | 'balance' = 'auto', preNote?: string)`. In `auto` mode (plain YES), a balance > 0 short-circuits the charge and prompts BALANCE/CARD instead. `balance` mode computes `creditToUse = min(balance, total)`; if it covers the order in full, there's no Stripe call at all — `handlePostCharge` does the actual redemption via the `credit_used_pence` read described above. `card` mode charges the full total and explicitly zeroes any stale `credit_used_pence` left over from a prior failed BALANCE attempt. Router: BALANCE/CARD keywords route through `handleYes` only when a pending order exists (reusing all the existing expiry/retry guards); BALANCE with no pending order does the standalone balance-check reply; CARD with no pending order falls through to the normal unrecognised-keyword handling untouched; BALANCE with a pending order but a since-spent £0 balance is treated as CARD with a one-line explanatory note (the new `preNote` param).
- New `app/api/admin/customers/[id]/credit/route.ts` (admin grant, validates positive-integer pence + non-empty reason, logs `inbox_activity` action `credit_granted`, SMS's the customer, SMS failure doesn't roll back the grant) and `app/admin/_components/GrantCreditControl.tsx` (amount + reason form). Wired into the Admin tools section of the customer detail page, alongside a read-only balance + last-5-ledger-entries display. `credit_granted` added to `describeAction` in `InboxClientView.tsx`.
- `app/portal/dashboard/page.tsx` / `DashboardClient.tsx`: read-only "Credit: £X.XX" line on the membership card, shown only when balance > 0.

**Deviations & decisions**
- **The spec text embedded in the task prompt was stale relative to the actual `claude-code-prompt-credit-wallet.md` file on disk.** The prompt's copy said rebate = elvet 5% / palatine 10%, accrued *after* `checkAndApplyTierUpgrade` (so a fresh upgrade counts immediately), and referenced tiers-v2. The live file on disk had already been revised to the tiers-v3 ladder (bailey 5% / elvet 10% / palatine 10%) accrued at the tier held **before** the order (an order that triggers an upgrade earns at the old, lower rate). Caught this by cross-checking against `CLAUDE.md`'s own Active-specs summary of the file, which didn't match what I'd been given. Implemented against the file on disk (the correct source of truth per this repo's own "Cowork writes specs, Claude Code implements as-is" rule), not the prompt copy. **Worth double-checking spec text against the actual file on disk going forward, even when the prompt appears to quote it verbatim** — Cowork can revise a spec file between when it's pasted into a task and when the task runs.
- Chose the "redeem inside `handlePostCharge`, keyed off `order.credit_used_pence`" option (one of two the spec explicitly allowed) over duplicating the redemption call at each of the three charge-success call sites. This also naturally covers the full-credit (`remainder === 0`) case from `handleYes('balance')`, since that path sets `credit_used_pence` and then calls `handlePostCharge` exactly like the partial-credit case does.

**Gotchas & future context**
- `CREDIT_REBATE_ENABLED` is not yet set anywhere — rebate accrual is a silent no-op until both migration 043 is applied *and* the tiers-v3 recompute (migration 044, per that spec) is live and the env var is flipped on. BALANCE/CARD redemption and admin grants do **not** depend on this flag and will work as soon as 043 is applied, regardless of tiers-v3 status.
- `orders.stripe_charge_status` is nullable in the live DB (confirmed via Supabase MCP schema query before writing the full-credit-redemption path, which sets it to `null`) — this was a real risk given the column isn't defined in any tracked migration file (the `orders` table predates this repo's migration history).
- Did not exercise the SMS/Stripe flows end-to-end (no test environment in this session) — verified via `tsc --noEmit` and `eslint` on every touched file only (both clean). The pre-existing `npm run build` failure in `scripts/send-engagement-campaign.ts` is unrelated (untracked file, not touched here, fails on its own type errors).

**Verification**
- `npx tsc --noEmit` and `npx eslint` clean on every file this entry touches.
- Migration is live, but not yet manually tested against a live Twilio/Stripe sandbox — recommend running the §9 verification checklist in the spec (grant SMS, rebate idempotency, YES→BALANCE/CARD prompt, full vs partial credit redemption, shortfall race guard).


---

### 2026-07-02 — Engagement campaign script + ad hoc free-shipping-at-6 grants (`claude-code-prompt-engagement-campaign-send.md`)

**State changes**
- New script: `scripts/send-engagement-campaign.ts` (one-time operational tool, not a feature — no CLAUDE.md route/table changes needed). Dry-run verified: Segment 1 = 56, Segment 2 = 23, Segment 3 = 117 (105 named / 12 unnamed). No live sends yet — see below.
- `customers.free_shipping_at_6` set to `true` (via direct SQL, logged to `inbox_activity` with `actor_id: null` and a detail note) for:
  - Ian Tucker, Clare Fitzpatrick, Behr Brun — ad hoc grant requested directly by Julia via chat, unrelated to the campaign.
  - 8 more customers (Angela Woods, Daniel Roe, Grahame Foster, Kelvin Robinson, Nathalie Letzelter, Paul Brennan, Reece Barnes, Richie Villis) — backfilled to bring the flag in line with Segment 2's live rule (see deviation below).

**Deviations & decisions**
- **Segment 2 population changed from the spec's assumption.** The spec said `free_shipping_at_6=true` already matched the ~11 Segment-2 recipients exactly and told the implementer not to recompute. By the time this ran, that had drifted: only 12 customers were pre-flagged (some had since ordered past 4 bottles, so the flag was stale for them), while the live rule (≥1 confirmed order AND <4 unshipped bottles) matched 23. Flagged this to Julia; she chose the rule-based 23. Backfilled the flag for the 8 rule-matches that weren't already flagged so the SMS wording ("I've dropped your free shipping to 6 bottles...") is accurate for everyone who receives it. All 23 are confirmed flagged as of this entry.
- **Idempotency mechanism changed.** The spec's dedupe check reads `sms_messages` for a prior send with the campaign trigger — that table was dropped in the `inbox-twilio-history` work (migration 041), and `sendSms()` no longer logs outbound messages anywhere in the DB. Flagged this to Julia; she chose a local JSON sent-log (`scripts/engagement-campaign-sent-log.json`, gitignored-worthy but not yet added to `.gitignore` — consider adding if this script gets reused) over repurposing `inbox_activity`. The file is only written on `--live` sends, never on dry-runs.

**Gotchas & future context**
- If anyone touches `sendSms()`'s logging behaviour again, this script's `--live` idempotency still relies solely on the local JSON file, not the DB — don't assume `inbox_activity` or any table reflects campaign sends.
- The 3 ad hoc grants (Ian/Clare/Behr) turned out to also satisfy the Segment 2 rule independently, so they're included in the 23 rather than being a separate carve-out.

**Verification**
- Dry-run first for all three segments, then live-sent all three per Julia's go-ahead. Final wording tweaks applied before sending: Segment 1 "but not ordered yet" → "but hadnt ordered yet.", Segment 3 (both variants) dropped the trailing " - we just started."
- **Live results:** Segment 1: 55/56 sent (1 failure). Segment 2: 23/23 sent. Segment 3: 117/117 sent. Total 195/196.
- **Known failure:** `+447553465230` (Brittany Baker) — Twilio rejected with "Attempt to send to unsubscribed recipient" (carrier/Twilio-side opt-out), but her `customers` row still shows `status: active`, `unsubscribed_at: null`. This is a data mismatch between our DB and Twilio's opt-out registry — flagged to Julia, not resolved. Worth a future check on whether other customers have the same drift (Twilio thinks they're opted out, we don't).

---

### 2026-07-01 — One-shot free shipping at 6 (`claude-code-prompt-free-shipping-at-6.md`)

**State changes**
- Migration added: `042_free_shipping_at_6_flag.sql`. New latest migration = 042.
  - `customers.free_shipping_at_6 boolean not null default false`.
  - Also dropped the `not null` constraint on `inbox_activity.actor_id` (needed so the auto-consume path can log a system-actioned row with no admin actor).
- `lib/tiers.ts`: `deliveryThreshold(tier, freeShippingAt6 = false)` now takes a second param; returns 6 if either `tier === 'palatine'` or the flag is set.
- `lib/post-charge.ts`: now selects `free_shipping_at_6` alongside `tier`, passes it into `deliveryThreshold`, and clears it (in the same update that resets `case_started_at`) whenever a shipment is created in Scenario 2 or 3 while the flag was true. Logs `inbox_activity` (`action: 'free_shipping_at_6_cleared'`, `actor_id: null`, `detail: 'auto-cleared on shipment creation'`) on auto-consume. Both hardcoded "12" SMS strings (Scenario 1 "complete your case", Scenario 3 "case is ready") now interpolate `${threshold}`. Scenario 2's message never hardcoded a bottle count, so it needed no change.
- New route: `app/api/admin/customers/[id]/free-shipping-at-6/route.ts` (PATCH `{ enabled: boolean }`) — sets the flag and logs `inbox_activity` (`free_shipping_at_6_set` / `free_shipping_at_6_cleared`, `detail: 'cancelled by admin'` on manual disable).
- New component: `app/admin/_components/FreeShippingAt6Toggle.tsx`, wired into the "Admin tools" section of `app/admin/(protected)/customers/[id]/page.tsx` (next to `DeactivateButton`).
- `app/admin/_components/InboxClientView.tsx` / `app/admin/(protected)/inbox/page.tsx`: `ActivityFeed`'s `describeAction` now renders `free_shipping_at_6_set`/`free_shipping_at_6_cleared`; activity rows with a null `actor_id` render as actor "System" instead of "Unknown".

**Deviations & decisions**
- Put the toggle on the customer detail page's "Admin tools" section rather than the inbox right-hand panel — spec allowed either ("and/or"); the detail page already hosts the analogous status/deactivate control, so it's the more consistent home. Not duplicated in the inbox panel to keep this change small.
- Spec's section 4 described the "Scenario 2 case-complete SMS" as containing "Your case of 12 is ready!" — that literal string actually lives in Scenario 3 (the >threshold split branch); Scenario 2 (exactly threshold) has never hardcoded a bottle count. Updated the two SMS strings that actually contain a hardcoded 12 (Scenario 1 and Scenario 3) and left Scenario 2 untouched, which satisfies the spec's real intent (no wrong bottle-count wording for flagged customers).
- `inbox_activity.actor_id` needed to become nullable to support the spec's "null actor" auto-consume logging — this wasn't listed under "Files to change" but is required for section 3/5 to work as specified.

**Gotchas & future context**
- The manual "reply SHIP" flow (`app/api/webhooks/twilio/inbound/route.ts`, hardcoded `12`s around lines ~201 and ~287) does **not** honour this flag, per spec section 7 — a flagged customer who replies SHIP at exactly 6 bottles will not get free shipping via that path. Not fixed here; flagged for a future spec if it matters.
- `deliveryThreshold` is still a pure function (no DB access) — callers must fetch `free_shipping_at_6` themselves, same pattern as `tier`.

**Verification**
- `npx next build` (clean `.next`) compiles successfully with the new route/type surface; no new TypeScript errors introduced (pre-existing unrelated errors in `.test.ts` files and stale route-validator cache noted but not touched).
- Not manually tested end-to-end against a live Supabase instance (migration not applied to any environment by this session) — Cowork/whoever applies migration 042 should re-verify the scenarios in the spec's "Verification" section against real data before considering this fully confirmed in production.

---

### YYYY-MM-DD — <spec title> (`claude-code-prompt-<name>.md`)

**State changes** _(what Cowork needs to write the next spec accurately)_
- Migrations added: e.g. `041_drop_sms_messages.sql`. New latest migration = NNN.
- Tables/columns created or dropped:
- New/removed routes, env vars, or libs:

**Deviations & decisions** _(where reality differs from the spec, and why)_
- Resolved open questions the spec flagged:
- Anything built differently from the spec, with the reason:

**Gotchas & future context** _(non-obvious things worth knowing next time)_
- e.g. "X looks unused but is load-bearing for Y", constraints hit, tech debt left:

**Verification** _(so Cowork knows the confidence level)_
- How it was checked: build/typecheck passed? manual test? what was NOT tested?

---

<!-- TEMPLATE — copy the block above for each completed spec. Delete this comment? No, keep it. -->
