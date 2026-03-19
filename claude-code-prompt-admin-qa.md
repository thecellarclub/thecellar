# Claude Code Prompt — Admin Panel QA

Five issues to fix. Do them in order.

---

## 1. Payment failure investigation and hardening

### Known facts
- Customer record: one row in Supabase, phone `+447826665548`, `stripe_customer_id: cus_UASLa0qWfIy0WZ`, `stripe_payment_method_id: pm_1TC7QmH3KShUzYxAOh8OgrOH`
- No duplicate records
- Payment worked yesterday, fails today with "Something went wrong processing your payment. Please try again."
- This error comes from the **generic catch block** — meaning it's NOT a StripeCardError (not a simple decline). It's something like `invalid_request_error`, an API key mismatch, a detached payment method, or a misconfigured PaymentIntent.
- The code currently does `console.error('[twilio/inbound] Stripe error (YES)', err)` in this catch block — check Vercel logs immediately to see the actual error message and code.

### Fix A — Surface the real error

The first job is to find out exactly what Stripe is throwing. In `app/api/webhooks/twilio/inbound/route.ts`, in the generic catch block for the YES handler, improve the error logging and SMS:

```ts
} catch (err: unknown) {
  // Log the full error detail for debugging
  const stripeErr = err as { type?: string; code?: string; message?: string; raw?: unknown }
  console.error('[twilio/inbound] Stripe error (YES)', {
    type: stripeErr?.type,
    code: stripeErr?.code,
    message: stripeErr?.message,
    customerId: customer.stripe_customer_id,
    paymentMethodId: customer.stripe_payment_method_id,
  })

  // Check if it's because the payment method isn't attached / valid
  const isInvalidPM =
    stripeErr?.code === 'payment_method_not_found' ||
    stripeErr?.code === 'resource_missing' ||
    stripeErr?.type === 'invalid_request_error'

  if (isInvalidPM) {
    // PM is detached or invalid — send billing link
    const billingToken = crypto.randomUUID()
    await sb.from('customers').update({
      billing_token: billingToken,
      billing_token_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      stripe_payment_method_id: null, // clear the invalid PM
    }).eq('id', customer.id)

    await sb.from('orders').update({ order_status: 'cancelled', stripe_charge_status: 'failed' }).eq('id', order.id)
    const { data: wine } = await sb.from('wines').select('stock_bottles').eq('id', order.wine_id).maybeSingle()
    if (wine) await sb.from('wines').update({ stock_bottles: wine.stock_bottles + order.quantity }).eq('id', order.wine_id)

    await sendSms(from, `There's an issue with your saved card. Please update it at ${APP_URL}/billing?token=${billingToken} — you can also add a backup card in your account at ${APP_URL}/portal. Reply YES once updated.`)
    return twimlOk()
  }

  // Truly unexpected error
  await sendSms(from, `Something went wrong processing your payment. Please reply YES to try again, or visit ${APP_URL}/portal for help.`)
  return twimlOk()
}
```

### Fix B — Verify payment method is attached before charging

Before the Stripe PaymentIntent creation, add a verification step. If the PM is missing from the DB or has been detached in Stripe, catch it early with a useful message rather than a confusing error:

```ts
// Guard: no PM in DB
if (!customer.stripe_payment_method_id) {
  const billingToken = crypto.randomUUID()
  await sb.from('customers').update({
    billing_token: billingToken,
    billing_token_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  }).eq('id', customer.id)
  await sb.from('orders').update({ order_status: 'cancelled', stripe_charge_status: 'failed' }).eq('id', order.id)
  const { data: wine } = await sb.from('wines').select('stock_bottles').eq('id', order.wine_id).maybeSingle()
  if (wine) await sb.from('wines').update({ stock_bottles: wine.stock_bottles + order.quantity }).eq('id', order.wine_id)
  await sendSms(from, `We don't have a payment card on file. Add one at ${APP_URL}/billing?token=${billingToken} or update your details at ${APP_URL}/portal. Reply YES once done.`)
  return twimlOk()
}
```

### Fix C — Harden the signup flow against future duplicates

In `app/api/signup/complete/route.ts`, add a normalisation call on `session.phone` before the duplicate guard. `session.phone` should already be normalised (set at `send-code` time), but this is belt-and-braces to prevent future duplicate rows:

```ts
import { normaliseUKPhone } from '@/lib/phone'
// After reading session, before the duplicate check:
let normalisedPhone: string
try {
  normalisedPhone = normaliseUKPhone(session.phone)
} catch {
  return NextResponse.json({ error: 'Invalid phone in session. Please start again.' }, { status: 400 })
}
// Use normalisedPhone for both the duplicate check and the insert
```

### Fix D — Handle expired PaymentIntents (3DS / requires_action)

Stripe PaymentIntents with `requires_action` status (3DS pending) are valid for ~24 hours — after that, the PI is canceled by Stripe. The `/authenticate` page needs to handle this.

In `app/authenticate/page.tsx`, after retrieving the PaymentIntent from Stripe, check its status before rendering the form:

```ts
if (paymentIntent.status === 'canceled') {
  return <ErrorPage message="This payment link has expired. Reply YES to your last message to get a new one." />
}
if (paymentIntent.status === 'succeeded') {
  return <ErrorPage message="This order has already been paid — you're all set." />
}
```

Also ensure the page handles `expired` order status (order's `confirmation_expires_at` passed) with: "This order has expired. Reply YES to place a new one."

### Fix E — Apply the same null PM guard in the cron handler

In `app/api/cron/case-nudges/route.ts`, wherever the cron charges customers for auto-ship, add the same null PM check before creating the PaymentIntent. If a customer has no PM, log a warning and skip them (don't crash the cron job for other customers).

---

## 2. Shipments page — detail view, tracking, dispatch button

The shipments list page works but there is no detail page and no way to add a tracking number or mark a shipment as dispatched.

### A — Add `tracking_provider` if it doesn't exist

Check the Supabase `shipments` table schema. If a `tracking_provider` column doesn't exist, create migration `012_shipment_tracking_provider.sql`:

```sql
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS tracking_provider text;
```

### B — Create shipment detail page

Create `app/admin/(protected)/shipments/[id]/page.tsx`. This page should:

1. Fetch the shipment by ID (including related customer and the bottles in that shipment)
2. Render a detail view with:
   - Customer name + phone (linked to customer page)
   - Full shipping address (formatted properly, each part on its own line)
   - Current status badge
   - Dates (created, dispatched, delivered where set)
   - The bottles being shipped — query `cellar` rows where `shipment_id = id` (or however they're associated) to show what's in the box
   - Tracking section (see below)
   - Action button (see below)

For the bottles in the shipment: check how cellar rows are associated with shipments (there may be a `shipment_id` FK on the cellar table, or bottles may just be identified by `shipped_at` timestamp matching the shipment). Use whatever association exists.

3. **Tracking section** — inline form with two fields: carrier (text input, e.g. "DHL", "DPD", "Royal Mail") and tracking number (text input). On submit, update `tracking_provider` and `tracking_number` on the shipment. If tracking is already saved, show the current values pre-filled with an "Update" option. Keep it simple — no dropdown for carrier, just a text input.

4. **Mark as dispatched button** — a prominent button that:
   - Only shows when status is `pending`
   - On click, updates `status → 'dispatched'` and sets `dispatched_at` to now
   - Sends the customer an SMS: `Good news — your case is on its way! {tracking_provider}: {tracking_number}. We'll let you know when it arrives.` — but only if `tracking_number` is set. If no tracking number: `Good news — your case has been dispatched and is on its way to you.`
   - Refreshes the page after

