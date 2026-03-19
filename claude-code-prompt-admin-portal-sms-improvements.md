# Claude Code Prompt — Admin, Portal & SMS Improvements

Six areas. Do them in order.

---

## 1. Font contrast — admin panel and portal

In all admin pages (`app/admin/**`) and portal pages (`app/portal/**`), find and fix text that is hard to read:

- `text-gray-300` inside any `bg-white` or `bg-gray-50` container → `text-gray-600`
- `text-gray-400` used for meaningful content (labels, descriptions, cell values) → `text-gray-600`
- `text-gray-400` used only for timestamps or purely decorative secondary info → leave at `text-gray-500` minimum
- `text-cream/30` and `text-cream/40` inside light backgrounds in portal → should not occur; if found, fix
- Any label text using `text-xs text-gray-400 font-medium uppercase tracking-wide` pattern (section sub-labels) → bump to `text-gray-600`

Run `grep -rn "text-gray-3\|text-gray-2\|text-gray-1" app/admin/ app/portal/` to find all instances.

---

## 2. Customer detail page — restructure

In `app/admin/(protected)/customers/[id]/page.tsx`, restructure the page into four sections in this order: **Cellar → Shipped → Payments → Admin tools**. Also update the data queries.

### A — Update the cellar query to include full wine details

```ts
sb.from('cellar')
  .select('id, quantity, added_at, shipped_at, shipment_id, wines(name, producer, region, country, vintage, price_pence)')
  .eq('customer_id', id)
  .order('added_at', { ascending: false })
```

If `shipment_id` doesn't exist on the cellar table, create migration `013_cellar_shipment_id.sql`:
```sql
ALTER TABLE cellar ADD COLUMN IF NOT EXISTS shipment_id uuid REFERENCES shipments(id);
```

### B — Update the shipments query

Add a shipments query for this customer:
```ts
sb.from('shipments')
  .select('id, status, tracking_number, tracking_provider, created_at, dispatched_at')
  .eq('customer_id', id)
  .order('created_at', { ascending: false })
```

### C — Section 1: "Current Cellar"

Render at the top. Shows only rows where `shipped_at IS NULL`. Title: "Current Cellar".

Columns: Wine · Producer · Region · Vintage · Price · Qty · Added

The wine info comes from the updated query above. Show producer, region, vintage as small secondary text under the wine name if you want to keep it compact, or as separate columns — your choice, but all data must be visible.

At the bottom of this section, keep the **Manually add bottles** form (AddBottlesForm). Remove the RefundButton from here — it moves to Payments.

### D — Section 2: "Shipped"

Render after Current Cellar. Shows all shipments for this customer. For each shipment, expand to show which cellar rows have `shipment_id` matching that shipment.

If `shipment_id` isn't reliably populated (e.g. older records), fall back to grouping cellar rows by `shipped_at` date proximity to the shipment's `dispatched_at`.

Display per shipment:
- Date dispatched (or created if not dispatched yet)
- Status badge
- Tracking provider + number (if set), or "—"
- List of bottles: wine name, producer, region, country, vintage — quantity

Keep it light — this is a read-only history view.

### E — Section 3: "Payments" (was "Orders")

Rename the Orders section to **Payments**. Columns: Wine · Qty · Amount · Status · Date · Action.

Add a **Refund** column. For each order with `stripe_charge_status = 'succeeded'`, show the RefundButton inline. To do this, the RefundButton needs to find the corresponding cellar entry.

Update RefundButton (or create a variant `OrderRefundButton`) that accepts `orderId` and `customerId` instead of `cellarId`. Inside the component/action, look up the cellar row matching `customer_id = customerId` AND `wine_id = order.wine_id` AND `shipped_at IS NULL` to find the cellar entry to remove. If multiple rows match, take the oldest unshipped one.

The underlying refund API should:
1. Refund the Stripe charge via the `stripe_payment_intent_id` on the order (full refund)
2. Remove the cellar entry (or reduce quantity)
3. Update the order's `stripe_charge_status` to `'refunded'`

Check `app/admin/_components/RefundButton.tsx` and the associated API route to see if this is already working correctly. If the current refund just removes from cellar without actually calling Stripe, fix it — it must call `stripe.refunds.create({ payment_intent: order.stripe_payment_intent_id })`.

For orders that aren't `succeeded` (pending, failed, cancelled), show no refund button.

