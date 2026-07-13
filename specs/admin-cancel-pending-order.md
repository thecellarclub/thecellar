# Spec: Cancel pending order from customer admin page

## Problem

Pending orders (`order_status = 'awaiting_confirmation'`) occasionally get stuck. The daily cron (`case-nudges`) does expire them once `confirmation_expires_at < now`, but:

- Vercel Hobby runs crons at daily granularity — so a stuck order can sit for up to 24 hours before cleanup.
- Manual offers have a 24-hour expiry window, so they won't be cleaned up until the next day at the earliest.
- An order can block a new manual offer from being sent to the same customer (the API guards against stacking pending orders).
- Reserved stock is tied up until the order expires.

There is no way today to clear a stuck pending order from the admin UI without waiting for the cron.

---

## Goal

Add a **Cancel** button to any `awaiting_confirmation` order row in the Payments table on the customer detail page (`/admin/customers/[id]`). Clicking it: cancels the order, restores stock to the wine, and clears `sms_awaiting` on the customer if it was set to `'offer'`.

---

## Design decisions

### No SMS to the customer

This is a backend cleanup action. The customer never confirmed anything, so there's nothing to notify them about. No SMS sent.

### Stock must be restored

The invariant established in `handlePendingOrder` (inbound webhook) and mirrored in the daily cron: when an `awaiting_confirmation` order is cancelled or expired, `wines.stock_bottles` must be incremented by `order.quantity`. This must happen atomically with the order status update — do both or do neither. Use the same pattern as the cron's expiry block.

### `sms_awaiting` cleanup

If the customer has `sms_awaiting = 'offer'` set, cancelling the pending order should also clear it (set to `null`). This unblocks the customer from being routed into the offer context on their next SMS. Check the customer's `sms_awaiting` before clearing — only clear if it equals `'offer'`.

### Order status → `'cancelled'`, not `'expired'`

Admin-initiated removals use `order_status = 'cancelled'` (same as what `handlePendingOrder` uses when a customer replies with a different quantity, and what the NO keyword handler uses). `'expired'` is reserved for the cron's time-based cleanup. This distinction is useful for audit purposes.

### Only show Cancel on genuinely pending orders

The button should only appear when `order_status === 'awaiting_confirmation'` — not on expired, confirmed, cancelled, or failed orders. The existing display-side workaround (showing "expired" badge for stale pending orders where `confirmation_expires_at < now`) is cosmetic only; those orders still need to be cancelled via this button until the cron runs.

---

## Required changes

### 1. New API route: `POST /api/admin/customers/[id]/cancel-order`

**Location:** `app/api/admin/customers/[id]/cancel-order/route.ts`

**Auth:** NextAuth admin session (same pattern as all other admin API routes).

**Request body:**
```ts
{ orderId: string }
```

**Logic:**

1. Validate: `orderId` is a non-empty string.
2. Fetch the order:
   ```ts
   sb.from('orders')
     .select('id, order_status, wine_id, quantity, customer_id')
     .eq('id', orderId)
     .eq('customer_id', id)   // scope to this customer — prevents cross-customer cancel
     .maybeSingle()
   ```
3. Return `404` if not found.
4. Return `400` with `"Order is not pending"` if `order_status !== 'awaiting_confirmation'`. (Idempotency guard — prevents double-cancels.)
5. Fetch current wine stock:
   ```ts
   sb.from('wines').select('stock_bottles').eq('id', order.wine_id).maybeSingle()
   ```
6. Update order status:
   ```ts
   sb.from('orders').update({ order_status: 'cancelled' }).eq('id', orderId)
   ```
7. Restore stock:
   ```ts
   sb.from('wines')
     .update({ stock_bottles: (wine?.stock_bottles ?? 0) + order.quantity })
     .eq('id', order.wine_id)
   ```
8. Clear `sms_awaiting` if set to `'offer'`:
   ```ts
   sb.from('customers')
     .update({ sms_awaiting: null })
     .eq('id', id)
     .eq('sms_awaiting', 'offer')   // conditional update — no-op if already null or different value
   ```
9. Return `{ ok: true }`.

**Error responses:**
- `400` — missing/invalid `orderId`, or order not in `awaiting_confirmation` status
- `401` — not authenticated
- `404` — order not found or doesn't belong to this customer

### 2. New client component: `CancelOrderButton`

**Location:** `app/admin/_components/CancelOrderButton.tsx`

**Props:**
```ts
{
  orderId: string
  customerId: string
  wineName: string
}
```

**UI — mirrors `RefundButton` pattern:**

- Default state: a small **Cancel order** button (grey/red styling, distinct from the amber Refund button).
- On click: show inline confirmation — `"Cancel pending order for [wineName]?"` with **Confirm cancel** and **Keep** buttons.
- On confirm: `POST /api/admin/customers/[id]/cancel-order` with `{ orderId }`.
- On success: `router.refresh()` — the order row will now show `cancelled` status, button disappears.
- On error: show inline error text.
- Loading state: disable buttons, show `…`.

**Suggested styling:**
```
[Cancel order]   ← default: text-xs px-2 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100 font-medium
```
Confirmation inline (no modal — keep it compact, same as RefundButton pattern):
```
"Cancel order for Barolo 2019?" [Confirm cancel] [Keep]
```

### 3. Wire into the customer detail page

**Location:** `app/admin/(protected)/customers/[id]/page.tsx`

The Payments table already has an actions column (the last `''` column header). Currently it only shows a `RefundButton` for succeeded orders. Add `CancelOrderButton` for pending ones:

```tsx
// In the orderRows.map() — last <td> cell:
<td className="px-4 py-2.5 border-b border-gray-100">
  {o.stripe_charge_status === 'succeeded' && cellarEntry && (
    <RefundButton ... />
  )}
  {o.order_status === 'awaiting_confirmation' && (
    <CancelOrderButton
      orderId={o.id}
      customerId={id}
      wineName={wine?.name ?? 'Unknown wine'}
    />
  )}
</td>
```

The two conditions are mutually exclusive (a succeeded order is never `awaiting_confirmation`), so they won't both render at once.

Also add `order_status` to the orders query if not already selected (it is — confirmed at line 115 of the page).

---

## Files to create

- `app/api/admin/customers/[id]/cancel-order/route.ts`
- `app/admin/_components/CancelOrderButton.tsx`

## Files to modify

- `app/admin/(protected)/customers/[id]/page.tsx` — add `CancelOrderButton` import and wire into Payments table last cell.

---

## What doesn't change

- The daily cron's expiry logic is unchanged — it still runs and is the primary cleanup path for orders that aged out normally.
- No SMS is sent to the customer.
- No Stripe action needed — `awaiting_confirmation` orders have no charge attached (`stripe_payment_intent_id` is empty string / null at this point).
- The `sms_awaiting` field on the customer is cleared as a side-effect but is not the primary purpose of this action.
