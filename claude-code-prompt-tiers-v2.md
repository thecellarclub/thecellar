# Spec: Tier system v2 — case-based tiers, rebate wallet, choose-your-gift

> **⚠️ SUPERSEDED by `claude-code-prompt-tiers-v3.md` (2026-07-13). Do not implement
> this spec.** v3 changes the thresholds to 2/4/6 cases, replaces choose-your-gift
> with lifetime milestones at cases 1/3/5/6, and re-maps rebates to
> Bailey 5% / Elvet 10% / Palatine 10%. Credit mechanics live in
> `claude-code-prompt-credit-wallet.md`. Kept for design history only.

## Status & relationship to other specs

This **supersedes** the design in `claude-code-prompt-tiers-update.md` and
`claude-code-prompt-tier-benefits.md`. Where those conflict with this document, **this
document wins**. If `tiers-update.md` has not yet been implemented, skip it and implement
this instead. If it *has* been partly implemented (spend-based thresholds in
`lib/tiers.ts`), this spec replaces that logic.

The tier basis changes from **rolling spend** to **cases ordered**, and the meanings of
`bailey` and `elvet` are deliberately swapped (see below). Read carefully — the string
values do not map to their previous ranks.

---

## 1. The ladder

Tier is based on **cases**, where **1 case = 12 bottles ordered** (confirmed orders;
count bottles from confirmed orders, same source used for the cellar). Counted on a
**rolling 12-month window from the customer's first purchase**, resetting on that
anniversary date each year (see §5 for reset behaviour).

| Rank | Earned at | Tier string | Display name |
|------|-----------|-------------|--------------|
| 0 | Signed up, no confirmed order | `none` | — (member) |
| 1 | 1 case (12 bottles) | `bailey` | **Bailey** |
| 2 | 3 cases (36 bottles) | `elvet` | **Elvet** |
| 3 | 6 cases (72 bottles) | `palatine` | **Palatine** |

> **Deliberate naming note:** `bailey` is now the ENTRY tier (1 case) and `elvet` is the
> MID tier (3 cases). This is intentional — Julia wants "Elvet" to read as the more
> premium of the two. Do not "correct" this. Update all rank maps accordingly:
>
> ```typescript
> const tierRank: Record<string, number> = { none: 0, bailey: 1, elvet: 2, palatine: 3 }
> ```

### Benefits per tier

| Benefit | Bailey (1 case) | Elvet (3 cases) | Palatine (6 cases) |
|---|---|---|---|
| Wine texts | 2 / week | 2 / week | **2 hrs early** |
| Concierge requests | 2 / month | 5 / month | Unlimited |
| Wine requests | Unlimited | Unlimited | Unlimited |
| Rebate to credit | — | **5%** | **10%** |
| Delivery fee (under 12 bottles) | £10 | £7 | £5 |
| Gift (choose one) | — | 2 tasting tickets **or** 4 Riedel glasses | 4 tasting tickets **or** Coravin |

**Concierge / wine-request / text limits are DISPLAY ONLY.** Do not build metering or
enforcement — members hardly use them. Show the numbers in the portal/marketing as tier
descriptions; do not block or throttle anything based on them. ("2 hrs early" for
Palatine texts IS a real mechanic — see §6.)

---

## 2. Case-based tier assignment (`lib/tiers.ts`)

Replace the spend-based logic:

- Add `getRollingCases(customerId, sb)`: sum bottles from confirmed orders in the
  customer's current 12-month window (from first-purchase anniversary), integer-divide by
  12 → cases. Use the same window logic the current `getRollingSpend` uses, but counting
  bottles/12 instead of pence.
- Replace `tierFromSpend()` with `tierFromCases()`:

  ```typescript
  export function tierFromCases(cases: number): 'none' | 'bailey' | 'elvet' | 'palatine' {
    if (cases >= 6) return 'palatine'
    if (cases >= 3) return 'elvet'
    if (cases >= 1) return 'bailey'
    return 'none'
  }
  ```