Create a server action or API route (`/api/admin/shipments/[id]/dispatch`) for this. Use the existing admin auth pattern.

### C — Link the list rows to detail pages

In `app/admin/(protected)/shipments/page.tsx`, wrap each shipment row (or the customer name cell) with a `<Link href={`/admin/shipments/${s.id}`}>` so you can click through to the detail page.

### D — Packing list framing

At the top of the shipments list page, the pending count callout already shows. No changes needed to framing — the pending badge serves as the packing list indicator. Just make sure the detail page shows bottle contents clearly.

---

## 3. Concierge — rebuild desktop view as two-panel inbox

The current desktop concierge renders all threads as stacked expanded conversations. It needs to be a proper two-panel layout: list on the left, conversation on the right.

In `app/admin/_components/ConciergeClientView.tsx`, replace the `{/* ── DESKTOP (hidden below md) ── */}` block entirely.

The new desktop layout:

```tsx
{/* ── DESKTOP (hidden below md) ── */}
<div className="hidden md:flex h-[calc(100vh-120px)] border border-gray-200 rounded-lg overflow-hidden bg-white">

  {/* Left panel — thread list */}
  <div className="w-80 flex-shrink-0 border-r border-gray-200 overflow-y-auto">
    <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Conversations</p>
    </div>
    {threads.length === 0 ? (
      <p className="text-sm text-gray-400 p-4">No messages yet</p>
    ) : (
      threads.map((thread) => {
        const unanswered = isUnanswered(thread)
        const lastMsg = thread.messages[thread.messages.length - 1]
        const isSelected = selectedId === thread.customerId
        return (
          <button
            key={thread.customerId}
            onClick={() => setSelectedId(thread.customerId)}
            className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${isSelected ? 'bg-gray-100' : ''}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {thread.firstName ?? 'Unknown'}
                  </p>
                  {unanswered && (
                    <span className="flex-shrink-0 w-2 h-2 rounded-full bg-red-500" title="Awaiting reply" />
                  )}
                </div>
                <p className="text-xs text-gray-400 truncate mt-0.5">{thread.phone ?? '—'}</p>
                {lastMsg && (
                  <p className="text-xs text-gray-500 truncate mt-1">{lastMsg.message}</p>
                )}
              </div>
              <p className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0 mt-0.5">
                {lastMsg ? relativeTime(lastMsg.created_at) : ''}
              </p>
            </div>
            <p className="text-xs mt-1.5">
              <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                unanswered
                  ? 'bg-red-50 text-red-600'
                  : thread.status === 'closed'
                  ? 'bg-gray-100 text-gray-500'
                  : 'bg-green-50 text-green-700'
              }`}>
                {unanswered ? 'Awaiting reply' : thread.status === 'closed' ? 'Closed' : 'Open'}
              </span>
            </p>
          </button>
        )
      })
    )}
  </div>

  {/* Right panel — conversation or empty state */}
  <div className="flex-1 flex flex-col overflow-hidden">
    {selectedThread ? (
      <>
        {/* Thread header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-gray-50 flex-shrink-0">
          <div>
            <p className="text-sm font-semibold text-gray-900">{selectedThread.firstName ?? 'Unknown'}</p>
            <p className="text-xs text-gray-500">{selectedThread.phone ?? '—'}</p>
          </div>
          <button
            onClick={() => setSelectedId(null)}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors px-2 py-1"
          >
            ← Back
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {selectedThread.messages.map((msg) => {
            const isOut = msg.direction === 'outbound'
            return (
              <div key={msg.id} className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}>
                <div className={`rounded-lg px-3 py-2 max-w-sm text-sm ${
                  isOut ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-800'
                }`}>
                  <p>{msg.message}</p>
                  <p className={`text-xs mt-1 ${isOut ? 'text-gray-400' : 'text-gray-500'}`}>
                    {relativeTime(msg.created_at)}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Reply box */}
        <div className="flex-shrink-0 border-t border-gray-200 p-4">
          <ConciergeReplyBox customerId={selectedThread.customerId} phone={selectedThread.phone ?? ''} />
        </div>
      </>
    ) : (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        Select a conversation
      </div>
    )}
  </div>
