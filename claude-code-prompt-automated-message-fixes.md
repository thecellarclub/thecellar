# Spec: Automated message audit — fix wrong counts, wrong triggers, wrong copy

## Why (incident summary)

Since the tiers-v3 go-live (2026-07-13), automated SMS have been visibly wrong and are
causing customer confusion and distrust. Reported case: `+447828462688` (the same
customer from the stale auto-order bug fixed 2026-07-21) received, on one order:

> "First case done! Your next shipment is free at just 6 bottles - a little reward from
> us. Reply BALANCE any time to check your credit."
>
> "Congratulations on your first order! Your cellar now holds 8 bottles. Complete your
> case of 12 by 19th August for free shipping - or reply SHIP any time to send what you
> have for £10."

Reality: it was **not** her first order, she has **never completed a case** (8 bottles),
and BALANCE is meaningless to her (no credit, no rebate-earning tier). Separately, the
90-day deadline reminder texts have been reporting the number of **cellar rows (unique
wines)** instead of **total bottles**.

This spec fixes every root cause found in a full audit of the automated-message surface,
plus the data repair for customers already mis-flagged. Section 8 lists every automated
message audited and its verdict, so nothing here is a partial fix.

**Priority: high — these are live customer-facing sends. Please implement before any
other active spec.**

---

## 1. Bottle counts: row counts vs `sum(quantity)` (the deadline-reminder bug)

Cellar bottles live in `cellar` rows with a `quantity` column — one row per order line,
quantity can be > 1. Any count of bottles MUST be `sum(quantity)`, never a row count.
Two places use a Supabase `{ count: 'exact', head: true }` row count instead:

### 1a. `app/api/cron/case-nudges/route.ts` (~lines 68–74)

```typescript
const { count: bottleCount } = await sb
  .from('cellar')
  .select('*', { count: 'exact', head: true })
  .eq('customer_id', customer.id)
  .is('shipment_id', null)
```

This `bottles` value feeds **nudge 1**, **nudge 2**, the **auto-ship SMS**, AND the
auto-ship shipment's `bottle_count` column — so shipment records created by auto-ship
are wrong in the DB too, not just in copy. Replace with a quantity sum, e.g. read from
the `customer_cellar_totals` view (already `sum(quantity) where shipment_id is null` —
see migration `039_fix_cellar_unshipped_view.sql`) or select `quantity` and reduce, as
`lib/post-charge.ts` already does correctly.

Also: the "nothing in cellar → reset timer" branch checks `bottles === 0` — a row-count
0 and a sum 0 are equivalent there, but use the same corrected value.

### 1b. STATUS keyword handler, `app/api/webhooks/twilio/inbound/route.ts` (~lines 561–567)

