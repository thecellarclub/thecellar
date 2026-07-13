# Spec: Admin Manual Offer — Send a Custom Order Confirmation from the Customer Page

## Context

Today every order starts from a broadcast: admin sends a text blast to all active members, a customer replies with a quantity, and the normal pending-order → YES → charge flow kicks in. But there's no way to send a one-off offer to a single customer — e.g. a wine they asked about via QUESTION, a special allocation, or a re-offer of something they missed.

This spec adds a "Send offer" form to the individual customer page in admin (`/admin/customers/[id]`). The admin selects one or more wines with quantities, clicks Send, and the customer receives an SMS with an order summary and the usual "Reply YES to confirm" instruction. From the customer's perspective it's identical to the broadcast flow — they reply YES, get charged, bottles go to cellar.

---

## Goals

1. Admin can send a personalised offer to a single customer without doing a full broadcast.
2. The offer can include **multiple wines** with independent quantities (e.g. 2× Barolo + 1× Chablis).
3. The customer receives one SMS with a clear summary and the standard YES gate.
4. The YES reply triggers the existing `handleYes` flow — no new charge path.
5. Stock is reserved on send, released on expiry — same as broadcast orders.
6. No new tables. Reuse `orders` (one row per wine line).

## Non-Goals

- Changing the broadcast flow or the inbound webhook's keyword router.
- Building a general-purpose "cart" — this is admin-initiated only.
- Letting the customer modify quantities after the SMS is sent (they can reply with a new number to the next broadcast, but this bespoke offer is take-it-or-leave-it).
- Sending to multiple customers at once (that's what broadcast is for).

---

## What Already Exists (REUSE — DO NOT REBUILD)

| Concern | Reuse | Path |
|---|---|---|
| Customer detail page | Add the new form here | `app/admin/(protected)/customers/[id]/page.tsx` |
| Active wines list | Already fetched on the page as `activeWines` | Same file, line ~119 |
| `AddBottlesForm` pattern | Client component with wine picker + qty + API call + `router.refresh()` — use as UI template | `app/admin/_components/AddBottlesForm.tsx` |
| Outbound SMS | `sendSms(to, body, opts?)` with GSM-7 sanitisation | `lib/twilio.ts` |
| Pending order model | `orders` table with `order_status='awaiting_confirmation'`, `confirmation_expires_at` | Schema + inbound webhook |
| Stock reservation | Decrement `wines.stock_bottles` on order create, restore on expiry/failure | Inbound webhook `handlePendingOrder` |
| YES handler | `handleYes` finds the most recent `awaiting_confirmation` order by `customer_id` (not by `text_id`) and charges it | `app/api/webhooks/twilio/inbound/route.ts` |
| Post-charge flow | `handlePostCharge` — cellar insert, tier recalc, shipment trigger | `lib/post-charge.ts` |
| SMS message logging | `sendSms` already logs to `sms_messages` table | `lib/twilio.ts` |

---

## Design Decisions

### Multiple wines → multiple `orders` rows

A manual offer with 3 wines at different quantities creates 3 separate `orders` rows, all with `text_id = NULL`. This is safe because:

- The unique index `orders_customer_text_unique_idx` is on `(customer_id, text_id)`. Postgres treats NULLs as distinct in unique indexes, so multiple NULL-text_id rows per customer are fine.
- `handleYes` already finds orders by `customer_id` + `order_status = 'awaiting_confirmation'`, ordered by `created_at DESC`, limit 1. It doesn't filter by `text_id`.

**But here's the problem:** `handleYes` only processes one order at a time. If we create 3 pending orders and the customer replies YES, only the most recent one gets charged. They'd have to reply YES three times.

**Solution — batch order approach:** Create a single `orders` row that represents the entire offer. This keeps the YES flow working unchanged (one YES = one charge). The order row stores the total across all wines. For cellar tracking (which needs per-wine granularity), we use a new lightweight join table.

Actually, the simpler path: since `handleYes` loops through one order at a time and the customer replies YES once, we should **charge all pending orders in one YES**. But that's a change to `handleYes` that could affect the broadcast flow (where there's only ever one pending order per customer by design).

**Revised solution — keep it simple, one order row per offer:**

For v1, restrict to **one wine per manual offer**. The admin picks a wine and quantity, same shape as a broadcast order. This avoids any changes to `handleYes` and slots cleanly into the existing data model. The form UI can be extended to multi-wine later (see Future Work).

