# Spec: Credit wallet — one-time credits + tier rebates

## Status & relationship to other specs

This is the **canonical spec for all store-credit functionality**. It supersedes §3
(rebate wallet) of the now-superseded `claude-code-prompt-tiers-v2.md` — where any tier
spec conflicts with this document on credit mechanics, **this document wins**.
**`claude-code-prompt-tiers-v3.md`** is canonical for everything else (ladder,
milestones, anniversary reset, early access) and defines the rebate percentages this
spec applies.

This spec is designed to ship **before and independently of** tiers-v3. See §4a for the
one hard dependency (rebate percentages keyed on tier meanings that only become correct
after the tiers-v3 recompute) and the kill-switch that handles it.

**This is money. Treat every invariant in §2 as non-negotiable. If anything here is
ambiguous, ask Julia — do not guess.**

---

## 1. What we're building

Two ways credit is added, one way it's spent:

1. **One-time credits** — an admin grants credit from the admin panel (refund goodwill,
   promotions, compensation). Customer gets an SMS when this happens.
2. **Tier rebates** — Elvet members earn 5%, Palatine 10% of each confirmed order's
   value as credit, automatically. **No SMS of its own** — the running balance is simply
   included in the order confirmation text (§4c).

Spending: at order confirmation, a member with credit chooses to use it. Using it
**always consumes the full available balance first**, with any remainder charged to
card. Members can text **BALANCE** any time to check their balance.

Members can **never modify their own balance** — the only decrement path is redemption
during a purchase; the only increments are the rebate hook and the admin grant route.

---

## 2. Security invariants (read first, enforce everywhere)

1. **No customer-facing mutation surface.** No portal route, webhook branch, or API
   endpoint reachable by a customer may write `credit_balance_pence` or insert
   `credit_ledger` rows, except the redemption path inside the server-side charge flow.
   The portal shows balance read-only.
2. **Ledger is append-only.** No UPDATE or DELETE on `credit_ledger`, ever. Corrections
   are new rows.
3. **Balance and ledger move together, atomically.** All mutations go through a single
   Postgres function (§3b) that updates `customers.credit_balance_pence` and inserts the
   ledger row in one transaction, and raises if the resulting balance would be negative.
   Never update the balance column directly from application code.
4. **Balance can never go negative.** DB-level CHECK constraint plus the function guard.
5. **Credit is only consumed on success.** If the card charge for a remainder fails
   (declined, 3DS abandoned), the balance is untouched — the order fails exactly like
   today's failed-card path.
6. **Redemption is idempotent per order.** At most one `redemption` ledger row per
   order (partial unique index, §3a) so webhook retries / double-submits can't
   double-spend.
7. **Rebate is idempotent per order.** Same mechanism — at most one `rebate` row per
   order.
8. **Admin grants require an authenticated admin session, a positive integer pence
   amount, and a non-empty reason.** The grant records which admin did it. Rejected
   otherwise — no silent defaults.
9. **All amounts are integer pence** end to end. No floats anywhere.

---

## 3. Schema — migration `043_credit_wallet.sql`

