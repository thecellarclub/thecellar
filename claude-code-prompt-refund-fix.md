# Claude Code Prompt — Refund Bug Fix + SMS Confirmation + Shipping Address Pre-fill

Two fixes in this prompt:
1. Refund hanging on three dots in admin panel + add SMS confirmation after successful refund
2. Pre-fill shipping address on /ship page from customer's previous shipment

---

## 1. Refund bug fix

### Symptom
In `/admin/customers/[id]`, clicking the Refund button and confirming the quantity causes the UI to show a loading spinner ("three dots") and never resolve. The refund either hangs, silently errors, or returns a non-200 response that the UI doesn't handle.

### Diagnosis steps
1. Open the refund API route — likely `POST /api/admin/customers/[id]/refund` or similar
2. Check for:
   - Unhandled promise rejections (missing `try/catch`)
   - Stripe refund call that may be failing silently (wrong amount, wrong payment intent ID, refund on a PaymentIntent that wasn't captured, etc.)
   - Missing `await` on async operations
   - Response not being sent in error cases (causes the request to hang until timeout)
   - The Supabase `cellar` row deletion/update happening before the Stripe call, leaving state inconsistent if Stripe fails

3. Check the browser network tab behaviour — is it a 500, a timeout, or no response at all?

### Fix requirements

The refund flow should be:
1. Receive `{ cellarId, quantity }` in request body
2. Fetch the `cellar` row + linked `orders` row to get `stripe_payment_intent_id` and `price_pence`
3. Calculate refund amount: `quantity * price_pence`
4. Call Stripe refund:
   ```js
   stripe.refunds.create({
     payment_intent: order.stripe_payment_intent_id,
     amount: refundAmountPence,
   })
   ```
5. If Stripe call succeeds:
   - Insert into `refunds` table: `{ order_id, customer_id, cellar_id, quantity, amount_pence, stripe_refund_id }`
   - Update `cellar` row: remove or reduce quantity. If full quantity refunded, delete the row. If partial, update `quantity -= refundedQty`.
   - **Send SMS to customer** via Twilio:
     ```
     Your refund of £[amount] is on its way — expect it back in 3–5 working days.
     ```
   - Return `{ success: true }` with 200
6. If Stripe call fails:
   - Do NOT modify cellar or insert refund row
   - Return `{ success: false, error: message }` with 400
   - The UI should show the error message, not a spinner

### UI fix
The admin UI currently shows a spinner and never updates. Fix:
- On success: hide spinner, show green confirmation ("Refunded £[amount]"), remove/update the cellar row in the UI
- On error: hide spinner, show red error message with the reason
- Add a timeout: if no response within 15 seconds, show "Something went wrong — please try again"

### Partial refund handling
If quantity being refunded < total quantity on the cellar row, the Stripe refund should be for `quantity * price_pence`. The cellar row should update its quantity, not be deleted. The UI should reflect the reduced quantity.

---

## 2. Shipping address pre-fill on /ship page

### Current behaviour
The `/ship?token=[token]` page shows an empty address form every time.

### Required behaviour
When the page loads:
1. Validate the token (existing logic — keep as-is)
2. Look up the customer ID from the shipment
3. Query `shipments` for any previous completed shipment for this customer that has a `shipping_address` (`status != 'pending'` AND `shipping_address IS NOT NULL`), ordered by `created_at DESC`, limit 1
4. If a previous address exists:
   - Pre-fill all form fields (line1, line2, city, postcode) with the saved address
   - Show a small note above the form: "We'll ship to your saved address — update below if anything's changed."
5. If no previous address, show the empty form as before

### Submit button copy
Change the submit button from whatever it currently says to: **"Confirm and ship to this address →"**

This frames it as a confirmation step, not just a form submission.

### Also show bottle list on /ship page
Above the address form, display the list of bottles in this shipment:
```
Your case:
2x Chateau Musar 2015 (£22/bottle)
1x Attis Mar Albariño 2023 (£18/bottle)
[etc.]
Total: 12 bottles
```
Query the cellar rows linked to this shipment_id, joined with wines.

---

## Files to check/modify

- `app/api/admin/customers/[id]/refund/route.ts` (or equivalent) — bug fix
- `app/admin/customers/[id]/page.tsx` (or component) — UI error/success handling
- `app/ship/page.tsx` — address pre-fill + bottle list + button copy

---

*Ref: winetexts-build-spec.md Sections 5 and 6*
