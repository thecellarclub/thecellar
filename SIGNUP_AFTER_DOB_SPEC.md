# Spec: Create Customer After DOB (Step 2) + Welcome SMS & Confirmation + Optional Card/Email/Address

## Context

The Cellar Club signup is a 4-step flow:

1. **Step 1** — `/join` → `/join/verify`: phone verification (SMS code)
2. **Step 2** — `/join/details`: first name, last name, DOB, consents
3. **Step 3** — `/join/card`: email + Stripe card
4. **Step 4** — `/join/address`: delivery address
5. Success — `/join/confirmed`

Today, the `customers` row is **only** inserted at the end of Step 4 (`app/api/signup/complete/route.ts`). That means:

- If a user completes Step 2 but drops off before entering a card/address, we have no record of them and we never sent them a welcome SMS.
- The welcome SMS (which currently contains the word "hearty") is only fired from `complete/route.ts`.
- Users are forced to enter card + address before they're "in the club".

We want to change this so that:

1. The customer is created **at the end of Step 2**, immediately after a valid DOB + consents are submitted.
2. The welcome SMS fires at that moment, and the word **"hearty"** is removed from it.
3. Steps 3 and 4 (email, card, address) still happen, but are now framed as optional "save these for ease in the future" rather than required to join. A "Welcome to the Club" confirmation message is shown after Step 2 before continuing.
4. Later, in the SMS order flow, if a customer tries to order but has no saved card, they're prompted to add one. This behaviour already exists in the inbound webhook but needs to be reviewed for the new signup path (where `stripe_payment_method_id` may now be null at signup time).

---

## Goals

- Create the `customers` row at end of Step 2, with whatever fields we have at that point.
- Send a welcome SMS at end of Step 2 with "hearty" removed.
- Show a "Welcome to The Cellar Club" confirmation UI between Step 2 and Step 3 that invites the user to continue (now optional) with card, email, and address for convenience.
- Keep Step 3 and Step 4 functional — but treat them as enrichment, not gating.
- Ensure later SMS flows (order placement, shipping) gracefully handle customers with no saved card by prompting them with a secure billing link (this already exists; verify + extend).
- Do NOT lose the existing race-condition guards, age validation, GDPR consent capture, or phone-uniqueness checks.

## Non-goals

- No change to Step 1 (phone verification).
- No change to the wine ordering logic or Stripe charging logic itself.
- No change to the admin dashboard.
- No change to the `signup_progress` planned table in `SIGNUP_IMPROVEMENTS_SPEC.md` — this spec supersedes the need for it for the "create customer early" use case, but the progress table could still be used for analytics. Leave for a future spec.
- No change to SMS copy anywhere other than the welcome SMS (remove "hearty") and any new prompts called out below.

---

## Implementation

### 1. `app/api/signup/save-details/route.ts` — create the customer here

**Current behaviour:** validates details, saves to session, returns `{ ok: true }`.

**New behaviour:** after validation, insert the `customers` row, set Stripe customer (without a payment method yet), send the welcome SMS, then return `{ ok: true }`.

Required changes:

- After the existing age + phone-already-registered guards, create a Stripe customer (we need `stripe_customer_id` now because we want to attach a payment method later without creating the customer twice):
  ```ts
  const stripeCustomer = await stripe.customers.create({
    phone: normalisedPhone,
    name: `${firstName.trim()} ${lastName.trim()}`,
    metadata: { signup_source: 'cellar_club_web' },
  })
  ```
- Insert the `customers` row with the fields we have now. Leave `email`, `stripe_payment_method_id`, `default_address` as null — the DB schema already permits that (verify in `supabase/schema.sql`; if `email` is `NOT NULL UNIQUE`, relax to `NULL` allowed but keep the unique constraint so nulls are fine in Postgres, multiple nulls are allowed under UNIQUE).
  ```ts
  const dobString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const { data: inserted, error: insertError } = await sb.from('customers').insert({
    phone: normalisedPhone,
    first_name: firstName.trim(),
    last_name: lastName.trim(),
    stripe_customer_id: stripeCustomer.id,
    dob: dobString,
    age_verified: true,
    active: true,
    gdpr_marketing_consent: true,
    gdpr_consent_at: new Date().toISOString(),
  }).select('id').single()
  ```