If the admin wants to offer multiple wines, they send multiple offers sequentially — but only after the customer has replied YES (or the previous one expires). The API should reject a send if the customer already has a pending `awaiting_confirmation` order.

### Confirmation expiry

**Always 24 hours**, regardless of card status. Unlike broadcast offers (where everyone gets the SMS at the same time and is likely looking at their phone), manual offers are sent asynchronously — the customer might not see the SMS for hours. A 10-minute window would expire before they even open the message.

- Card on file: 24 hours.
- No card on file: 24 hours (same). The SMS includes a billing link so they can add a card first.

This differs from broadcast orders (10 min with card, 24h without). The broadcast expiry is tight because the customer just replied with a quantity — they're actively engaged. Manual offers are cold sends.

### SMS format

**Customer has a card on file:**
```
Daniel here — I've set aside [qty] x [wine name] for you (£[total]). Reply YES to confirm.
```

**Customer has no card on file:**
```
Daniel here — I've set aside [qty] x [wine name] for you (£[total]). Add your card at [short billing link] then reply YES to confirm.
```

The phrasing "set aside" distinguishes this from a broadcast offer and feels personal. The SMS follows the same GSM-7 / 160-char discipline. Use `generateShortToken()` for the billing link.

### Trigger tag

All SMS sent via this feature use `trigger: 'admin_manual_offer'` so they're distinguishable in the `sms_messages` log and the admin SMS log page.

---

## Required Changes

### 1. New API route: `POST /api/admin/customers/[id]/send-offer`

**Location:** `app/api/admin/customers/[id]/send-offer/route.ts`

**Auth:** Verify NextAuth admin session (same pattern as other admin API routes).

**Request body:**
```ts
{
  wineId: string   // UUID of the wine
  quantity: number  // positive integer
}
```

**Logic:**

1. Validate inputs: `wineId` is a valid UUID, `quantity` is a positive integer.
2. Fetch the customer by `[id]`. Reject if not found or not active.
3. **Guard: no existing pending order.** Query `orders` for this customer with `order_status = 'awaiting_confirmation'`. If one exists, return `409 Conflict` with message: `"Customer already has a pending order. Wait for them to confirm or let it expire."` This prevents stacking multiple pending orders that `handleYes` can't handle in one go.
4. Fetch the wine. Reject if not found or not active.
5. **Stock check:** If `wine.stock_bottles < quantity`, return `400` with `"Insufficient stock. Only [n] bottles available."`.
6. **Reserve stock:** Decrement `wines.stock_bottles` by `quantity`. Use the same non-atomic pattern as the broadcast flow (read current value, update with `current - qty`).
7. **Set confirmation expiry:** Always 24 hours (see Design Decisions above).
8. **Create order row:**
   ```ts
   {
     customer_id: id,
     wine_id: wineId,
     text_id: null,          // no broadcast — this is manual
     quantity,
     price_pence: wine.price_pence,
     total_pence: quantity * wine.price_pence,
     stripe_payment_intent_id: '',
     stripe_charge_status: 'pending',
     order_status: 'awaiting_confirmation',
     confirmation_expires_at: expiresAt,
   }
   ```
   On insert failure → restore stock (same rollback pattern as `handlePendingOrder`).
9. **Mint billing token if no card:**
   ```ts
   if (!customer.stripe_payment_method_id) {
     const billingToken = generateShortToken()
     await sb.from('customers').update({
       billing_token: billingToken,
       billing_token_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
     }).eq('id', customer.id)
   }
   ```
10. **Set `sms_awaiting: 'offer'`** on the customer record. This ensures that if the customer replies with something other than YES or a number (e.g. "will this pair well with lamb"), it gets routed through the offer-context unparseable handler (silent inbox + admin notification) rather than the generic keyword menu.
    ```ts
    await sb.from('customers').update({ sms_awaiting: 'offer' }).eq('id', customer.id)
    ```
11. **Send SMS** via `sendSms(customer.phone, body, { trigger: 'admin_manual_offer', customerId: customer.id })`.
    - Build body using the templates above (card / no-card variant).
    - For the no-card variant, build the short billing URL: `${APP_URL}/b/${billingToken}`.
12. Return `200 { ok: true, orderId }`.

**Error responses:**
- `400` — invalid input, insufficient stock, customer inactive
- `404` — customer or wine not found
- `409` — customer already has a pending order