Latest applied migration is `042_free_shipping_at_6_flag.sql` — verify with
`ls supabase/migrations/` before numbering; use the next free number if 043 is taken.
(Note: tiers-v2 reserved `045_credit_balance.sql` for this schema — that is superseded;
this migration replaces it and tiers-v2's remaining migrations renumber around it.)

### 3a. Tables

```sql
alter table customers
  add column credit_balance_pence integer not null default 0
    check (credit_balance_pence >= 0);

alter table orders
  add column credit_used_pence integer not null default 0
    check (credit_used_pence >= 0);

create table credit_ledger (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  delta_pence integer not null check (delta_pence <> 0),
  reason text not null check (reason in ('rebate', 'redemption', 'admin_grant')),
  note text,                              -- required (app-enforced) for admin_grant
  order_id uuid references orders(id),
  created_by uuid references admin_users(id),  -- set for admin_grant, null otherwise
  balance_after_pence integer not null check (balance_after_pence >= 0),
  created_at timestamptz not null default now()
);

create index on credit_ledger (customer_id, created_at desc);

-- Idempotency: at most one rebate and one redemption per order
create unique index credit_ledger_one_rebate_per_order
  on credit_ledger (order_id) where reason = 'rebate';
create unique index credit_ledger_one_redemption_per_order
  on credit_ledger (order_id) where reason = 'redemption';
```

Sign convention: `rebate` and `admin_grant` are positive deltas; `redemption` is
negative.

### 3b. The single mutation path — `apply_credit()`

```sql
create or replace function apply_credit(
  p_customer_id uuid,
  p_delta_pence integer,
  p_reason text,
  p_note text default null,
  p_order_id uuid default null,
  p_created_by uuid default null
) returns integer  -- new balance in pence
language plpgsql as $$
declare
  v_new_balance integer;
begin
  update customers
    set credit_balance_pence = credit_balance_pence + p_delta_pence
    where id = p_customer_id
    returning credit_balance_pence into v_new_balance;

  if v_new_balance is null then
    raise exception 'customer not found';
  end if;
  -- CHECK constraint raises if v_new_balance < 0

  insert into credit_ledger
    (customer_id, delta_pence, reason, note, order_id, created_by, balance_after_pence)
  values
    (p_customer_id, p_delta_pence, p_reason, p_note, p_order_id, p_created_by, v_new_balance);

  return v_new_balance;
end $$;
```

Application code calls this via `sb.rpc('apply_credit', {...})` — **nothing else writes
the balance or the ledger.** Add a thin typed wrapper in a new `lib/credit.ts`
(`grantCredit`, `accrueRebate`, `redeemCredit`, `getBalance`) so call sites stay tidy.

---

## 4. Earning credit

### 4a. Tier rebate — accrue in `handlePostCharge`

All three charge-success paths (Twilio YES inline charge, Stripe webhook 3DS
completion, `/api/authenticate/confirm`) already funnel into
`handlePostCharge` (`lib/post-charge.ts`). The payment-retry cron never charges — it
only nudges/cancels — so `handlePostCharge` is the single choke point. Accrue there,
**before** `checkAndApplyTierUpgrade` runs (or read the tier before the upgrade check
and use that): **an order earns rebate at the tier the customer held coming INTO the
order.** The order that completes your 2nd case earns 0%; the next order earns 5%; the
order that lifts you to Elvet earns 5%, subsequent ones 10%. (Julia's explicit rule —
rebate applies only to spend after the threshold was reached.)

- Add `rebatePctForTier(tier)` to `lib/tiers.ts`, per the tiers-v3 ladder:
  `palatine → 0.10`, `elvet → 0.10`, `bailey → 0.05`, else `0`.
- `rebatePence = Math.round(order.total_pence * pct)` — earned on the **full order
  value** (`orders.total_pence`), regardless of how it was paid (card, credit, or mix).
  This is a deliberate decision carried over from tiers-v2 §3b: credit redemption must
  not erode earning.
- Call `apply_credit(customerId, rebatePence, 'rebate', null, orderId)`. The unique
  index makes retries safe — swallow a unique-violation as "already accrued".
- **Fire-and-forget**: wrap in try/catch, log on failure, never block order
  confirmation or the cellar insert.

**⚠️ Hard dependency / kill-switch:** rebate percentages assume the **tiers-v3 tier
meanings** (bailey = entry at 2 cases, elvet = mid at 4, palatine = top at 6 — see
`claude-code-prompt-tiers-v3.md`). The live `lib/tiers.ts` is still spend-based with
the OLD meanings (elvet is currently the entry tier). If this spec is implemented
before tiers-v3's recompute migration has run, accruing against current tier strings
would pay the wrong people at the wrong rates. Therefore: gate accrual behind env var
**`CREDIT_REBATE_ENABLED`** (default: unset/off — accrual silently no-ops). Flip it on
only after the tiers-v3 recompute is live. Everything else in this spec (grants,
redemption, BALANCE) works immediately regardless of tier state.

### 4b. Admin one-time grant

**API:** new route `app/api/admin/customers/[id]/credit/route.ts` —
`POST { amountPence: number, reason: string }`.

- `requireAdminSession()` from `lib/adminAuth.ts` at the top, per house convention.
- Validate: `amountPence` is a positive integer; `reason` is a non-empty trimmed
  string. 400 otherwise. (Positive only — there are deliberately **no negative
  adjustments** in v1; a mistaken grant is corrected via direct DB access by Julia.)
- Call `apply_credit(customerId, amountPence, 'admin_grant', reason, null, session.user.id)`.
- Log to `inbox_activity`: `action: 'credit_granted'`, `actor_id: session.user.id`,
  detail includes amount + reason. Add `credit_granted` to the `describeAction` map in
  `InboxClientView.tsx` (same pattern as `free_shipping_at_6_set`).
- **SMS the customer** (this is the one credit event that gets its own text):

  > £X.XX credit has been added to your Cellar Club account. It'll be offered against
  > your next order — reply BALANCE any time to check.

  Send via `sendSms()` with `sanitiseGsm7`, trigger `admin:credit-grant`. SMS failure
  must not roll back the grant (log + continue).

**UI:** add a small "Grant credit" control to the **Admin tools** section of
`app/admin/(protected)/customers/[id]/page.tsx` (next to `DeactivateButton` /
`FreeShippingAt6Toggle`, same visual pattern). Amount input (pounds, converted to pence),
required reason field, confirm click. Also display current balance and the last few
ledger entries (read-only) on the customer detail page so admins can see history.

### 4c. Balance in the order confirmation SMS

In `handlePostCharge`, after rebate accrual, fetch the (fresh) balance. If it's **> 0**,
append a final line to whichever scenario SMS is sent (Scenario 1 cellar-update,
Scenario 2 case-complete, Scenario 3 case-ready):

> Credit balance: £X.XX

No separate rebate SMS. When balance is 0, append nothing — messages stay exactly as
today.

---

## 5. Spending credit — BALANCE / CARD at order confirmation

Today: member replies **YES** to a pending order → card is charged inline
(`handleYes` in `app/api/webhooks/twilio/inbound/route.ts`). Change:

### 5a. YES with credit available

In `handleYes`, after the pending-order and card guards but **before** creating the
PaymentIntent: fetch `credit_balance_pence`. If **> 0**, do NOT charge. Reply:

> You have £X.XX credit. Reply BALANCE to use it (any leftover goes on your card), or
> CARD to pay by card only.

and stop. If balance is 0, the YES flow is completely unchanged.

This preserves the single-affirmative-gate principle: nothing is ever charged without
an explicit final keyword from the customer. BALANCE/CARD **is** that affirmative for
credit-holding members — no additional YES after.

### 5b. New keywords in the inbound router

Match the existing keyword style (lowercased `keyword ===` checks in the main router):

- **`card`** (pending order exists) → run the existing charge flow unchanged.
  `credit_used_pence` stays 0.
- **`balance`** (pending order exists) → redemption flow (§5c).
- **`balance`** (no pending order) → standalone balance check (§6).
- **`card`** (no pending order) → ignore / fall through to existing unknown-keyword
  handling.
- Edge: `balance` with a pending order but `credit_balance_pence = 0` (e.g. spent it in
  the gap) → treat exactly as CARD, with a one-line note in the SMS that no credit was
  available.
- Apply the same expiry/stock guards `handleYes` runs before charging (reuse, don't
  duplicate: extract the guard section or route BALANCE/CARD through `handleYes` with a
  payment-mode parameter — implementer's choice, but the guards must run).

### 5c. Redemption flow (BALANCE with a pending order)

Let `balance = credit_balance_pence`, `total = order.total_pence`.
`creditToUse = min(balance, total)` — **always the full available balance, capped at
the order total**. `remainder = total - creditToUse`.

**Case 1 — credit covers everything (`remainder === 0`):**

1. Call `apply_credit(customerId, -creditToUse, 'redemption', null, orderId)`.
2. On success: set `orders.credit_used_pence = creditToUse`,
   `order_status = 'confirmed'`, `stripe_charge_status = null` (no PI — nothing hit the
   card), then call `handlePostCharge` as the YES path does.
3. No Stripe call at all.

**Case 2 — partial credit (`remainder > 0`):**

1. Set `orders.credit_used_pence = creditToUse` (intent, recorded up-front so the 3DS
   path knows the split).
2. Create the PaymentIntent for **`remainder`** (not `total`) via the existing inline
   charge code, same error handling.
3. **Only after the charge succeeds** (inline success, or later via the Stripe
   webhook / `authenticate/confirm` for 3DS): call
   `apply_credit(customerId, -creditToUse, 'redemption', null, orderId)`, then proceed
   to confirmed + `handlePostCharge`. The natural place is immediately before
   `handlePostCharge` in each success path — or at the top of `handlePostCharge` itself
   (reading `order.credit_used_pence > 0`), which covers all three paths in one place.
   The unique index makes it idempotent either way.
4. **Charge fails** (declined): behave exactly like today's failed-card path
   (payment_failed, retry SMS). Credit untouched. On a later retry (YES again), re-run
   §5a from scratch — recompute the split against the **current** balance and overwrite
   `credit_used_pence`; never trust a stale split.
5. **3DS abandoned**: order stays `requires_action` as today; credit untouched because
   the deduction only happens on success.
6. **Race guard**: if the deduction in step 3 fails because the balance shrank between
   BALANCE and 3DS completion (rare), deduct what's available instead
   (`min(current_balance, creditToUse)`), update `orders.credit_used_pence` to match,
   `notifyAdmin()` with the discrepancy, and still confirm the order — the customer
   authorised the payment; we absorb the small shortfall rather than failing a charged
   order.

Confirmation SMS afterwards comes from `handlePostCharge` as normal, including the
remaining-balance line (§4c) — after a full redemption the balance is likely 0, so
usually no line, which is correct.

**Out of scope:** credit does NOT apply to the £10 early-ship fee in the SHIP CONFIRM
flow, or to any non-order payment. Wine orders only, v1. (Flag to Julia if this feels
inconsistent during implementation — do not extend scope unilaterally.)

---

## 6. Standalone BALANCE keyword

When `balance` arrives with no pending order:

> Your Cellar Club credit balance is £X.XX.

(£0.00 is a fine answer.) Trigger `keyword:balance`. Place it in the main keyword
router with the others (`cellar`, `status`, etc.).

---

## 7. Portal display

On `app/portal/dashboard/page.tsx`, show the credit balance (read-only) wherever
account/tier info renders. A single "Credit: £X.XX" line is enough — no ledger, no
controls. (Tier progress display remains tiers-v2's concern.)

---

## 8. Files (anticipated — verify against repo)

- `supabase/migrations/043_credit_wallet.sql` — schema + `apply_credit()` (§3)
- `lib/credit.ts` — new; typed wrappers around the RPC
- `lib/tiers.ts` — add `rebatePctForTier()`
- `lib/post-charge.ts` — rebate accrual, redemption consumption (if choke-point option
  chosen), balance line on scenario SMS
- `app/api/webhooks/twilio/inbound/route.ts` — YES credit branch, BALANCE/CARD
  keywords, standalone BALANCE
- `app/api/webhooks/stripe/route.ts` + `app/api/authenticate/confirm/route.ts` — credit
  deduction on 3DS success (unless done inside `handlePostCharge`)
- `app/api/admin/customers/[id]/credit/route.ts` — new; admin grant
- `app/admin/(protected)/customers/[id]/page.tsx` + a new
  `app/admin/_components/GrantCreditControl.tsx` — grant UI + balance/ledger display
- `app/admin/_components/InboxClientView.tsx` — `credit_granted` in `describeAction`
- `app/portal/dashboard/page.tsx` — balance display
- Env: `CREDIT_REBATE_ENABLED` (default off)

## 9. Verification

- `apply_credit` with a delta that would go negative raises; balance + ledger row are
  always consistent; ledger rows are never updated or deleted.
- Admin grant: rejects missing/empty reason, zero, negative, and non-integer amounts;
  records admin id; customer receives the grant SMS; `inbox_activity` row appears;
  control renders on the customer page.
- Rebate: with `CREDIT_REBATE_ENABLED` off, a confirmed order accrues nothing. On, a
  £100.00 order from a bailey customer adds 500 pence (`rebate` ledger row, order_id
  set); elvet/palatine 10%; none accrues nothing. Rate is the tier held BEFORE the
  order: the order completing a customer's 2nd case earns 0%, their next earns 5%.
  Replaying the same order accrues nothing (idempotent). No rebate SMS is sent.
- Confirmation SMS: balance > 0 appends "Credit balance: £X.XX" in all three
  post-charge scenarios; balance = 0 leaves messages byte-identical to today.
- YES with balance 0: flow byte-identical to today. YES with balance > 0: no charge,
  BALANCE/CARD prompt sent.
- CARD: charges full total, credit untouched. BALANCE with credit ≥ total: order
  confirmed, no Stripe PI, balance decremented by total, `credit_used_pence` correct.
  BALANCE with partial credit: PI for the remainder only; balance hits 0 on success.
- Failed remainder charge / abandoned 3DS: balance untouched, order in the usual failed
  state; retry recomputes the split.
- Standalone BALANCE returns the right figure; BALANCE mid-order with 0 balance behaves
  as CARD.
- Attempt to find any customer-reachable path that mutates balance other than
  redemption: there must be none.