- Save `stripeCustomerId` into the signup session so Step 3 reuses it (do NOT create another customer in `create-setup-intent`).
- Save `customerId` into the session too so Steps 3/4 can update the correct row.
- Send the welcome SMS here (await, log on failure, don't throw):
  ```ts
  try {
    await sendSms(
      normalisedPhone,
      `Welcome to The Cellar Club, ${firstName.trim()}! Save this number so you know it's us.\n\nDaniel will send two hand-picked offers each week. If you fancy one, just tell us how many bottles.\n\nWe'll store it all until you've filled a case of 12 — then deliver it to you for free.`
    )
  } catch (err) {
    console.error('[save-details] welcome SMS failed', err)
  }
  ```
  Note: "A hearty welcome to" → "Welcome to".
- Return `{ ok: true, welcomed: true }` so the client can show the confirmation UI.

### 2. Welcome confirmation UI (between Step 2 and Step 3)

**Two options — pick Option A (inline confirmation on the details page) unless a new route fits better visually:**

**Option A (preferred):** On `app/join/details/page.tsx`, after a successful submit, swap the form for an inline "You're in" confirmation panel instead of immediately redirecting. That panel shows:

- Heading: "Welcome to The Cellar Club, {firstName}."
- Sub: "You're in — we've just sent you a welcome text."
- Body: "To make ordering quick next time, save your card, email and delivery address now. You can skip and do it later from any text we send you."
- Primary CTA (burgundy `bg-rio`): "Continue" → pushes to `/join/card`
- Secondary link (underlined, muted): "I'll do it later" → pushes to `/join/confirmed?skipped=1`

**Option B:** New route `/join/welcome` that renders the same content and navigates on CTA.

### 3. `app/join/card/page.tsx` and `app/api/signup/create-setup-intent/route.ts`

- Copy change: heading "Save your email and card for ease next time (optional)". Subtext: "We won't charge anything now. This just lets you reply to offers without typing in card details each time."
- Add "Skip for now" link that routes to `/join/address` (or directly to `/join/confirmed?skipped=1` — see Step 4 below for the decision).
- In `create-setup-intent`, DO NOT create a new Stripe customer. Read `session.stripeCustomerId` (set by `save-details`) and create the SetupIntent for that customer. If it's somehow missing, 400 "Session expired. Please start again."
- In `save-payment-method`, persist `stripe_payment_method_id` on the existing `customers` row immediately (via the `customerId` we stored in the session), and also save the email onto the row at the same time. That way if they drop off before Step 4 we still have the card + email on file.
  ```ts
  await sb.from('customers').update({
    stripe_payment_method_id: paymentMethodId,
    email: session.email,
  }).eq('id', session.customerId)
  await stripe.customers.update(session.stripeCustomerId, {
    invoice_settings: { default_payment_method: paymentMethodId },
  })
  ```

### 4. `app/join/address/page.tsx` and `app/api/signup/complete/route.ts`

- Rename the page heading to "One last thing — your delivery address (optional)".
- Add "Skip for now" link that routes to `/join/confirmed?skipped=1`.
- **`complete/route.ts` becomes an update route, not an insert route.** It should:
  - Validate we have `session.customerId` (set at Step 2).
  - Validate the address fields.
  - UPDATE the `customers` row setting `default_address`.
  - **Remove** the `INSERT into customers`, the `stripe.customers.update(...)`, and the welcome SMS block. The customer already exists and was welcomed at Step 2.
  - Clear the session and return `{ ok: true }`.

### 5. `app/join/confirmed/page.tsx`

Render a slightly different message if `?skipped=1` is present — it should gently remind the user that next time they order we'll ask for card/address, but keep the tone celebratory. E.g. "You're in. When your first text lands, just reply with how many bottles — we'll ask for your card and address at that point if we don't have them yet."

### 6. Inbound SMS (`app/api/webhooks/twilio/inbound/route.ts`) — verify card prompts

The webhook already handles missing payment methods at two places (lines ~297 and ~810 in the current file) by sending:

> "We don't have a payment card on file. Add one at {APP_URL}/billing?token={billingToken} and reply SHIP CONFIRM again."
> "We don't have a payment card on file. Add one at {APP_URL}/billing?token={billingToken} or update your details at {APP_URL}/portal. Reply YES once done."

Required changes:

- Verify both prompts still fire correctly for customers who were created at Step 2 but never added a card. They should — the check is `if (!customer.stripe_payment_method_id)` which is now more likely to be true.
- Add a new prompt in the **first time a customer replies to a wine offer with a quantity** and has no saved card. Today, the order creation path creates an order with `awaiting_confirmation` and only checks for a payment method at `YES`. Instead, check for the payment method at the quantity reply stage too, and send:
  > "Got it — X bottles of {wine} (£X.XX). We just need a card on file to confirm — add one at {APP_URL}/billing?token={billingToken} and reply YES. Expires in 10 minutes."
- Similarly, if the customer has no `default_address`, include a short prompt with the YES reply that lets them set an address via a secure link. The shipping flow already handles missing address via the SHIP token; reuse that pattern. E.g.:
  > "Nice choice — we'll store these in your cellar. When you hit 12 bottles we'll ask for your address. Or add it now at {APP_URL}/portal."

Keep the existing 1-hour `billing_token` TTL and the token-generation pattern (`crypto.randomUUID()` + `billing_token_expires_at`).

### 7. Database schema review (`supabase/schema.sql`)

- Confirm `email` on `customers` is nullable. If it is currently `NOT NULL`, add a migration that sets it `NULL`-able:
  ```sql
  ALTER TABLE customers ALTER COLUMN email DROP NOT NULL;
  ```
- Confirm `stripe_payment_method_id`, `default_address` are nullable (they already should be).
- Confirm `stripe_customer_id` is nullable (it needs to be nullable OR always populated at Step 2 — since we always create a Stripe customer at Step 2 now, it can stay `NOT NULL` if it is, but double check).
- Add a migration file under `supabase/migrations/` named `YYYYMMDDHHMM_relax_customer_required_fields.sql` with the relevant `ALTER`s.

### 8. Session type update

- In `lib/session.ts`, add `customerId?: string` to the `SignupSessionData` interface so Step 3 & 4 can reference it. Keep the 1-hour TTL.

### 9. SMS copy audit

- `app/api/signup/complete/route.ts`: remove the welcome SMS block entirely (it's now sent at Step 2).
- `app/api/webhooks/twilio/inbound/route.ts`: the inbound fallback SMS at around line 1064 currently reads "A hearty welcome to the Cellar — well, hopefully...". Do NOT change that — it is a distinct message for unknown inbound texts and the user asked only for the Step 2 welcome SMS to have "hearty" removed. Leave comment in code noting this is intentional.

---

## Copy changes — verbatim

**Welcome SMS (sent at end of Step 2):**

```
Welcome to The Cellar Club, {firstName}! Save this number so you know it's us.