### 2. New client component: `SendOfferForm`

**Location:** `app/admin/_components/SendOfferForm.tsx`

**Props:**
```ts
{
  customerId: string
  customerName: string   // for the confirmation prompt
  hasCard: boolean       // controls which SMS template preview is shown
  wines: { id: string; name: string; price_pence: number; stock_bottles: number }[]
}
```

**UI (modelled on `AddBottlesForm` but with a confirmation step):**

1. **Wine dropdown** — shows `wine.name` + price (e.g. "Barolo 2019 — £18.00"). Only wines with `stock_bottles > 0`.
2. **Quantity input** — number input, min 1, max capped at selected wine's `stock_bottles`.
3. **SMS preview** — read-only text area showing the exact SMS that will be sent (updates live as wine/qty change). Shows character count and segment count.
4. **"Send offer" button** — on click, shows a confirmation dialog: `"Send order confirmation for [qty] x [wine] (£[total]) to [customerName]?"` with Cancel / Confirm.
5. On confirm → `POST /api/admin/customers/[id]/send-offer` with `{ wineId, quantity }`.
6. On success → show a green "Offer sent" flash message, `router.refresh()` to update the page (so the new pending order appears in the Payments section).
7. On `409` → show the conflict message (pending order exists).
8. On other errors → show the error message from the API.

### 3. Wire the form into the customer detail page

**Location:** `app/admin/(protected)/customers/[id]/page.tsx`

**Changes:**

1. Expand the `activeWines` query to also select `price_pence, stock_bottles`:
   ```ts
   sb.from('wines')
     .select('id, name, price_pence, stock_bottles')
     .eq('active', true)
     .gt('stock_bottles', 0)
     .order('name')
   ```
2. Add a new section below the existing "Admin Tools" section (or wherever feels natural — near the top, after the summary strip, makes sense since it's a primary action):

   ```
   ┌─────────────────────────────────────────┐
   │ Send Offer                              │
   ├─────────────────────────────────────────┤
   │ [Wine dropdown ▾]  [Qty: 1]            │
   │                                         │
   │ SMS preview:                            │
   │ ┌─────────────────────────────────────┐ │
   │ │ Daniel here — I've set aside 2 x   │ │
   │ │ Barolo 2019 for you (£36.00).      │ │
   │ │ Reply YES to confirm.              │ │
   │ └─────────────────────────────────────┘ │
   │ 72 chars · 1 segment                    │
   │                                         │
   │              [Send offer]               │
   └─────────────────────────────────────────┘
   ```

3. Pass `hasCard: !!customer.stripe_payment_method_id` to the form so it can render the correct SMS preview.

### 4. Handle expiry and re-order for manual-offer orders

**Expiry cleanup — already handled.** The `case-nudges` cron already expires stale `awaiting_confirmation` orders daily (finds all where `confirmation_expires_at < NOW()`, marks them `'expired'`, restores stock). This covers both broadcast and manual-offer orders. No changes needed here.

Additionally, `handleYes` checks `confirmation_expires_at` reactively — if a customer replies YES to an expired order, it marks it expired, releases stock, and sends `"Sorry, your order expired. Reply with a number to place a new one."` That message is fine for broadcast orders (there's an active offer to reply to), but misleading for manual offers (there's no active offer — replying with a number would either hit "Nothing live right now" or create an order against the wrong wine).

**The re-order problem:** When a manual offer expires and the customer later replies with a number, `handlePendingOrder` looks up the active *broadcast* text — not the expired manual offer. The customer either gets "Nothing live right now" (no broadcast active) or silently gets an order for the wrong wine (a broadcast is active). Neither is correct.

**Fix — don't try to auto-recover manual offer expiry.** The expiry SMS from `handleYes` should be aware that the expired order was a manual offer (detectable by `text_id IS NULL`) and send a different message:

```ts
// In handleYes, after marking the order as expired:
if (!order.text_id) {
  // Manual offer expired — don't tell them to "reply with a number"
  // because there's nothing for handlePendingOrder to pick up.
  await sendSms(from, `Sorry, that offer has expired. I'll follow up with a new one shortly.`, { trigger: 'keyword:yes', customerId: customer.id })

  // Notify admin so they can re-send if appropriate
  const { data: expiredWine } = await sb.from('wines').select('name').eq('id', order.wine_id).maybeSingle()
  const name = customer.first_name ?? customer.phone
  const wineName = expiredWine?.name ?? 'unknown wine'

  await sb.from('concierge_messages').insert({
    customer_id: customer.id,
    direction: 'inbound',
    message: `Tried to confirm expired manual offer (${order.quantity} x ${wineName})`,
    category: 'purchase_query',
    context: `Expired manual offer: ${wineName}`,
  })

  if (customer.concierge_status === 'closed') {
    await sb.from('customers').update({ concierge_status: 'open' }).eq('id', customer.id)
  }

  await notifyAdmin(
    `Expired manual offer — ${name}`,
    `${name} replied YES to a manual offer that has expired.\n\nWine: ${order.quantity} x ${wineName}\nPhone: ${customer.phone}\n\nRe-send via the customer page if still available.`
  )
} else {
  // Broadcast offer expired — they can still reply to the active offer
  await sendSms(from, `Sorry, your order expired. Reply with a number to place a new one.`, { trigger: 'keyword:yes', customerId: customer.id })
}
```

This adds the expiry to the admin inbox and sends an email notification so you know to re-send. Should be rare with 24h tokens.

**Required change to handleYes:** Add `text_id` to the select when fetching the pending order (~line 828):

```ts
// Before:
.select('id, wine_id, quantity, price_pence, total_pence, confirmation_expires_at, auth_token')

