# Claude Code Prompt — Order Confirmation Flow + 3-Month Case Rule

Reference the full build spec at `winetexts-build-spec.md` throughout this task. This prompt covers:
1. Database migration (migration_006)
2. Order confirmation flow rework
3. Post-charge scenario logic (below/at/over 12 bottles)
4. 3-month case nudge + auto-ship cron job
5. Manual add stock check fix

---

## 1. Database Migration — migration_006

Create `/supabase/migrations/006_order_confirmation_and_case_timer.sql`.

### Orders table — add two columns:
```sql
alter table orders
  add column if not exists order_status text not null default 'awaiting_confirmation',
  add column if not exists confirmation_expires_at timestamptz;

-- Update existing rows to 'confirmed' (all pre-existing orders were processed immediately)
update orders set order_status = 'confirmed' where order_status = 'awaiting_confirmation';
```

### Customers table — add three columns:
```sql
alter table customers
  add column if not exists case_started_at timestamptz,
  add column if not exists case_nudge_1_sent_at timestamptz,
  add column if not exists case_nudge_2_sent_at timestamptz;
```

### Shipments table — ensure shipping_fee_pence column exists (may have been added in a prior migration):
```sql
alter table shipments
  add column if not exists shipping_fee_pence int not null default 0;
```

Run this migration in Supabase SQL editor and confirm it runs cleanly before proceeding.

---

## 2. Order Confirmation Flow Rework

Rework `POST /api/webhooks/twilio/inbound`.

### When a customer replies with a number (e.g. "2"):

**Do NOT charge the card.** Instead:

1. Find most recent `texts` row — the active offer. If none: reply "No wine available yet — watch this space!"
2. Check for an existing pending order: if an `orders` row exists where `customer_id` matches AND `order_status = 'awaiting_confirmation'`:
   - Set that order's `order_status = 'cancelled'`
   - Release its reserved stock: `wines.stock_bottles += cancelled_order.quantity`
3. Check for an already-confirmed order on this text: if `orders` row exists where `customer_id` matches AND `text_id` matches AND `order_status = 'confirmed'`:
   - Reply: "You've already ordered from this one! Your bottles are safely in the cellar."
   - Stop.
4. Stock check: `wines.stock_bottles >= quantity`. If not:
   - Reply: "Gutted — we only have [n] bottles left of that one. Reply [n] to grab them."
   - Stop.
5. Max cap: if quantity > MAX_BOTTLES_PER_ORDER (default 12):
   - Reply: "We cap orders at [max] bottles per text — reply [max] if you'd like the maximum."
   - Stop.
6. Reserve stock: `wines.stock_bottles -= quantity`
7. Insert `orders` row:
   ```
   order_status: 'awaiting_confirmation'
   confirmation_expires_at: now() + interval '10 minutes'
   stripe_charge_status: 'pending'
   quantity, price_pence, total_pence (snapshotted)
   ```
8. Reply:
   ```
   Got it — [n] x [wine name] at £[price]/bottle = £[total].
   Reply YES to confirm and pay, or ignore to cancel.
   ```

### When a customer replies "YES":

1. Find order where `customer_id` matches AND `order_status = 'awaiting_confirmation'`
2. If none: reply "No pending order to confirm — just reply with a number when you see our next text." Stop.
3. Check expiry: if `confirmation_expires_at < now()`:
   - Set `order_status = 'expired'`
   - Release stock: `wines.stock_bottles += order.quantity`
   - Reply: "That one timed out — reply with a number to start a new order."
   - Stop.
4. Attempt Stripe charge:
   ```js
   stripe.paymentIntents.create({
     amount: order.total_pence,
     currency: 'gbp',
     customer: customer.stripe_customer_id,
     payment_method: customer.stripe_payment_method_id,
     off_session: true,
     confirm: true,
   })
   ```
5. **If succeeded:**
   - Update order: `order_status = 'confirmed'`, `stripe_charge_status = 'succeeded'`, `stripe_payment_intent_id`
   - Insert `cellar` row(s) for the quantity ordered
   - If `customer.case_started_at IS NULL`: set `case_started_at = now()`
   - Run post-charge scenario logic (see Section 3)
6. **If requires_action (3DS):**
   - Update order: `stripe_charge_status = 'requires_action'`
   - Note: do NOT set order_status to 'confirmed' yet — leave as 'awaiting_confirmation' until 3DS completes
   - Generate signed token
   - Reply: "We need you to verify this payment. Visit [NEXT_PUBLIC_APP_URL]/authenticate?token=[token]"
7. **If failed:**
   - Update order: `order_status = 'confirmed'`, `stripe_charge_status = 'failed'`
   - Release stock: `wines.stock_bottles += order.quantity`
   - Reply: "Your payment didn't go through. Update your card at [NEXT_PUBLIC_APP_URL]/billing and try again."

---

## 3. Post-Charge Scenario Logic

Extract this into a helper function `handlePostChargeScenario(customerId, newCellarItems)` so it can be reused from both the inbound webhook and the Stripe webhook handler (`payment_intent.succeeded` for 3DS completions).

After a successful charge, calculate:
- `newTotal` = total unshipped cellar bottles for this customer (after inserting the new rows)
- `caseDeadline` = customer.case_started_at + 90 days (format as "15 June")

**Scenario 1 — newTotal < 12:**
```
Done — [n] x [wine name] in the cellar. You've now got [newTotal] bottles.

Fill your case by [caseDeadline] for free shipping — or reply SHIP anytime to send early for £15.
```