</div>
```

The `ConciergeReplyBox` component is whatever the existing reply form component is called — check `ConciergeReplyForm.tsx` or equivalent and use it here. Pass the correct props.

The `relativeTime` function already exists in this file — reuse it.

The thread list needs a `status` field on `ConciergeThread`. Check if the `concierge_messages` table or a related table has a status/closed field. If so, include it in the query in `app/admin/(protected)/concierge/page.tsx`. If not, derive it: a thread is "closed" if the last message is outbound AND it's been more than 24 hours since the last message. Otherwise "open".

---

## 4. Text readability — off-white text on white backgrounds

Audit all admin pages for text that is hard to read. The pattern to look for: `text-gray-300`, `text-gray-200`, `text-cream/30`, `text-cream/40` used inside `bg-white` containers. These are invisible.

Fix the following:
- Any `text-gray-300` or lighter inside white backgrounds → `text-gray-500` minimum
- Any `text-gray-400` used for labels or descriptions in tables → bump to `text-gray-600` if it's meaningful content (not purely decorative timestamps)
- Check the shipments, requests, concierge, and billing admin pages specifically

Do a search: `grep -rn "text-gray-3\|text-gray-2\|text-gray-1" app/admin/` — review each result and fix where the contrast is insufficient.

---

## 5. Build, commit, push

Run `npm run build` and confirm no TypeScript errors.

Then commit and push — much of the codebase (portal, tiers, admin mobile, phone normalisation fixes) has never been pushed to Vercel. Push everything:

```
git add -A
git commit -m "Admin QA: shipment detail, concierge inbox, payment guard, contrast fixes"
git push
```

Verify the Vercel deployment completes successfully.