// After:
.select('id, wine_id, quantity, price_pence, total_pence, confirmation_expires_at, auth_token, text_id')
```

### 5. Stale pending orders visible in admin

Pending orders that have expired but haven't been cleaned up by the daily cron yet will still show as `awaiting_confirmation` in the admin customer page's Payments section. This is cosmetically confusing (the screenshot shows Alex's old pending order still visible after a new one was sent).

**Fix — show expiry status in the admin UI.** In the customer detail page's Payments table, if an order is `awaiting_confirmation` AND `confirmation_expires_at < NOW()`, display it as "expired" instead of "pending". This is a display-only change — the daily cron will update the actual DB status on its next run.

**Location:** `app/admin/(protected)/customers/[id]/page.tsx` — add `order_status, confirmation_expires_at` to the orders select, and adjust the `StatusBadge` rendering.

---

## What Happens After Send — The Full Flow

1. **Admin** opens `/admin/customers/[id]`, picks a wine + qty, clicks Send.
2. **API** reserves stock, creates `awaiting_confirmation` order (no `text_id`, 24h expiry), sends SMS.
3. **Customer** receives: `"Daniel here — I've set aside 2 x Barolo 2019 for you (£36.00). Reply YES to confirm."`
4. **Customer replies YES** → inbound webhook → `handleYes` finds the pending order → charges via Stripe PaymentIntent → `handlePostCharge` (cellar, tier, shipment check) → confirmation SMS.
5. If customer has **no card**: SMS includes billing link → customer adds card → save-card endpoint sends recap SMS with YES instruction (existing no-card flow from `sms-order-flow-no-card` spec) → customer replies YES → charge.
6. If customer **doesn't reply** within 24 hours: daily cron marks order expired, restores stock. No SMS sent to customer (they just ignore it, no harm done). Admin can see the expired order and re-send if they want.
7. If customer **replies YES after expiry**: gets `"Sorry, that offer has expired. I'll follow up with a new one shortly."` Message appears in admin inbox + email notification. Admin re-sends via the Send Offer form if still appropriate.
8. If **charge fails**: existing `handleYes` failure path kicks in — payment failure tracking, retry nudges via daily cron.

---

## Migration

### No schema changes needed

No new columns or tables. The `orders` table already supports `text_id = NULL`, and the unique index on `(customer_id, text_id)` allows multiple NULL rows per customer.

---

## Future Work

- **Multi-wine offers in a single SMS.** Would require either: (a) a new `order_groups` table to bundle multiple `orders` rows under one YES, or (b) a JSONB `line_items` column on `orders`. Either way, `handleYes` needs to learn about batches. Deferred — single-wine covers 90% of use cases.
- **Offer templates / saved messages.** Admin could save "Daniel here — I've set aside..." as a template and customise per send. Low priority.
- **"Re-offer" button on expired/missed broadcast orders.** One-click re-send of the same wine at the same price to a customer who missed a broadcast. Could be a shortcut that pre-fills this form.