- Update `checkAndApplyTierUpgrade()` to use `getRollingCases` + `tierFromCases` and the
  new `tierRank` above. Keep the "only upgrade here, never downgrade" behaviour.
- **Congrats SMS on upgrade:** keep the existing pattern but fix display names for the
  new mapping. `none → bailey` is the "first tier" moment; `→ elvet` and `→ palatine`
  are the gift stages. Reword so Bailey/Elvet/Palatine congrats each mention the member
  can choose their gift (Elvet/Palatine) and that Daniel will be in touch.
- Remove `deliveryThreshold`'s dependence on tier being about spend — note the separate
  `free_shipping_at_6` one-shot flag spec is unaffected; keep it.

Delete/rename `tierFromSpend`, `getRollingSpend` references for tier purposes. (If
`getRollingSpend` is used elsewhere for the rebate, keep a spend helper — see §3.)

### Data migration

Migration `044_tier_v2_recompute.sql` (number after the free_shipping and any earlier
migrations — verify latest before numbering):

- Recompute every customer's tier from their rolling cases using the new thresholds and
  set `tier`, `tier_since` (keep existing if already set), and `tier_review_at`
  (= first-purchase anniversary, next occurrence). Customers with no confirmed order stay
  `none`.
- Because the string meanings changed, do this as a full recompute, not an in-place
  rename — compute cases per customer and assign the correct new tier string.

---

## 3. Rebate wallet (store credit) — SUPERSEDED, see credit-wallet spec

> **⚠️ This entire section is superseded by `claude-code-prompt-credit-wallet.md`,
> which is the canonical spec for all credit functionality** (schema incl.
> `apply_credit()` function, admin one-time grants, rebate accrual with the
> `CREDIT_REBATE_ENABLED` kill-switch, BALANCE/CARD redemption, standalone BALANCE,
> portal display). Implement credit from that spec, not from the text below. Key
> deltas vs. what follows: migration is `043_credit_wallet.sql` (not 045 — renumber
> this spec's remaining migrations accordingly at implementation time); rebate accrual
> gets **no SMS of its own** — the balance is appended to the order confirmation text;
> admin grants DO text the customer; ledger reason set is
> `rebate | redemption | admin_grant` with per-order idempotency indexes.
>
> After the tiers-v2 recompute migration is live, set `CREDIT_REBATE_ENABLED` so
> rebates start accruing against the corrected tier meanings.
>
> The original section is kept below for context only.

Elvet earns **5%**, Palatine earns **10%** of what they pay, credited to a balance the
member chooses when to spend.

### 3a. Schema — `045_credit_balance.sql`

```sql
alter table customers
  add column credit_balance_pence integer not null default 0;

create table credit_ledger (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  delta_pence integer not null,          -- positive = rebate earned, negative = spent
  reason text not null,                  -- 'rebate' | 'redemption' | 'admin_adjust'
  order_id uuid references orders(id),
  balance_after_pence integer not null,
  created_at timestamptz default now()
);
create index on credit_ledger (customer_id, created_at);
```

`customers.credit_balance_pence` is the fast-read balance; `credit_ledger` is the audit
trail. Always update both in the same transaction.

### 3b. Earning rebate

When an order charge **succeeds** (the `order_status = 'confirmed'` path — same place
`handlePostCharge` is called from in `app/api/webhooks/twilio/inbound/route.ts`, and the
Stripe webhook path), after the charge:

- Determine the member's **current tier** (post-charge, so a fresh upgrade counts).
- `rebatePct = tier === 'palatine' ? 0.10 : tier === 'elvet' ? 0.05 : 0`.
- `rebatePence = round(amountPaidOnCard * rebatePct)`. **Rebate is earned on the amount
  actually PAID (card + credit)? Decision: earn rebate on the full order value**
  (`orders.total_pence`), regardless of whether they paid by card or credit, so credit
  redemption doesn't erode earning. (Flag if you think double-earning on redeemed credit
  is a concern; default is earn on full order value.)
