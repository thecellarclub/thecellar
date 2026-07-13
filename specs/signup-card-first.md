# Spec: Card-first signup, address-on-first-ship

## North star

Every active customer should have a valid card on file. When Daniel
texts an offer, replying with a number is the entire purchase. Anything
that delays or distracts from getting the card is friction we should
remove from signup.

A second goal of this revision: **`signup_progress` goes away.** The
`customers` table becomes the single source of truth for everyone we've
ever started a signup with. A customer row is created the moment we
have a verified phone (end of Step 1), and is enriched as the customer
progresses. Dropouts at any step are still in `customers`; we just see
which fields are populated.

## Current flow (what we have today)

1. **Step 1** — `/join` → phone + 6-digit SMS verification
   (`send-code`, `verify-code`).
2. **Step 2** — `/join/details` → first name, last name, DOB, age &
   marketing consents. `save-details` creates:
   - `customers` row (with `stripe_customer_id`, no card, no address).
   - `signup_progress` row updated to `last_step='details'`.
   - **Sends the welcome SMS.**
   - Then renders an inline `<WelcomePanel>` ("Welcome to The Cellar
     Club, {name}…") with two CTAs: "Complete my membership →" or
     "I'll do it later" (which jumps to `/join/confirmed?skipped=1`).
3. **Step 3** — `/join/card` → email + card. `create-setup-intent`
   stashes email, `save-payment-method` saves PM to customer +
   `signup_progress`.
4. **Step 4** — `/join/address` → address. `complete` saves it,
   deletes `signup_progress`, **sends the welcome SMS again**, then
   redirects to `/join/confirmed`.

Two welcome SMSes get sent today (once at Step 2, once at Step 4) —
that's a bug we'll inherit and fix as part of this change.

## New flow (what we want)

1. **Step 1 — phone**: `/join` → verify. **`verify-code` now creates
   the `customers` row** with phone + a fresh
   `stripe_customer_id` (Stripe customer is upgraded from "created at
   Step 2" to "created at Step 1" so we have a place to attach a card
   later). This row has no name, DOB, email, or card yet — those are
   filled in over Steps 2 and 3.
2. **Step 2 — details** (data unchanged; UX changed):
   `/join/details` collects name + DOB + consents.
   `save-details` **updates** the existing `customers` row (rather
   than inserting). It **no longer shows the WelcomePanel and no
   longer sends the welcome SMS**. On success, push straight to
   `/join/card`.
3. **Step 3 — email + card** (final step):
   `/join/card` collects email + card. On success, redirect to
   `/join/confirmed` (the existing "You're in." screen, no
   `skipped=1`). The welcome SMS is sent here, exactly once,
   immediately before the confirmation screen renders. The address
   step is gone from signup entirely.
4. **Step 4 — address**: removed from signup. Address is collected
   when the customer's first case is ready to ship (existing flow
   already prompts for it via the `/ship?token=…` link when
   `default_address` is missing — see `handleShip` /
   `handleShipConfirm` in `app/api/webhooks/twilio/inbound/route.ts`,
   and the YES branch's `if (addr?.line1)` pattern). The portal also
   already surfaces address editing — leave that as-is.

The new step labels become "Step 1 of 3", "Step 2 of 3", "Step 3 of 3".

### Customer-row lifecycle

A customer row's "stage" is now derived from which fields are
populated, not from a separate progress table:

| Stage           | phone | first_name + dob | email + stripe_payment_method_id | default_address |
| --------------- | :---: | :--------------: | :------------------------------: | :-------------: |
| Phone-only      |   ✅   |        ❌         |                ❌                 |        ❌        |
| Details done    |   ✅   |        ✅         |                ❌                 |        ❌        |
| Card on file    |   ✅   |        ✅         |                ✅                 |        ❌        |
| Fully shipped   |   ✅   |        ✅         |                ✅                 |        ✅        |

The cron in §"hourly cron" below uses this pattern directly to find
welcome candidates.

### Hourly fallback for Step 2 completers who don't finish Step 3

If a customer finishes Step 2 (we have their phone + name + DOB +
consents on the customer row) but **doesn't save a card by the time
the hourly cron next runs**, send them the welcome SMS anyway, with a
small recovery link to add their card.

This is the key part of the spec: we still want them to feel welcomed
and to know what The Cellar Club is, but the welcome SMS for this
cohort is also a soft reactivation that nudges them to add a card so
future offer texts can be one-tap.

The cron runs hourly (`0 * * * *`) and only considers customers
whose Step 2 completion is at least 5 minutes old, so the welcome
SMS lands somewhere between ~5 and ~65 minutes after Step 2 — timely
without being aggressive, and avoids the awkward race of an "add a
card" SMS arriving while a customer is mid-typing their card
details.

## Behaviour

### `/api/signup/verify-code` (Step 1 server) — NEW responsibility

After successfully verifying the OTP, **create the `customers` row**:

- Create a Stripe customer (`stripe.customers.create({ phone })`) so
  we have a place to attach a card later.
- Insert into `customers` with `phone`, `stripe_customer_id`,
  `active = true`. Leave `first_name`, `last_name`, `dob`, `email`,
  `stripe_payment_method_id`, `default_address`, `welcome_sent_at`,
  `welcome_pending_at` all null.
- Idempotency: if a `customers` row already exists for this phone
  (e.g. user re-verifies after closing the tab), don't create a new
  Stripe customer — reuse the existing row.
- Stash the `customers.id` (and the existing session signals) in the
  iron session so subsequent steps know which row to update.
- No SMS is sent here.

### `/api/signup/save-details` (Step 2 server)

- **Update** the existing `customers` row (matched by phone or
  session-stashed `customer_id`) with `first_name`, `last_name`,
  `dob`, plus the `marketing_consent` / `age_verified` flags. **Do
  not insert.**
- Set `customers.welcome_pending_at = now()`. This is the timestamp
  the hourly cron uses to decide who to chase if they don't reach
  Step 3.
- **Stop sending the welcome SMS.** Delete the `sendSms(...)` block
  at the bottom (lines ~115–123).
- All `signup_progress` writes are removed. (See migration — the
  table is being dropped.)
- Return `{ ok: true }` (drop `welcomed: true`).

### `/join/details` (Step 2 page)

- Delete `<WelcomePanel>` and the `welcomed` state.
- On successful submit, `router.push('/join/card')` immediately.
- Update step labels to "Step 2 of 3".

### `/api/signup/create-setup-intent` (Step 3 server)

- Stop writing to `signup_progress`. The Stripe customer already
  exists on the `customers` row from Step 1, so reuse it directly.
- No other behaviour change.

### `/api/signup/save-payment-method` (Step 3 server)

- After persisting the PM + email to the customer row, **send the
  welcome SMS here**. This is the only place a welcome SMS fires for
  customers who complete Step 3 within the same hour.
  - Idempotency guard: read `customers.welcome_sent_at`. If
    non-null, skip — the cron already sent it.
  - On success, set `customers.welcome_sent_at = now()` and clear
    `welcome_pending_at`.
- The welcome SMS body for the "completed card" cohort is variant A
  below.
- All `signup_progress` writes are removed.

### `/join/card` (Step 3 page)

- Update step label to "Step 3 of 3".
- On submit success, `router.push('/join/confirmed')` (no
  `skipped=1` flag).
- Reword the heading sub-copy: drop the address mention. Suggested:
  "Add your card and you're done. You'll only be charged when you
  reply to one of Daniel's offers."

### `/join/address` (Step 4 page) and `/api/signup/complete`

- Delete the page and the route. The route is only called from
  `AddressForm`, which is also being deleted. Search the repo for
  references to confirm nothing else links to `/join/address`.
- The `complete` route's job (welcome SMS + signup cleanup) is gone:
  - Welcome SMS → `save-payment-method` (for completers) or the
    cron (for drop-offs at Step 3).
  - There's no `signup_progress` to clean up anymore — the table is
    dropped in the migration below.

### `/join/confirmed` (final screen)

- Keep the existing "You're in." screen.
- Update the body copy to mention address is collected at first
  ship: "When your first case is ready to ship, we'll ask for your
  delivery address. Until then, just reply with a number when
  Daniel texts to grab a wine."
- The `skipped=1` query param branch is no longer reachable —
  remove it.

### `/api/signup/send-code` (Step 1 send OTP)

- Remove the `signup_progress` upsert. We no longer track signup
  state in a separate table; the OTP itself is a transient
  in-memory artefact and the customer row is created at verify
  time.

### Welcome SMS copy

Two variants:

**A. Completed-card welcome** (sent from `save-payment-method`):

> Welcome, {firstName}! It's Daniel from The Cellar Club.
>
> I'll text you whenever I find something special. If you fancy
> it, reply how many bottles. I'll store them in the cellar until
> you fill a case of 12, then deliver free.
>
> Got a question or request? Text me anytime.

(unchanged from the current copy.)

**B. No-card welcome** (sent from the hourly cron, only if the
customer has no card on file):

> Welcome, {firstName}! It's Daniel from The Cellar Club.
>
> I'll text you whenever I find something special. Add a card here
> so you're ready to buy in one tap when an offer drops:
> {APP_URL}/billing?token={billingToken}
>
> Or just reply OFFER any time and I'll send the latest.

The link uses the same `billing_token` mechanism that's already in
use across the app (`customers.billing_token` +
`billing_token_expires_at`, validated in `/billing/page.tsx`). Set
a 24-hour TTL for this token (longer than the 1-hour TTL used for
payment-failure recovery, since this is a soft welcome rather than
a recovery flow).

### New cron: `/api/cron/welcome-and-card-prompt`

A new cron route that runs **hourly** at the top of each hour
(`0 * * * *`). Auth via the same `Bearer ${CRON_SECRET}` pattern
as `case-nudges`.

Logic:

```
For each customers row where:
  active = true
  first_name IS NOT NULL                 -- finished Step 2
  dob IS NOT NULL                        -- finished Step 2
  welcome_sent_at IS NULL                -- haven't welcomed yet
  welcome_pending_at IS NOT NULL         -- Step 2 happened
  welcome_pending_at < now() - interval '5 minutes'

  Re-check stripe_payment_method_id on the row immediately before
  sending (in case Step 3 finished moments ago):

  If stripe_payment_method_id IS NOT NULL:
    -- They quietly finished Step 3 between this query and now,
    -- or save-payment-method failed its idempotency write.
    -- Send the completed-card welcome (variant A) and stop.

  Else (no card on file):
    -- Mint a fresh billing_token (24h TTL) on the customer row.
    -- Send the no-card welcome (variant B) with the link.

  Set customers.welcome_sent_at = now() and clear
  welcome_pending_at.
```

Cadence: hourly. The cost vs. every-5-minutes is negligible
(the SMS still lands within ~60 minutes of Step 2 completion,
which is timely without feeling robotic), and a longer minimum
delay (`5 minutes` floor inside the cron query) gives a customer
who's actively typing their card details a chance to finish
before the welcome-B SMS is even considered.

### `vercel.json`

Add the new cron entry:

```json
{
  "crons": [
    { "path": "/api/cron/case-nudges", "schedule": "0 9 * * *" },
    { "path": "/api/cron/welcome-and-card-prompt", "schedule": "0 * * * *" }
  ]
}
```

### Migration `022_card_first_signup.sql`

This single migration does four things: relax the `customers`
schema for partial signups, add welcome-tracking columns, backfill
orphan `signup_progress` rows, and drop `signup_progress`.

```sql
-- 1. Allow partial customer rows from Step 1 (phone-only).
ALTER TABLE customers ALTER COLUMN dob DROP NOT NULL;
-- (email is already nullable as of migration 020.)

-- 2. Welcome tracking lives on the customer row.
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS welcome_pending_at timestamptz,
  ADD COLUMN IF NOT EXISTS welcome_sent_at    timestamptz;

CREATE INDEX IF NOT EXISTS customers_welcome_pending_idx
  ON customers(welcome_pending_at)
  WHERE welcome_sent_at IS NULL AND welcome_pending_at IS NOT NULL;

-- 3. Backfill any signup_progress phones that are NOT already in
--    customers. These are legacy drop-offs we want to keep so they
--    aren't silently lost. welcome_pending_at is set to NULL for
--    all backfilled rows — every legacy contact has already been
--    welcomed (or chose not to engage), so we don't want the new
--    hourly cron to blast them on day one.
INSERT INTO customers (phone, first_name, last_name, dob, email,
                       stripe_customer_id, stripe_payment_method_id,
                       active, welcome_pending_at, welcome_sent_at,
                       created_at)
SELECT sp.phone,
       sp.first_name,
       sp.last_name,
       sp.dob,
       sp.email,
       sp.stripe_customer_id,
       sp.stripe_payment_method_id,
       true,
       NULL,                  -- do not welcome legacy drop-offs
       now(),                 -- mark as already welcomed so any
                              -- future code path treats them as done
       sp.created_at
FROM signup_progress sp
LEFT JOIN customers c ON c.phone = sp.phone
WHERE c.id IS NULL
  AND sp.phone IS NOT NULL;

-- 4. Drop the table.
DROP TABLE IF EXISTS signup_progress;
```

Notes on the backfill:

- Legacy rows that already have a matching `customers` row are
  ignored — `customers` is the source of truth.
- All backfilled rows get `welcome_pending_at = NULL` and
  `welcome_sent_at = now()`. Everyone in the existing
  `signup_progress` table has already been welcomed (or
  intentionally left to lapse), so the new hourly cron must not
  re-send to them on first deploy. Setting `welcome_sent_at`
  also defends against any future code path that checks "have we
  welcomed this customer?" — the answer is yes.

### Welcome state machine (summary)

```
Step 1 done → customers row created (phone + stripe_customer_id only)

Step 2 done → customers updated (name, dob, consents)
              welcome_pending_at = now()
              ├─ Step 3 done before next cron run →
              │     save-payment-method sends welcome A,
              │     sets welcome_sent_at, clears welcome_pending_at
              └─ cron picks up the row at next hourly tick →
                    sends welcome B (with billing link) if no card,
                    or welcome A if card was just added,
                    sets welcome_sent_at, clears welcome_pending_at
```

## Files to change

- `app/api/signup/verify-code/route.ts`
  - On successful OTP verify, create the Stripe customer and
    insert the `customers` row (idempotent on phone).
  - Stash `customer_id` in the iron session for downstream steps.

- `app/api/signup/send-code/route.ts`
  - Remove the `signup_progress` upsert.

- `app/api/signup/save-details/route.ts`
  - Update (not insert) the existing `customers` row by phone /
    session `customer_id`.
  - Set `welcome_pending_at = now()`.
  - Drop the welcome SMS.
  - Drop all `signup_progress` writes.
  - Drop `welcomed: true` from the response.

- `app/join/details/page.tsx`
  - Delete `WelcomePanel`, `welcomed`, `submittedFirstName`.
  - Push to `/join/card` on submit success.
  - "Step 2 of 3" labels.

- `app/api/signup/create-setup-intent/route.ts`
  - Drop the `signup_progress` upsert.

- `app/api/signup/save-payment-method/route.ts`
  - After saving PM + email, send welcome SMS A (idempotent
    against `customers.welcome_sent_at`).
  - Set `welcome_sent_at = now()`, clear `welcome_pending_at`.
  - Drop all `signup_progress` writes.

- `app/join/card/CardForm.tsx`
  - Push to `/join/confirmed` (not `/join/address`).
  - "Step 3 of 3" label.
  - Updated sub-copy (no address mention).

- `app/join/confirmed/page.tsx`
  - Single body copy mentioning address-at-first-ship.
  - Remove the `skipped=1` branch.

- `app/join/address/page.tsx` — DELETE.
- `app/join/address/AddressForm.tsx` — DELETE.
- `app/api/signup/complete/route.ts` — DELETE.

- `app/api/cron/welcome-and-card-prompt/route.ts` — NEW (logic
  above).

- `vercel.json` — add the new hourly cron entry.

- `supabase/migrations/022_card_first_signup.sql` — NEW (relaxes
  customer schema, adds welcome columns, backfills + drops
  `signup_progress`).

- `app/portal/dashboard/page.tsx` — add the "add your delivery
  address" banner, shown when `stripe_payment_method_id` is
  non-null and `default_address` is null. Links to the
  existing portal address-edit form.

- Repo-wide: search for any remaining references to
  `signup_progress` (types, helpers, admin views) and remove
  them. As of the current code these are confined to the signup
  routes above, but verify before deleting the table.

## Files NOT to change

- `app/billing/page.tsx`, `app/api/billing/update-card/route.ts` —
  the billing token mechanism is reused as-is for the no-card
  welcome link.
- `app/api/webhooks/twilio/inbound/route.ts` — `handleShip` /
  `handleShipConfirm` already handle missing `default_address` by
  sending a `/ship?token=…` link, which prompts for address
  before dispatch. No code change needed; this is the fallback
  that picks up the "address-at-first-ship" baton.

## Edge cases

1. **Customer completes Step 3 between cron ticks.**
   `save-payment-method` runs, sets `welcome_sent_at`, sends
   welcome A. Next hourly cron sees `welcome_sent_at` is non-null
   and skips. Idempotent.

2. **Customer completes Step 3 a second after the cron fires.**
   - If the cron runs first: it sets `welcome_sent_at` and sends
     welcome B with a billing link. `save-payment-method` then
     runs, checks `welcome_sent_at`, sees it's set, skips the
     SMS. The customer ends up with a card on file plus a now-
     redundant billing link in their texts — annoying but not
     broken (the link will just present their existing card).
   - If `save-payment-method` runs first: welcome A sent, cron
     skips on its next tick.
   - To minimise the awkward case, the cron re-checks
     `customers.stripe_payment_method_id` immediately before
     sending and switches to welcome A (no link) if a card was
     saved between the query and the send.

3. **Customer abandons at Step 1.** They have a `customers` row
   with phone + stripe_customer_id and nothing else.
   `welcome_pending_at` is null (only set at Step 2), so the
   hourly cron doesn't touch them. Good.

4. **Customer adds card via the welcome-B link.** The existing
   `/billing` page / `update-card` route saves the card to
   `customers.stripe_payment_method_id`. No `signup_progress`
   cleanup needed (table no longer exists). If we want to mark
   the welcome flow as "complete" at this point we can clear
   `welcome_pending_at`, but it's already null at this point
   (the cron clears it when it sends welcome B).

5. **Customer who completed Steps 1–4 under the old flow.**
   They already have an address in `default_address` and a
   deleted `signup_progress` row. The migration ignores them
   (`signup_progress` is empty for these). Nothing to do.

6. **Customer at Step 1 (only phone, no details yet) texts in.**
   In practice this can't happen on day one: the customer
   doesn't have our SMS number until we send the welcome SMS,
   and the welcome SMS only fires after Step 2. So a phone-only
   row never gets the chance to initiate an inbound text. No
   special-case handling needed.

7. **Welcome SMS to a customer who's already received the
   welcome SMS from a previous abandoned signup attempt.** Phone
   uniqueness on `customers` means there's exactly one row per
   phone, and `welcome_sent_at` is set the moment we send. Re-
   verifying the OTP later just no-ops (the customer row
   already exists). No duplicates.

8. **Stripe SetupIntent fails on Step 3 — customer goes back,
   fixes card, retries.** `save-payment-method` only runs on
   success. The hourly cron uses a `welcome_pending_at < now() -
   interval '5 minutes'` floor so a customer who fights with
   their card for a few minutes won't get welcome B mid-typing.
   If they take longer than an hour the cron may welcome them
   first, which is acceptable.

9. **First-ship address prompt.** Already handled — when a
   customer hits 12 bottles or pays for an early ship, the
   inbound webhook's `handleShip` checks `default_address` and
   either sends the address-line confirmation prompt or the
   `/ship?token=…` link if address is missing. The `/ship?token`
   page (existing) is the address-capture moment. No new code
   needed for this; just verify on staging that a customer with
   no `default_address` reaches the `/ship` page and can
   complete an address there.

10. **Backfilled legacy drop-offs.** Anyone in `signup_progress`
    today who never made it to `customers` is inserted by the
    migration with `welcome_pending_at = NULL` and
    `welcome_sent_at = now()` — they've already been welcomed
    under the old flow, so the new hourly cron leaves them
    alone. They still appear in `customers` so any future
    re-engagement work has them to hand.

## Test plan

1. **Happy path, fast completion.**
   - New phone → verify (customer row created with phone +
     stripe_customer_id only) → details (row updated) → card
     (welcome A sent, `welcome_sent_at` set) → confirmed.
   - Confirm: exactly one welcome SMS received (variant A, no
     link), no welcome screen between Step 2 and Step 3, no
     address step, `customers` row has phone + name + dob +
     email + card, no `default_address`, `signup_progress`
     does not exist.

2. **Drop off at Step 2.**
   - Complete Step 2, close the tab.
   - Wait for the next hourly cron tick.
   - Confirm: welcome SMS received (variant B with billing
     link), `welcome_sent_at` set on `customers`,
     `stripe_payment_method_id` still null.
   - Click the link → add card → confirm card saved on
     customer row.

3. **Drop off at Step 2, never adds card.**
   - Same as above, but ignore the SMS. Confirm cron does not
     re-send on its next tick (idempotent).

4. **Drop off at Step 1.**
   - Verify phone, close the tab. Confirm `customers` row
     exists but `welcome_pending_at` is null and the cron does
     not welcome them.

5. **Race: complete Step 3 just after the cron fires.**
   - Hard to hit reliably; simulate by manually setting
     `welcome_pending_at` to 6 minutes ago and triggering both
     the cron and `save-payment-method` close together. Confirm
     exactly one welcome SMS sent and `customers` row
     consistent either way.

6. **First ship without an address.**
   - Customer who signed up under the new flow (no
     `default_address`) reaches 12 bottles. Texts `SHIP`.
     Confirm webhook sends them the `/ship?token=…` link
     (since `addr?.line1` is falsy). Confirm `/ship` page lets
     them set the address and confirm dispatch.

7. **`/join/address` is gone.** Direct GET to `/join/address`
   → 404. No links in the app point there.

8. **Vercel cron auth.** Hit
   `/api/cron/welcome-and-card-prompt` without
   `Authorization: Bearer ${CRON_SECRET}` → 401.

9. **Migration backfill.**
   - On staging, before the migration: insert a
     `signup_progress` row with a phone that has no matching
     `customers` row.
   - Run the migration.
   - Confirm a `customers` row now exists for that phone with
     `welcome_pending_at = NULL` and `welcome_sent_at = now()`
     (so the new hourly cron will not pick them up), and that
     the `signup_progress` table is gone.
   - Trigger the hourly cron and confirm no SMS is sent to the
     backfilled row.

10. **Portal banner.** Log in as a customer with card on file
    but no `default_address`. Confirm the "add your delivery
    address" banner shows on `/portal/dashboard`. Add the
    address via the existing form. Confirm the banner
    disappears.

## Decisions locked in

- **Backfill of legacy `signup_progress` rows**: insert with
  `welcome_pending_at = NULL` and `welcome_sent_at = now()` so
  the new hourly cron does not re-welcome them. Everyone in
  the existing table has already been welcomed under the old
  flow.
- **Welcome-B link destination**: `/billing?token=…` (the
  lowest-friction card-capture page). A richer landing page
  is a possible later A/B test.
- **Portal CTA for missing address**: ADD a banner reminder on
  `/portal/dashboard` for customers with `default_address`
  null and `stripe_payment_method_id` non-null (i.e. card on
  file but no address). See `/portal/dashboard` section below.
- **Iron-session contents**: stash `customer_id` in the
  session at the end of `verify-code`, alongside whatever it
  already carries. Downstream routes (`save-details`,
  `save-payment-method`) match by `customer_id` first, falling
  back to phone if the session got nuked.
- **Filtering offers by signup stage**: no filter change.
  Phone-only and details-only customers still receive offer
  texts as long as `active = true` — the offer itself
  motivates them to come back and finish signup.
- **Marketing consent**: the SMS consent flag captured at
  Step 2 is a hard prerequisite to progress (UK PECR
  compliance). All welcome SMSes go to consenting customers
  by definition.

## `/portal/dashboard` — new banner

Add a banner at the top of the customer portal dashboard for
customers who have a card on file but no `default_address`:

> Add your delivery address so we can send your case the
> moment it's ready.
>
> [Add address →]  (links to existing address-edit form)

Render the banner only when:

```
customer.stripe_payment_method_id IS NOT NULL
AND customer.default_address IS NULL
```

Dismissing the banner is not necessary; once the customer adds
an address, the banner naturally disappears.

## Open questions for Julia

1. **Welcome-B billing token TTL.** The token in the welcome
   SMS link is a magic link — anyone with the URL can update
   the card on the customer's Stripe account, so we expire it
   after a fixed window. Spec uses **24 hours** (long enough
   that "I'll deal with it after dinner" still works, short
   enough that a forwarded link from yesterday is dead). The
   payment-failure flow uses 1 hour because that's a more
   urgent moment; the welcome is more relaxed. Confirm 24h or
   override (1h tighter / 7d more forgiving).