Same `{ count: 'exact', head: true }` pattern (this one filters on `shipped_at is null`
rather than `shipment_id is null` — while you're there, align it to `shipment_id is
null` / the view, so STATUS doesn't count bottles already reserved in a pending
shipment).

### 1c. Data check

Auto-ship shipments already created with a wrong `bottle_count` (from 1a): find
shipments where `bottle_count` ≠ the `sum(quantity)` of their linked cellar rows and
correct `bottle_count`. Report how many in the implementation log.

**Correct references (do not change):** `handleCellar` sums quantities; `handleShip` /
`handleShipConfirm` use `customer_cellar_totals`; `post-charge.ts` reduces over
`quantity`.

---

## 2. "Congratulations on your first order!" fires on every order (tier proxy bug)

`lib/post-charge.ts` Scenario 1 (~line 150):

```typescript
const prefix = currentTier === 'none' ? 'Congratulations on your first order! ' : ''
```

`tier === 'none'` was never a safe proxy for "first order", and since the migration-044
recompute it's catastrophically wrong: tier stays `'none'` until **2 lifetime cases (24
bottles)**, and 250 of 252 customers are currently `'none'` — so nearly every customer
gets "Congratulations on your first order!" on **every** order until they reach Bailey.

**Fix:** key the prefix on actual order count. At the point the prefix is computed,
count this customer's confirmed orders (the just-charged order is already
`'confirmed'` by the time `handlePostCharge` runs, so first order ⇒ count === 1, net of
the refund exclusion in section 3). Do not use tier for this in any message.

---

## 3. Milestones fire from inflated "lifetime cases" (the "First case done!" bug)

`lib/tiers.ts` — both `getLifetimeCases` and `getRollingCases` count bottles from all
orders with `order_status = 'confirmed'`. Two ways that over-counts:

1. **Refunds never change `order_status`.** The admin refund route
   (`app/api/admin/customers/[id]/refund/route.ts`) sets
   `orders.stripe_charge_status = 'refunded'` and removes/decrements the cellar row, but
   the order stays `'confirmed'` — so refunded bottles still count towards milestones,
   tier upgrades, and the 044 recompute forever.
2. **Phantom orders from the stale-offer auto-confirm bug** (fixed 2026-07-21, same
   customer `+447828462688`): bogus bare-number replies created real confirmed orders.
   The guard now prevents new ones, but any bogus orders already in the data still count.

That's how a customer with 8 real bottles crossed the 12-bottle "lifetime case 1" line:
confirmed-order quantities ≥ 12 even though her true net bottles are 8. Milestone 1 then
auto-fired ("First case done!"), auto-granted `free_shipping_at_6`, and — because
`awardMilestones` runs *before* the scenario SMS in `post-charge.ts` — she got the
milestone text immediately before a text calling it her first order.

### 3a. Counting fix

Make case counting **net of refunds** in both functions (and anywhere else lifetime
bottles are computed). The `refunds` table has `order_id` and `quantity`; subtract
refunded quantities from the confirmed-order sum:

```
bottles = sum(orders.quantity where confirmed) − sum(refunds.quantity for those orders)
cases   = floor(bottles / 12)
```

Keep `'cancelled'` / `'expired'` orders excluded as today. Apply the same logic to any
future recompute (044-style) — note this in the migration file's comments if you touch
it.

### 3b. Message-ordering fix

In `lib/post-charge.ts`, move the `awardMilestones(...)` call to **after** the
scenario SMS has been sent, so the order-confirmation/cellar-update text always arrives
before any milestone congratulations. Keep the existing
`skipSmsForMilestone`/Palatine-combined-message behaviour intact — only the send order
changes.

### 3c. Data repair (careful — no SMS during repair)

Using the corrected (net-of-refunds) counting, and after cleaning up phantom orders:

1. **Phantom orders:** audit `+447828462688`'s order history first (this is the known
   case — verify against her Twilio conversation and the admin's manual takeover), and
   sweep for other customers with auto-created orders matching the stale-offer pattern.
   Mark bogus ones `'cancelled'` (restore wine stock only if it was actually decremented
   and never restored; remove any cellar rows they created that don't reflect real
   bottles). Flag anything ambiguous to Julia rather than guessing.
2. **Wrong milestone awards:** for every `milestone_awards` row where the customer's
   corrected lifetime cases < the milestone number, delete the row and log an
   `inbox_activity` entry (`actor_id: null`, detail e.g. `'milestone revoked: awarded
   from inflated count'`). Yes, the table's convention is "never deleted" — that applies
   to legitimately earned milestones surviving anniversary resets, not to rows that
   should never have existed. Deleting frees the unique constraint so the customer earns
   it properly later.
3. **Wrongly granted `free_shipping_at_6`:** revoke (set false + `inbox_activity`
   `free_shipping_at_6_cleared`, detail `'revoked: milestone awarded in error'`) ONLY
   where the flag was set by a now-revoked milestone-1 award (`inbox_activity` detail
   `'milestone: first case'`) and hasn't already been consumed. Do NOT touch flags
   granted manually or via the July engagement campaign.
4. **Inflated tiers:** recompute `tier` for any customer whose corrected case count no
   longer supports it, via direct SQL (no SMS — the upgrade/downgrade texts must
   not fire during repair).
5. Produce a summary table (customer, what was corrected) in the implementation log so
   Julia can decide on any customer comms herself. **Do not send any apology or
   correction texts automatically.**

---

## 4. BALANCE must not appear in messages before credit is relevant

Credit/BALANCE only matters once a customer has credit (admin grant) or earns rebates
(Bailey+, i.e. 2+ cases). The milestone-1 SMS in `lib/milestones.ts` tells brand-new
one-case customers to "Reply BALANCE any time to check your credit" — remove that
sentence:

> `First case done! Your next shipment is free at just 6 bottles - a little reward from us.`

Rule going forward (add a comment near the templates): **no proactive automated message
mentions BALANCE/credit unless (a) the customer's balance is > 0, or (b) the message is
itself about credit** (tier-upgrade texts announcing the rebate are fine; the
`creditBalanceLine` in `post-charge.ts` is fine because it's gated on balance > 0; the
standalone BALANCE keyword reply is customer-initiated and fine).

---

## 5. Hardcoded thresholds and fees in message copy

Now that milestone 1 auto-grants `free_shipping_at_6`, flagged customers are the common
case, not an edge case — and Palatine members exist. Copy that hardcodes "12" or "£10"
is wrong for them:

### 5a. `lib/post-charge.ts` Scenario 1 SMS
"…or reply SHIP any time to send what you have for **£10**" — use
`deliveryFeePence(currentTier)` (as the case-nudges cron already does). The
`case of ${threshold}` part is already correct.

### 5b. `app/api/cron/case-nudges/route.ts` nudge copy
The cron never fetches `free_shipping_at_6`, and both nudges hardcode 12:
- Nudge 1: "Complete your case of **12** for free shipping…"
- Nudge 2: "…or keep collecting (free at **12**)."

Select `free_shipping_at_6` alongside the other customer fields, compute
`threshold = deliveryThreshold(customer.tier, free_shipping_at_6)`, and interpolate it
in both messages.

### 5c. STATUS handler (`inbound/route.ts`)
`deliveryThreshold(tier)` is called without the flag → tells flagged customers "free
shipping at 12". Fetch the flag (add to the customer select if needed) and pass it.

### 5d. SHIP / SHIP CONFIRM flow (`inbound/route.ts`, ~lines 159–290)
The known deferred gap from `claude-code-prompt-free-shipping-at-6.md` §7 — now in
scope because flagged customers are common:
- `if (total < 12)` → compare against `threshold`.
- "…or keep collecting for free at **12**." → `${threshold}`.
- `const bottlesToShip = Math.floor(total / 12) * 12` → use `threshold` as the case
  size for the flagged/Palatine path, so a flagged customer with ≥ threshold bottles
  who replies SHIP gets their free shipment (and the flag is consumed exactly as
  `post-charge.ts` does — same `free_shipping_at_6: false` update + `inbox_activity`
  auto-clear row on shipment creation).

If any of 5d turns out to interact badly with the paid-early-ship pricing, implement
5a–5c and flag 5d back to Julia with your reasoning instead of guessing — but the
customer-visible copy must not say "12" to someone whose threshold is 6.

---

## 6. Timing guards (verify, small fixes only if broken)

Part of the "sent at the wrong time" complaint is already fixed (2026-07-21 stale-offer
guard). Verify the remaining timing logic as part of this spec — fix only if actually
broken:

- **Nudges:** nudge 1 at day ≥ 75, nudge 2 at day ≥ 90, auto-ship at day ≥ 104 only if
  nudge 2 was sent; nudge state columns reset whenever the timer resets. Confirm the
  deadline date interpolated into nudges (`case_started_at + 90`) matches the deadline
  quoted in the Scenario-1 SMS for the same case (both are +90 days — keep them in
  lockstep if you touch either).
- **Welcome cron:** only sends where `welcome_sent_at is null` with the 5-minute delay
  and re-check — looks correct; leave as-is.
- **Payment retry:** nudge at attempts = 1, cancel at ≥ 2, never auto-charges — looks
  correct; leave as-is.

---

## 7. Out of scope / do NOT change

- No copy rewrites beyond what's specified (Julia owns tone).
- No new tables or message-template framework — smallest change that fixes each bug.
- Do not touch the 2026-07-21 stale-offer guard.
- No automated SMS of any kind triggered by the data repair (3c) — SQL only.
- Admin-authored sends (broadcasts, offers, concierge replies) are out of scope.

---

## 8. Audit inventory (every automated message, and its verdict)

For the record — every automated outbound SMS was reviewed for this spec:

| Message / trigger | Where | Verdict |
|---|---|---|
| Scenario 1 cellar-update ("first order" prefix, £10, deadline) | `lib/post-charge.ts` | **Fix** — §2, §5a |
| Scenario 2 case-complete (wine list, address/link) | `lib/post-charge.ts` | OK (threshold-aware) |
| Scenario 3 case-ready + remainder | `lib/post-charge.ts` | OK (threshold-aware) |
| Credit-balance line appended to the above | `lib/post-charge.ts` | OK (gated on balance > 0) |
| Milestone 1 ("First case done!") | `lib/milestones.ts` | **Fix** — §3 (trigger), §4 (copy), §3b (ordering) |
| Milestones 3 / 5 / 6 | `lib/milestones.ts` | **Fix trigger only** — §3 counting; copy OK |
| Tier upgrade congrats (Bailey/Elvet/Palatine) | `lib/tiers.ts` | **Fix trigger only** — §3 counting; copy OK |
| Tier annual soft-demote notice | `case-nudges` cron | OK |
| Nudge 1 / Nudge 2 / auto-ship | `case-nudges` cron | **Fix** — §1a counts, §5b copy |
| Welcome A / B + offer follow-up | `welcome-and-card-prompt` cron | OK |
| Payment-failed nudge / cancellation | `payment-retry` cron + `lib/sms-templates.ts` | OK |
| Order flow (no-card link, card-saved recap, payment failed T0) | `lib/sms-templates.ts` + YES handler | OK |
| YES → credit prompt (BALANCE/CARD) | `inbound/route.ts` | OK (gated on balance > 0) |
| CELLAR reply | `inbound/route.ts` | OK (sums quantity) |
| STATUS reply | `inbound/route.ts` | **Fix** — §1b count, §5c threshold |
| SHIP / SHIP CONFIRM replies | `inbound/route.ts` | **Fix** — §5d (view totals themselves are OK) |
| PAUSE / RESUME / ACCOUNT / OFFER / NO / STOP / unknown-number replies | `inbound/route.ts` | OK |
| Standalone BALANCE reply | `inbound/route.ts` | OK (customer-initiated) |
| Refund confirmation SMS | admin refund route | OK |
| Admin credit-grant SMS | admin credit route | OK |

---

## Files to change

- `app/api/cron/case-nudges/route.ts` — §1a, §5b
- `app/api/webhooks/twilio/inbound/route.ts` — §1b, §5c, §5d
- `lib/post-charge.ts` — §2, §3b, §5a
- `lib/tiers.ts` — §3a (`getLifetimeCases`, `getRollingCases`)
- `lib/milestones.ts` — §4
- Data repair per §1c and §3c (direct SQL; no migration file needed unless you prefer
  one for the repair — if so, next number is **047**)

## Verification

- Customer with 2 cellar rows of quantity 4 each (8 bottles, 2 wines): nudge 1/2 and
  STATUS all say **8 bottles**, not 2.
- Second order from a customer with 1 prior confirmed order: no "Congratulations on
  your first order!" prefix. Genuinely first order: prefix present.
- Customer with 14 confirmed-order bottles of which 6 refunded (net 8): no milestone 1,
  no tier movement, `getLifetimeCases` returns 0.
- Milestone-1 SMS contains no mention of BALANCE and arrives **after** the order
  confirmation SMS.
- Flagged (`free_shipping_at_6`) customer: Scenario-1 SMS, nudges, STATUS and SHIP all
  say 6, not 12; SHIP at ≥ 6 bottles ships free and consumes the flag.
- Bailey customer's Scenario-1 SMS quotes £7 (not £10) for ship-early.
- `+447828462688` after repair: no milestone award, flag revoked (if milestone-granted),
  tier correct, order history shows only real orders — summary in the implementation
  log for Julia.
- `npx tsc --noEmit` and `npx next build` clean.