- Insert a `credit_ledger` row (`reason='rebate'`, `order_id`) and increment
  `credit_balance_pence`, atomically.
- Fire-and-forget; never block order confirmation on rebate failure (log + continue).

### 3c. Spending credit — the BALANCE / CARD choice

Today an order confirms when the member replies **YES** and the card is charged (Twilio
inbound handler, ~line 359 / 906 `paymentIntents.create`). Add a credit branch:

**At the confirmation step, if `credit_balance_pence > 0`,** the confirmation prompt
changes. Instead of the usual "reply YES", send:

> You have £X.XX credit. Reply BALANCE to use it, or CARD to pay by card.

(Keep normal YES flow when balance is 0.)

Handle the new inbound keywords in the Twilio inbound route, matching the existing
keyword style:

- **CARD** → proceed with the existing card-charge flow unchanged. No credit used.
- **BALANCE** → apply credit:
  - If `credit_balance_pence >= order.total_pence`: cover the whole order from credit.
    Charge £0 to card. Decrement balance by `order.total_pence`, ledger row
    `reason='redemption'`, negative delta.
  - If `credit_balance_pence < order.total_pence`: use the **full balance** + charge the
    **remainder** to card (`order.total_pence - credit_balance_pence`) via the normal
    Stripe path. Set balance to 0, ledger `reason='redemption'` for the used amount.
  - Then continue the existing confirm path (`order_status='confirmed'`, `handlePostCharge`,
    etc.).
  - Edge: if the card charge for the remainder fails, do NOT consume the credit — treat
    as a failed order exactly like today's failed-card path, leave balance untouched.

Keep the single-YES-confirmation principle intact: BALANCE/CARD is the explicit
confirmation (it's an affirmative action to place the order), so no separate YES needed
after. Confirm this reads cleanly in the flow; if the existing code hard-requires the
literal token YES somewhere downstream, treat BALANCE and CARD as YES-equivalents for
that order.

### 3d. Texting BALANCE any time

Add a standalone **BALANCE** keyword (when not mid-order): reply with
> Your Cellar Club credit balance is £X.XX.

### 3e. Portal display

Show the member's credit balance in the customer portal (wherever account/tier info
lives). Also surface their tier and progress to the next tier (cases to go) if easy.

---

## 4. Choose-your-gift (Elvet & Palatine)

Reuse the lightweight approach — no heavy menu engine needed:

### Schema — `046_tier_gifts.sql`

```sql
create table tier_gift_selections (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  tier text not null,                    -- 'elvet' | 'palatine'
  cycle_year integer not null,           -- year of the tier cycle (from anniversary) this gift belongs to
  gift_choice text,                      -- e.g. 'tasting_tickets' | 'riedel' | 'coravin'; null until chosen
  chosen_at timestamptz,
  fulfilled_at timestamptz,
  fulfilled_by uuid references admin_users(id),
  notes text,
  created_at timestamptz default now(),
  unique (customer_id, tier, cycle_year)
);
```

- When a member reaches Elvet or Palatine (the upgrade in `checkAndApplyTierUpgrade`),
  create a `tier_gift_selections` row for that tier + current cycle year with
  `gift_choice = null` and notify admin (`notifyAdmin()`).
- The congrats SMS tells them Daniel will confirm their gift choice. **v1 = admin records
  the choice** (Daniel asks, sets `gift_choice`), plus a fulfilment view (below). A
  member-facing self-select in the portal is a nice-to-have fast follow, not required.
- Gift options by tier (hardcode as constants; Daniel can edit later):
  - Elvet: `tasting_tickets` (2) **or** `riedel` (4 glasses)
  - Palatine: `tasting_tickets` (4) **or** `coravin`

### Admin fulfilment view