Daniel will send two hand-picked offers each week. If you fancy one, just tell us how many bottles.

We'll store it all until you've filled a case of 12 — then deliver it to you for free.
```

**In-app welcome confirmation panel (after Step 2 submit):**

- Heading: `Welcome to The Cellar Club, {firstName}.`
- Sub: `You're in — check your phone for a welcome text.`
- Body: `To make ordering quick next time, save your card, email and delivery address now. It only takes a minute and means you can order a wine by replying with a number.`
- Primary CTA: `Continue`
- Secondary link: `I'll do it later`

**Step 3 (card) header:**
`Save your email and card (optional)`

**Step 4 (address) header:**
`Save your delivery address (optional)`

**Confirmed page — skipped variant:**
`You're in. When your first text lands, reply with how many bottles — we'll ask for your card and address then if we don't have them yet.`

---

## Acceptance criteria

1. Submitting valid details at Step 2 creates a `customers` row with `age_verified = true`, `gdpr_marketing_consent = true`, a `stripe_customer_id`, DOB, names and phone. `email`, `stripe_payment_method_id`, `default_address` are null.
2. A welcome SMS (without the word "hearty") is received by the phone on file within ~10 seconds of Step 2 submission. Failure to send does not block the signup.
3. The UI shows a "Welcome to The Cellar Club" confirmation panel with a Continue CTA and a "I'll do it later" link.
4. Clicking Continue leads to Step 3 (card). Step 3 is functional; submitting a card saves `stripe_payment_method_id` + `email` onto the existing customer row and advances to Step 4.
5. Skipping at Step 3 or Step 4 takes the user to `/join/confirmed?skipped=1` and renders the skipped-variant copy.
6. A customer who signed up but skipped the card, then later replies to a wine offer with a quantity, receives an SMS with a billing link and the "reply YES once done" prompt; the YES flow works after they add a card.
7. A customer who signed up with a card but skipped the address can still accumulate bottles in their cellar, and is prompted for an address when shipping becomes relevant (existing SHIP flow handles this).
8. All existing race-condition guards still pass: attempting to sign up with a phone already registered returns `looks_like_already_signed_up` (409).
9. No references to the word "hearty" exist in the Step 2 welcome SMS (verify with a grep).
10. Tests: add or update tests (if the repo has any — check `tests/` or `__tests__/`) that cover the Step 2 row insertion and the SMS send being awaited.

---

## Files expected to change

- `app/api/signup/save-details/route.ts` — customer insert + SMS fire moved here
- `app/api/signup/create-setup-intent/route.ts` — reuse existing Stripe customer
- `app/api/signup/save-payment-method/route.ts` — update existing customer row with card + email
- `app/api/signup/complete/route.ts` — shrinks to an address-only update; no insert, no SMS
- `app/join/details/page.tsx` — success state shows confirmation panel
- `app/join/card/page.tsx` — "optional" framing, skip link
- `app/join/address/page.tsx` — "optional" framing, skip link
- `app/join/confirmed/page.tsx` — supports `?skipped=1` variant
- `app/api/webhooks/twilio/inbound/route.ts` — add card-prompt at quantity-reply stage
- `lib/session.ts` — add `customerId` to session type
- `supabase/migrations/<new>.sql` — relax nullability on `email`, `stripe_payment_method_id`, `default_address` if needed

## Out of scope / follow-ups

- Abandoned-signup recovery SMS (e.g., "you started signing up 2 days ago — finish here") — not in this spec.
- Dashboard showing customers who are signed up but missing card or address — not in this spec, but the data model now supports this query trivially (`WHERE stripe_payment_method_id IS NULL`).
- Analytics around dropoff at Step 3 vs Step 4 — not in this spec.