**Scenario 2 — newTotal === 12:**
- Fetch all unshipped cellar rows for this customer with wine names
- Reset case timer: `case_started_at = NULL`, `case_nudge_1_sent_at = NULL`, `case_nudge_2_sent_at = NULL`
```
Done — your cellar just hit 12! Here's what you've got:

[2x Wine A — £X/bottle]
[1x Wine B — £X/bottle]

Reply SHIP to arrange your free case. Or reply PAUSE to hold it.
```

**Scenario 3 — newTotal > 12:**
- Pull the oldest 12 unshipped cellar rows by `added_at` ASC. Where a single cellar row has quantity > 1, split it if needed to reach exactly 12 bottles (e.g. if a row has quantity 3 and you only need 2 more to reach 12, split it into quantity 2 + quantity 1).
- Create a `shipments` row for those 12 bottles (`bottle_count: 12`, `shipping_fee_pence: 0`, status: 'pending')
- Mark those cellar rows with `shipment_id` and `shipped_at = now()`
- `remaining` = newTotal - 12
- Reset case timer for the new case: `case_started_at = now()`, `case_nudge_1_sent_at = NULL`, `case_nudge_2_sent_at = NULL`
```
Done — and you've hit 12! We've split your order: your oldest 12 bottles are being shipped (free), and [remaining] start your next case.

Case ready to ship:
[2x Wine A — £X/bottle]
[1x Wine B — £X/bottle]

Reply SHIP to arrange delivery, or PAUSE to hold it.
```

---

## 4. 3-Month Case Nudge + Auto-Ship Cron Job

### 4a. vercel.json

Create or update `vercel.json` in the project root:
```json
{
  "crons": [
    {
      "path": "/api/cron/case-nudges",
      "schedule": "0 9 * * *"
    }
  ]
}
```

### 4b. Add CRON_SECRET to env vars

Add `CRON_SECRET` to `.env.local` (any random string) and to Vercel environment variables.

### 4c. Create GET /api/cron/case-nudges

Secure this route: verify `Authorization` header matches `Bearer ${process.env.CRON_SECRET}`. Return 401 if not.

Logic:
```
1. Fetch all customers where active = true AND case_started_at IS NOT NULL
2. For each customer:
   a. Calculate daysSinceCase = (now - case_started_at) in days
   b. Get current cellar total (unshipped)
   c. If daysSinceCase >= 104 AND case_nudge_2_sent_at IS NOT NULL:
      → AUTO-SHIP (see below)
   d. Else if daysSinceCase >= 90 AND case_nudge_2_sent_at IS NULL:
      → Send Nudge 2 (see below)
   e. Else if daysSinceCase >= 75 AND case_nudge_1_sent_at IS NULL:
      → Send Nudge 1 (see below)
3. Log summary of actions taken
```

**Nudge 1 (day 75):**
```
You've got [n] bottles in your cellar. Your case needs to be full by [case_started_at + 90 days] for free shipping.

Want to send early? Reply SHIP and we'll post what you've got for £15.
```
Then: `case_nudge_1_sent_at = now()`

**Nudge 2 (day 90):**
```
Last chance — you've got [n] bottles and your case closes in 2 weeks. We'll ship automatically on [case_started_at + 104 days] for £15.

Reply SHIP CONFIRM to send now, or keep topping up for free shipping.
```
Then: `case_nudge_2_sent_at = now()`

**Auto-ship (day 104+):**
1. Charge £15 via Stripe:
   ```js
   stripe.paymentIntents.create({
     amount: 1500,
     currency: 'gbp',
     customer: customer.stripe_customer_id,
     payment_method: customer.stripe_payment_method_id,
     off_session: true,
     confirm: true,
     metadata: { type: 'case_auto_ship', customer_id: customer.id }
   })
   ```
2. If charge succeeds:
   - Create `shipments` row: `bottle_count` = cellar total, `shipping_fee_pence: 1500`, status: 'pending'
   - Mark all unshipped cellar rows with `shipment_id` + `shipped_at = now()`
   - Reset case timer: `case_started_at = NULL`, `case_nudge_1_sent_at = NULL`, `case_nudge_2_sent_at = NULL`
   - SMS:
     ```
     Time's up — we've popped your [n] bottles in the post and charged £15 for shipping. You'll get a tracking number shortly.
     ```
3. If charge fails:
   - Do NOT ship
   - SMS:
     ```
     We tried to ship your case but the payment didn't go through. Update your card at [url]/billing and reply SHIP CONFIRM to try again.
     ```
   - Leave case_started_at and nudge timestamps as-is (don't retry automatically — wait for customer to fix card)

---

## 5. Manual Add Stock Check Fix

In the admin manual add endpoint (`/api/admin/customers/[id]/add-bottles` or wherever the manual add is handled):

Before inserting into `cellar`:
1. Fetch `wines.stock_bottles` for the selected wine
2. If `stock_bottles < quantity`: return a 400 error with message "Insufficient stock — only [n] bottles available"
3. If sufficient: proceed with cellar insert AND `wines.stock_bottles -= quantity`

The admin UI should display this error clearly on the manual add form.

---

## Summary of files to create/modify

- `supabase/migrations/006_order_confirmation_and_case_timer.sql` — new
- `src/app/api/webhooks/twilio/inbound/route.ts` — major rework
- `src/lib/post-charge-scenario.ts` (or similar) — new helper
- `src/app/api/cron/case-nudges/route.ts` — new
- `vercel.json` — add crons config
- `src/app/api/admin/customers/[id]/add-bottles/route.ts` — add stock check
- `.env.local` + Vercel env vars — add `CRON_SECRET`

---

*Spec reference: winetexts-build-spec.md — Sections 4, 7, 7b*