### F — Section 4: Admin tools

At the bottom: the Deactivate button and anything else administrative.

---

## 3. Concierge — close button, ordering, filter

### A — Add thread status

Create migration `014_concierge_thread_status.sql`:
```sql
ALTER TABLE customers ADD COLUMN IF NOT EXISTS concierge_status text DEFAULT 'open';
-- Values: 'open' | 'closed'
```

This stores whether the admin has marked a customer's concierge thread as closed.

### B — Update the concierge page query

In `app/admin/(protected)/concierge/page.tsx`, include `concierge_status` in the customer join:
```ts
.select('id, customer_id, message, direction, created_at, customers(first_name, phone, concierge_status)')
```

Pass `status` through to the `ConciergeThread` type and into `ConciergeClientView`.

### C — Add "Mark as closed" API route

Create `app/api/admin/concierge/[customerId]/status/route.ts`:
```ts
// PATCH — updates concierge_status on the customer
// Body: { status: 'open' | 'closed' }
```

Use standard admin auth pattern.

### D — Update ConciergeClientView

**Thread ordering:** Sort threads so that:
1. Unreplied open threads first (last message is inbound)
2. Replied open threads second
3. Closed threads last

**Mark as closed button:** In the conversation header (both desktop right panel and mobile thread detail), add a button:
- If status is `open`: "Mark as closed" button → calls the PATCH route → updates local state
- If status is `closed`: "Reopen" button → calls the PATCH route with `open`

**Filter:** Add a toggle above the thread list (both mobile list and desktop left panel) — a small checkbox or button: "Show closed". Default: hidden. When toggled, closed threads appear at the bottom.

**Status badge:** In the thread list, the existing open/awaiting/closed badge should now use the real `status` field from the DB for the closed state, not just derived from message timing.

---

## 4. Portal — payments and shipments tabs

The portal already shows the customer's current cellar. Add two more tabs so the customer can see their payment history and shipment history. Same data as the admin panel, no admin controls.

### A — Add queries to the server component

In `app/portal/dashboard/page.tsx`, add:

```ts
// Past payments
const { data: paymentRows } = await sb
  .from('orders')
  .select('id, quantity, total_pence, stripe_charge_status, created_at, wines(name, vintage, region)')
  .eq('customer_id', customer.id)
  .order('created_at', { ascending: false })

// Past shipments
const { data: shipmentRows } = await sb
  .from('shipments')
  .select('id, status, tracking_number, tracking_provider, created_at, dispatched_at, delivered_at')
  .eq('customer_id', customer.id)
  .order('created_at', { ascending: false })
```

Pass both to `DashboardClient` as `payments` and `shipments`.

### B — Add tab bar to DashboardClient

Replace the existing cellar display with a three-tab layout. Use `useState` for `activeTab: 'cellar' | 'payments' | 'shipments'`.

Tab bar sits above the content area. Style with the existing maroon/cream/gold design system — active tab underlined or with a gold accent, inactive tabs in `text-cream/45`.

**Cellar tab** — existing cellar display, unchanged.

**Payments tab** — list of orders, each row showing:
- Wine name (+ vintage if set, small/muted)
- Quantity
- Amount (`total_pence / 100` formatted as £X.XX)
- Status — use a small badge: succeeded → "Paid" (green-ish), failed → "Failed" (red-ish), refunded → "Refunded" (neutral) — style with subtle background, consistent with portal design not admin colours
- Date

No refund buttons — read only.

**Shipments tab** — list of shipments, each row showing:
- Date dispatched (or created if not yet dispatched)
- Status: Pending / Dispatched / Delivered
- Carrier + tracking number on one line (if set), else "—"

No bottle-level breakdown needed in portal view — keep it simple.

Style everything consistently — dark card backgrounds (`#1E0B10`), cream text, Spectral font. No white backgrounds or admin-style tables.

---

## 5. SMS two-step flow — REQUEST and QUESTION

Currently when a customer texts REQUEST or QUESTION, they receive a prompt asking them to include the trigger word again in their reply (e.g. "REQUEST Chateau Musar"). This is clunky. Change it so whatever they send NEXT is processed as the content — no need to repeat the trigger word.

### A — Add state column

Create migration `015_sms_awaiting.sql`:
```sql
ALTER TABLE customers ADD COLUMN IF NOT EXISTS sms_awaiting text DEFAULT NULL;
-- Values: 'request' | 'question' | null
```