A simple admin list of `tier_gift_selections where fulfilled_at is null`, showing
customer, tier, chosen gift (or "not yet chosen"), with a button to set `gift_choice`
and to mark fulfilled (`fulfilled_at`, `fulfilled_by`). This is the operational queue so
no earned gift is forgotten.

---

## 5. Anniversary reset (soft demote)

On each member's first-purchase anniversary (drive from `tier_review_at`, likely via the
existing tier-review cron):

- Recompute the **new cycle's** rolling case count (resets to count only the new year's
  cases going forward).
- **Soft-demote by one rank** as a floor, based on where they were:
  - `palatine → elvet`
  - `elvet → bailey`
  - `bailey → bailey` (entry tier is never stripped once earned)
  - `none → none`
- Ongoing perks (rebate %, delivery fee, early access) follow the **current** tier, so a
  demoted member must re-climb to restore the higher rebate. They keep whatever
  `credit_balance_pence` they've accrued — balance is never reset.
- **Gifts already received are kept.** Do not claw back.
- Re-climbing in a new cycle earns a **new gift of similar value** at that tier — handled
  naturally because §4 keys gift rows on `(customer_id, tier, cycle_year)`, so hitting the
  tier again in a new `cycle_year` creates a fresh selection row.
- Set the next `tier_review_at` to the following anniversary.

Reword any existing downgrade SMS to reflect a gentle "new year" framing rather than a
punitive demotion, and to use the correct new display names.

---

## 6. Palatine early access (2 hrs early on wine texts)

When a wine campaign is sent (the offer-send path), Palatine members should receive the
text ~2 hours before everyone else.

- Simplest implementation: when sending an offer, send to `tier='palatine'` recipients
  first, then schedule/delay the send to all other tiers by 2 hours. If the send is a
  single batch job, split into two passes with a delay, or add a `send_after` concept.
- Confirm how offers are currently sent (`app/api/admin/customers/[id]/send-offer` and
  the broader campaign send) before choosing the mechanism; flag if a scheduler doesn't
  exist and a simpler "Palatine batch first, main batch 2h later" manual/cron split is
  preferable for v1.

---

## 7. Out of scope

- No enforcement/metering of concierge or wine-request counts (display only).
- No member-facing gift self-select required in v1 (admin records choice).
- Bulk campaign tooling for credits is not needed.

## Files (anticipated — verify against repo)

- `lib/tiers.ts` — case-based assignment, new rank map, congrats SMS wording
- `supabase/migrations/044_tier_v2_recompute.sql`, `045_credit_balance.sql`,
  `046_tier_gifts.sql` (verify latest migration number first)
- `app/api/webhooks/twilio/inbound/route.ts` — BALANCE/CARD keywords, balance-aware
  confirmation prompt, standalone BALANCE
- `lib/post-charge.ts` and/or Stripe webhook — accrue rebate on confirmed charge
- Order charge/redemption logic — apply credit then card for remainder
- Admin — gift fulfilment queue
- Customer portal — credit balance + tier display
- Offer-send path — Palatine 2-hours-early
- Tier-review cron — soft-demote reset

## Verification

- A customer with 0/1/3/6 cases resolves to none/bailey/elvet/palatine respectively.
- Elvet order pays → 5% of order value lands in `credit_balance_pence` + a `credit_ledger`
  rebate row; Palatine → 10%.
- Order with balance > 0: confirmation prompt offers BALANCE/CARD. BALANCE with
  sufficient credit charges £0 and decrements; BALANCE with partial credit uses full
  balance + charges remainder; failed remainder charge leaves balance untouched.
- Texting BALANCE returns the correct figure.
- Reaching Elvet/Palatine creates a gift selection row + admin notification; fulfilment
  view lets Daniel record and mark done.
- On anniversary, a Palatine member with a quiet year drops to Elvet, keeps their credit
  and past gift, and can earn a new gift on re-climb.
- Portal shows correct balance and tier.