Also include `sms_awaiting` in the customer lookup in the Twilio webhook:
```ts
.select('id, phone, first_name, stripe_customer_id, stripe_payment_method_id, active, texts_snoozed_until, tier, sms_awaiting')
```

### B — Check state BEFORE keyword matching

In `app/api/webhooks/twilio/inbound/route.ts`, add this block immediately after the `active` check and BEFORE the STOP/keyword section:

```ts
// ── Pending state — awaiting follow-up to REQUEST or QUESTION ────────────
if (customer.sms_awaiting) {
  // EXIT returns them to the main menu
  if (body === 'exit') {
    await sb.from('customers').update({ sms_awaiting: null }).eq('id', customer.id)
    await sendSms(from, `No problem. Here's what you can do:\n\nCELLAR — see what's in your cellar\nSHIP — send your bottles\nSTATUS — your tier and progress\nACCOUNT — manage card, address and preferences\nREQUEST — suggest a wine\nQUESTION — ask us anything\nSTOP — unsubscribe\n\nJust reply with one of the above.`)
    return twimlOk()
  }

  const pendingType = customer.sms_awaiting
  // Clear the state
  await sb.from('customers').update({ sms_awaiting: null }).eq('id', customer.id)

  if (pendingType === 'request') {
    await sb.from('special_requests').insert({
      customer_id: customer.id,
      message: body, // the raw reply IS the request
    })
    await notifyAdmin(
      `New wine request from ${customer.first_name ?? customer.phone}`,
      `Message: ${body}\nPhone: ${customer.phone}`
    )
    await sendSms(from, `Got it — we'll look into it. Daniel will be in touch if we decide to run it as a drop.`)
    return twimlOk()
  }

  if (pendingType === 'question') {
    await sb.from('concierge_messages').insert({
      customer_id: customer.id,
      message: body,
      direction: 'inbound',
    })
    await notifyAdmin(
      `New question from ${customer.first_name ?? customer.phone}`,
      `Message: ${body}\nPhone: ${customer.phone}`
    )
    await sendSms(from, `Thanks — Daniel will get back to you shortly.`)
    return twimlOk()
  }
}
```

### C — Update the REQUEST and QUESTION trigger handlers

When a customer texts REQUEST (the trigger word only), instead of processing it immediately, set the state and send a prompt:

```ts
// ── REQUEST ──────────────────────────────────────────────────────────────
if (body === 'request') {
  await sb.from('customers').update({ sms_awaiting: 'request' }).eq('id', customer.id)
  await sendSms(
    from,
    `What would you like us to feature? Tell us about it — e.g. 'something from Georgia' or 'Chateau Musar'.\n\nReply EXIT to go back.`
  )
  return twimlOk()
}

// ── QUESTION ─────────────────────────────────────────────────────────────
if (body === 'question') {
  await sb.from('customers').update({ sms_awaiting: 'question' }).eq('id', customer.id)
  await sendSms(
    from,
    `What's on your mind? Ask us anything — e.g. 'can you help me find a wine gift?' or 'how long does shipping take?'.\n\nReply EXIT to go back.`
  )
  return twimlOk()
}
```

Note: the prompt messages no longer include the trigger word in the examples. EXIT is the only reserved word in the follow-up state.

### D — Handle REQUEST and QUESTION with content in same message (backward compat)

Some customers may still send "REQUEST something from Georgia" in one message (old habit). If the body starts with `request ` (with a space after), extract the content and process it immediately — don't set `sms_awaiting`:

```ts
if (body.startsWith('request ')) {
  const content = body.slice('request '.length).trim()
  if (content) {
    await sb.from('special_requests').insert({ customer_id: customer.id, message: content })
    await notifyAdmin(...)
    await sendSms(from, `Got it — we'll look into it.`)
    return twimlOk()
  }
  // Empty content after 'request ' — treat same as bare trigger
  // falls through to the `body === 'request'` handler above
}
```

Apply same pattern for `question `.

---

## 6. Build, commit, push

Run `npm run build` — fix any TypeScript errors before committing.

```
git add -A
git commit -m "Admin/portal/SMS: customer detail restructure, concierge close, portal deliveries tab, SMS two-step flow"
git push
```

Also note: migrations 013, 014, 015 need to be applied to the live Supabase database after deploy. Output the SQL clearly so they can be run in the Supabase SQL editor.
