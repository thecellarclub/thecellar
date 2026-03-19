# The Cellar Club — Claude Code Build Spec

A wine subscription SMS service. Customers sign up, receive 1–2 texts per week describing a wine, reply with a quantity to order, get charged automatically, and bottles are held in cellar until they hit 12 — at which point they get free shipping on the case.

**Live URL:** https://thecellarclub.vercel.app
**Last updated:** 2026-03-18

---

## Build Status

| Item | Status |
|---|---|
| Project scaffold | ✅ Done |
| Database schema | ✅ Done |
| Sign-up flow (Steps 1–5) | ✅ Done + tested |
| Twilio inbound webhook | ✅ Done + tested |
| Text blast endpoint | ✅ Done + tested |
| Admin UI (all pages) | ✅ Done |
| Security fixes (rate limiting, RLS, tokens, middleware) | ✅ Done |
| Stripe webhook handler | ✅ Done |
| `/ship` page | ✅ Done |
| Order confirmation flow rework (YES to confirm) | ✅ Done |
| 3-month case nudge + auto-ship cron job | ✅ Done |
| Manual add stock check fix | ✅ Done |
| `/authenticate` page (3DS) | ⏳ To do |
| `/billing` page (card update) | ⏳ To do |
| Compliance pages | ⏳ To do |
| Landing page design update | ⏳ To do |
| Admin mobile optimization | ⏳ To do |
| Email notification fix (REQUEST / QUESTION) | ⏳ To do |
| Refund bug fix + SMS confirmation after refund | ⏳ To do |
| Shipping address pre-fill on /ship page | ⏳ To do |
| Customer portal (/portal) | ✅ Done |
| Tier system (Bailey / Elvet / Palatine) | ✅ Done |
| Homepage tier section | ✅ Done |
| Phase 2 features (see Section 11) | ⏳ Backlog |

---

## 1. Tech Stack

| Layer | Tool |
|---|---|
| Framework | Next.js 14 (App Router) |
| Database | Supabase (PostgreSQL) |
| Payments | Stripe |
| SMS | Twilio |
| Hosting | Vercel |
| Styling | Tailwind CSS |
| Admin auth | NextAuth (single admin user via env vars) |

### Third-party accounts needed before building

- Stripe account (UK entity, connected to business bank)
- Twilio account — buy a UK long code number that supports two-way SMS
- Supabase project (free tier fine to start)
- Vercel account
- Domain for the service

---

## 2. Database Schema

Apply this to Supabase via the SQL editor.

```sql
-- CUSTOMERS
-- One row per subscriber. Phone is the primary identifier (used to match inbound SMS).
create table customers (
  id uuid primary key default gen_random_uuid(),
  phone text unique not null,           -- E.164 format e.g. +447700900000
  email text unique not null,
  first_name text,
  stripe_customer_id text unique,       -- Stripe Customer object ID
  stripe_payment_method_id text,        -- Default saved card
  dob date not null,                    -- For age verification
  age_verified boolean default false,   -- True once DOB confirmed 18+
  active boolean default true,          -- False if they've unsubscribed
  gdpr_marketing_consent boolean default false,
  gdpr_consent_at timestamptz,
  subscribed_at timestamptz default now(),
  unsubscribed_at timestamptz,
  case_started_at timestamptz,          -- When current case started filling. NULL if cellar empty. Reset after each shipment, set on first bottle of new case.
  case_nudge_1_sent_at timestamptz,     -- When 2.5-month nudge was sent. Reset when case_started_at resets.
  case_nudge_2_sent_at timestamptz,     -- When 3-month nudge was sent. Reset when case_started_at resets.
  tier text not null default 'none',    -- 'none' | 'elvet' | 'bailey' | 'palatine'. Set to 'elvet' on first successful order.
  tier_since timestamptz,               -- When current tier was assigned.
  tier_review_at timestamptz,           -- When tier next recalculates = tier_since + 12 months.
  backup_payment_method_id text,        -- Optional second Stripe PaymentMethod (set via portal).
  default_address jsonb                 -- Preferred shipping address {line1, line2, city, postcode}. Set via portal or from most recent shipment.
);

-- WINES
-- Each wine you might offer. Created in admin before sending a text.
create table wines (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  producer text,
  region text,
  country text,
  vintage int,
  description text,                     -- What goes in the text message
  price_pence int not null,             -- Store in pence, avoid float issues
  stock_bottles int not null default 0,
  active boolean default true,
  created_at timestamptz default now()
);

-- TEXTS
-- Each blast sent to subscribers. One row per send event.
create table texts (
  id uuid primary key default gen_random_uuid(),
  wine_id uuid references wines(id),
  body text not null,                   -- Exact message sent
  sent_at timestamptz default now(),
  recipient_count int
);

-- ORDERS
-- One row per order placed in response to a text.
create table orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  wine_id uuid references wines(id),
  text_id uuid references texts(id),
  quantity int not null,
  price_pence int not null,             -- Price at time of order (snapshotted)
  total_pence int not null,             -- quantity * price_pence
  stripe_payment_intent_id text,
  stripe_charge_status text,            -- 'pending' | 'succeeded' | 'failed' | 'requires_action'
  order_status text default 'awaiting_confirmation', -- 'awaiting_confirmation' | 'confirmed' | 'expired' | 'cancelled'
  confirmation_expires_at timestamptz,  -- now() + 10 minutes when order is created
  created_at timestamptz default now()
);

-- CELLAR
-- Bottles held for each customer. Separate from orders for clarity.
create table cellar (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  wine_id uuid references wines(id),
  order_id uuid references orders(id),
  quantity int not null,
  added_at timestamptz default now(),
  shipped_at timestamptz,
  shipment_id uuid references shipments(id)
);

-- SHIPMENTS
-- When a customer hits 12 bottles and requests their case.
create table shipments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  bottle_count int not null,
  shipping_address jsonb,
  status text default 'pending',        -- 'pending' | 'dispatched' | 'delivered'
  tracking_number text,
  created_at timestamptz default now(),
  dispatched_at timestamptz
);

-- VERIFICATION_CODES
-- Temporary SMS codes for phone verification at sign-up.
create table verification_codes (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  code text not null,
  expires_at timestamptz not null,
  used boolean default false,
  attempt_count int default 0,
  created_at timestamptz default now()
);
```

### Useful view — customer cellar totals

```sql
create view customer_cellar_totals as
select
  customer_id,
  sum(quantity) as total_bottles
from cellar
where shipped_at is null
group by customer_id;
```

---

## 3. Sign-Up Flow

### Route structure

```
/join               → Step 1: Phone number
/join/verify        → Step 2: Verify code
/join/details       → Step 3: DOB + consent
/join/address       → Step 4: Delivery address (NEW)
/join/card          → Step 5: Card + email
/join/confirmed     → Confirmation
```

Use server-side session cookies to carry state across steps (phone, Stripe IDs). Nothing sensitive in the URL.

### Step 1 — Phone number

- Single input: UK mobile number
- Normalise to E.164 on submit (+44...)
- Check phone doesn't exist in `customers` — if it does, show "looks like you're already signed up"
- Generate a random 6-digit code
- Insert into `verification_codes` with `expires_at = now() + 10 minutes`
- Send via Twilio: "Your [Brand] verification code is: 123456"
- Redirect to /join/verify

### Step 2 — Verify code

- Single 6-digit input
- On submit: check code exists, matches, not used, not expired, attempt_count < 3
- If invalid: increment attempt_count, show error
- If attempt_count >= 3: show "too many attempts, please try again later"
- If valid: mark code as used, store phone in session, redirect to /join/card

### Step 3 — Personal details + consent

(Previously Step 4 — moved earlier in the flow.)

- First name
- Date of birth (day/month/year dropdowns — not a date picker)
- Checkbox: "I confirm I am 18 or over and a UK resident" (required)
- Checkbox: "I agree to receive promotional SMS messages from [Brand]. Reply STOP at any time to unsubscribe." (required)
- On submit:
  - Validate DOB >= 18 years old — hard stop if not, do not proceed
- Redirect to /join/address

### Step 4 — Delivery address (NEW)

Collect a UK delivery address for future shipments. This is saved to `customers.default_address` on completion and pre-fills the /ship page so customers never need to re-enter it unless it's changed.

- Address line 1 (required)
- Address line 2 (optional)
- City (required)
- Postcode (required — uppercase on save)
- On submit: save to iron-session under key `address`, redirect to /join/card
- Style: matches existing join pages (dark maroon card, cream inputs, Rio Red CTA)

On `/api/signup/complete`: after creating the customer row, write `default_address` to the customer record from session if present.

### Step 5 — Card details + email

- Stripe Elements embedded card input
- Email input
- On submit:
  1. `stripe.customers.create({ email, phone })`
  2. `stripe.setupIntents.create({ customer: stripeCustomerId, usage: 'off_session' })`
  3. Frontend confirms SetupIntent with Stripe Elements
  4. On success: store `stripeCustomerId` and returned `PaymentMethod.id` in session
- Redirect to /join/details

### Step 5 — Confirmed (was Step 5)

- Static page: "You're in. Look out for your first text soon."

### API routes

```
POST /api/signup/send-code              → validate phone, send Twilio SMS, insert verification_codes
POST /api/signup/verify-code            → check code, mark used
POST /api/signup/save-address           → validate + save address to iron-session
POST /api/signup/create-setup-intent    → create Stripe customer + SetupIntent, return client_secret
POST /api/signup/complete               → validate DOB, create customer record in Supabase, save default_address from session
```

---

## 4. SMS & Ordering Flow

### Outbound — Sending a text blast

Admin action. Triggered from `/admin/send`.

1. Admin selects a wine
2. Edits message body (pre-filled template)
3. Confirms send
4. API route:
   - Fetches all customers where `active = true`
   - Loops through, calls `twilio.messages.create()` for each with the message body
   - Inserts one row into `texts` with recipient count
   - Log any individual send failures without aborting the whole blast

**Default message template:**
```
[Wine name] – [Region, Country]. [Description]. £[price]/bottle.
Reply with how many bottles you'd like. Reply STOP to unsubscribe.
```

Note: at scale (500+ customers) switch to Twilio Messaging Services with built-in rate limiting. Fine to loop at MVP.

### Inbound — Customer replies

```
POST /api/webhooks/twilio/inbound
```

**Security:** Validate every request using `twilio.validateRequest()` with your auth token and request URL. Reject anything that fails. This is critical.

**Logic:**

1. Extract `From` (sender phone, E.164) and `Body` (message text, trim + lowercase)

2. Look up customer by phone
   - Not found → reply: "Sorry, we don't recognise this number. Sign up at [url]"
   - Found but `active = false` → reply: "You're unsubscribed. Visit [url] to rejoin."

3. Parse body:
   - `stop` or `unsubscribe` → set `active = false`, `unsubscribed_at = now()`, reply: "You've been unsubscribed. Visit [url] to rejoin."
   - `yes` → trigger YES confirmation flow (see below)
   - `ship` → trigger SHIP flow (see below)
   - Positive integer → treat as bottle quantity, create pending order
   - Anything else → send menu reply (see Unrecognised message handling)

4. If valid quantity — CREATE PENDING ORDER (do NOT charge yet):
   a. Find most recent row in `texts` — this is the active offer. If none: reply "No wine available yet — watch this space!"
   b. Check for existing unconfirmed pending order: if an `orders` row exists where `customer_id` matches AND `order_status = 'awaiting_confirmation'` → cancel the old one (set status 'cancelled', release stock) and continue with the new one. Only one pending order at a time per customer.
   c. Check for confirmed order on this text: if `orders` row exists where `customer_id` matches AND `text_id` matches AND `order_status = 'confirmed'` → reply: "You've already ordered from this one! Your bottles are safely in the cellar."
   d. Check stock: `wines.stock_bottles >= quantity`. If not: reply: "Gutted — we only have [n] bottles left of that one. Reply [n] to grab them."
   e. Cap quantity at MAX_BOTTLES_PER_ORDER env var (default 12). If over: reply: "We cap orders at [max] bottles per text — reply [max] if you'd like the maximum."
   f. Reserve stock: decrement `wines.stock_bottles` by quantity immediately (to prevent double-orders). Will be released if order expires or is cancelled.
   g. Insert `orders` row with `order_status: 'awaiting_confirmation'`, `confirmation_expires_at: now() + 10 minutes`
   h. Reply:
      ```
      Got it — [n] x [wine name] at £[price]/bottle = £[total].
      Reply YES to confirm and pay, or ignore to cancel.
      ```

5. YES flow — CONFIRM AND CHARGE:
   a. Look for an order where `customer_id` matches AND `order_status = 'awaiting_confirmation'`
   b. If none found: reply "No pending order to confirm — just reply with a number when you see our next text."
   c. Check expiry: if `confirmation_expires_at < now()`: set `order_status = 'expired'`, release stock, reply "That one timed out — reply with a number to start again."
   d. Attempt charge:
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
   e. If payment succeeds:
      - Update `orders` row: `order_status: 'confirmed'`, `stripe_charge_status: 'succeeded'`
      - Insert `cellar` row(s) for the quantity
      - Set `case_started_at = now()` on customer IF `case_started_at IS NULL` (i.e. this is the first bottle of a new case)
      - Query new cellar total for this customer
      - Run **post-charge scenario logic** (see below)
   f. If payment `requires_action` (3DS required):
      - Update order with `stripe_charge_status: 'requires_action'`
      - Generate a short-lived signed token (JWT or UUID stored in DB)
      - Reply: "We need you to verify this payment. Visit [url]/authenticate?token=[token] to complete your order."
   g. If payment fails:
      - Update order with `order_status: 'confirmed'`, `stripe_charge_status: 'failed'`
      - Release stock (increment `wines.stock_bottles` back)
      - Reply: "Your payment didn't go through. Update your card at [url]/billing and try again."

### Post-charge scenario logic (runs after every successful payment)

Calculate `new_total` = customer's current total unshipped cellar bottles (after inserting the new row).
Calculate `case_deadline` = `case_started_at + 90 days` (formatted as e.g. "15 June").

**Scenario 1 — New total is below 12:**
```
Done — [n] x [wine name] in the cellar. You've now got [total] bottles.

Fill your case by [case_deadline] for free shipping — or reply SHIP anytime to send early for £15.
```

**Scenario 2 — New total is exactly 12:**
```
Done — your cellar just hit 12! Here's what you've got:

[2x Wine A — £X/bottle]
[1x Wine B — £X/bottle]
[etc.]

Reply SHIP to arrange your free case. Or reply PAUSE if you want to hold it.
```
Also set `case_started_at = NULL`, `case_nudge_1_sent_at = NULL`, `case_nudge_2_sent_at = NULL` on customer — the case is done, next bottle starts a fresh case.

**Scenario 3 — New total is over 12:**
Determine which bottles to ship: pull oldest 12 by `added_at` from unshipped `cellar` rows. The remainder stay in the cellar.

1. Create a `shipments` row for the 12 oldest bottles
2. Mark those 12 cellar rows with `shipment_id` and `shipped_at = now()`
3. Calculate `remaining` = new_total - 12
4. Reset case timer on customer: `case_started_at = now()`, `case_nudge_1_sent_at = NULL`, `case_nudge_2_sent_at = NULL`

Reply:
```
Done — and you've hit 12! We've split your order: your oldest 12 bottles are ready to ship (free), and [remaining] start your next case.

Case ready to go:
[list the 12 oldest bottles]

Reply SHIP to arrange delivery.
```

**The SHIP flow (triggered by customer replying "ship"):**

- Check cellar total >= delivery threshold (12 for Bailey/Elvet, 6 for Palatine)
  - If not: reply "You've got [n] bottles so far — you need [threshold] for free shipping. Or reply SHIP CONFIRM to send early for £15."
  - If yes:
    - Look up `customers.default_address`
    - **If saved address exists:**
      - Insert `shipments` row with `status: 'awaiting_confirmation'`, `shipping_address: savedAddress`
      - Pre-link all unshipped cellar rows: `UPDATE cellar SET shipment_id = newShipment.id WHERE customer_id = X AND shipped_at IS NULL`
      - Reply:
        ```
        Your [n] bottles are ready to go. We've got this address:

        [line1][, line2 if present]
        [city], [postcode]

        Reply YES to send it, or CHANGE to update.
        ```
    - **If no saved address:**
      - Insert `shipments` row with `status: 'pending'`
      - Generate a signed token for the customer
      - Reply: "Brilliant! Confirm your delivery address at [url]/ship?token=[token]"

**Shipments status values:** `'awaiting_confirmation'` | `'pending'` | `'confirmed'` | `'paused'` | `'dispatched'` | `'delivered'`

**YES handler priority:** When a customer replies YES, check for an `awaiting_confirmation` shipment FIRST, before checking for a pending order. If a shipment is awaiting confirmation, call `handleShipYes`. If not, fall through to pending order confirmation. (Edge case: if customer somehow has both pending, shipment takes priority.)

**`handleShipYes`:**
1. Update shipment: `status = 'confirmed'`
2. Mark pre-linked cellar rows as shipped: `UPDATE cellar SET shipped_at = now() WHERE shipment_id = shipment.id AND shipped_at IS NULL`
3. Legacy fallback: if no rows found with that shipment_id, link and mark all unshipped rows for this customer
4. Reset case timer: `case_started_at = NULL, case_nudge_1_sent_at = NULL, case_nudge_2_sent_at = NULL`
5. Reply: "Confirmed — your bottles are on their way to [line1], [city], [postcode]. We'll be in touch when they're dispatched."

**Always return valid TwiML from this route:**
```xml
<Response/>
```
Send any reply messages via the Twilio REST API, not via TwiML `<Message>` tags (easier to control async).

### SMS commands — full list

| Customer texts | Action |
|---|---|
| A number (e.g. `2`) | Creates pending order, sends confirmation text with total — does NOT charge yet |
| `YES` | (1) If shipment awaiting confirmation → confirms shipment. (2) Otherwise → confirms pending order, charges card |
| `CHANGE` | If shipment awaiting address confirmation → sends /ship link to update address for that specific shipment |
| `ACCOUNT` | Sends link to customer portal (/portal) — change address, payment method, view membership |
| `STOP` / `UNSUBSCRIBE` | Unsubscribe |
| `CELLAR` | Receive list of all bottles currently in cellar |
| `SHIP` | If ≥12 bottles: free shipping flow. If <12: ask to confirm £15 fee |
| `SHIP CONFIRM` | Confirms £15 early shipping charge |
| `PAUSE` | Pause a pending shipment (sets status to 'paused') |
| `SNOOZE` / `SNOOZE [weeks]` | ⏸ Not building yet — parked for later |
| `RESUME` | ⏸ Not building yet — parked for later |
| `REQUEST [message]` | Special request → admin panel + email to hello@crushwines.co |
| `QUESTION [message]` | Concierge inbox → admin panel + email to hello@crushwines.co |

**Tone note for all SMS replies:** Laid back, warm, a bit fun. Reference: Rochambeau Club. Not corporate, not apologetic. Short sentences. Never "We're sorry for the inconvenience."

### Unrecognised message handling — menu/triage

Any message that doesn't match a known command (number, STOP, CELLAR, SHIP, PAUSE, REQUEST, QUESTION, SHIP CONFIRM) should return the menu. This includes greetings like "hey", "hello", "hi", "menu", "help", or anything else unrecognised.

**Menu reply:**
```
Hey! Here's what you can do:

CELLAR — see what's in your cellar
SHIP — send your bottles (free at 12, £15 before that)
STATUS — see your membership tier
ACCOUNT — manage your address, payment and membership
REQUEST — suggest a wine for us to feature
QUESTION — ask us anything
STOP — unsubscribe

Just reply with one of the above.
```

### Trigger word prompts (when sent without a message body)

If a customer texts just `REQUEST` with nothing after it:
```
What would you like us to feature? Tell us a bit about it — e.g. "REQUEST something from Georgia", "REQUEST Attis Mar Albariño" or "REQUEST Chateau Musar".
```

If a customer texts just `QUESTION` with nothing after it:
```
What's on your mind? Ask us anything — e.g. "QUESTION can you help me find a special wine gift?" or "QUESTION when will my case be dispatched?".
```

These prompts only fire when the trigger word is sent alone. If the message includes content after the trigger word (e.g. "REQUEST a skin-contact white from Slovenia"), process it immediately without prompting.

### 12-bottle auto-notification

When a successful order takes a customer's cellar total to exactly 12 (or above for the first time), automatically send:
```
Your cellar just hit 12 bottles! Here's what you've got:
- 2x [Wine A] (£X/bottle)
- 3x [Wine B] (£X/bottle)
[etc]
We'll ship your case tomorrow — free of charge. Reply PAUSE if you'd like to hold it.
```
Check for this trigger after every successful payment in the inbound webhook and Stripe webhook handler.

### API routes

```
POST /api/webhooks/twilio/inbound     → all inbound SMS
POST /api/webhooks/stripe             → Stripe async events
POST /api/texts/send                  → admin sends blast
GET  /api/texts                       → list sent texts (admin)
POST /api/ship/confirm                → customer submits address
GET  /api/ship/[token]                → validate token, return customer info for /ship page
```

---

## 5. Admin Interface

Access at `/admin`. Protected by NextAuth. Single admin user defined in env vars (`ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`).

### `/admin` — Dashboard

- Total active subscribers
- Total bottles currently in cellar
- Last text sent (date + wine)
- Pending shipments count
- Recent orders (last 10): customer name, wine, quantity, amount, status

### `/admin/customers` — Customer list

- Table: name, phone, email, cellar total, join date, active status
- Click customer → detail view with order history + cellar contents
- Button to manually deactivate (unsubscribe) a customer

### `/admin/wines` — Wine library

- Table: name, country, price, stock, active
- Add wine form: name, producer, region, country, vintage, description, price (£), stock quantity
- Edit wine
- Toggle active/inactive

### `/admin/send` — Send a text

- Dropdown: select active wine
- Message body textarea (pre-filled with template, editable)
- Live character counter with segment warning (160 chars = 1 SMS, warn at 155)
- Subscriber count: "This will go to [n] active subscribers"
- Preview of the exact message
- Send button → confirmation modal → sends

### `/admin/texts` — Text history

- List: date, wine, recipient count, order count, conversion rate
- Click through to see message body + all orders generated

### `/admin/shipments` — Shipment management

- List: customer, bottles, address, status
- Mark dispatched (enter tracking number)
- Mark delivered

### `/admin/billing` — Failed payments

- List customers with failed/requires_action orders
- Deep link to Stripe dashboard for each customer
- Manual retry charge button

### `/admin/customers/[id]` — Customer detail (additions)

- **Refund per bottle:** for each cellar item, show a refund button. On click: issue Stripe refund for that bottle's price, remove from `cellar`, insert into `refunds` table. After successful refund, send customer SMS: "Your refund of £[amount] is on its way — expect it back in 3–5 working days." Bug: refund currently hangs on three dots — fix required (see backlog prompt).
- **Partial refund:** if they ordered multiple bottles in one order, allow partial quantity refund (e.g. refund 1 of 3)
- **Manual add bottles:** dropdown to select a wine from the library + quantity input → inserts directly into `cellar` without charging (for comps, corrections, goodwill). **Must check `wines.stock_bottles >= quantity` before inserting — show error and block if insufficient stock. Decrement stock on save.**
- **Trigger payment for manually-added bottles:** *(backlog)* Each manually-added cellar item should have a "Charge" button alongside the "Refund" button. Clicking it creates a Stripe PaymentIntent for that bottle's price and charges the customer's saved card off-session. If successful, update the relevant `cellar` row to indicate it was charged. This allows correcting situations where bottles were added for free that should have been paid for.

### `/admin/requests` — Special requests (new)

- List of all `REQUEST` messages from customers
- Shows: customer name, phone, message, timestamp, status (new / in_progress / resolved)
- Mark as resolved

### `/admin/concierge` — Concierge inbox (new)

- List of all `QUESTION` messages from customers
- Shows: customer name, phone, message, timestamp, replied status
- Full thread view per customer — inbound and outbound messages in chronological order
- Reply input in admin — sends SMS via Twilio, logs as outbound in `concierge_messages`
- Email to hello@crushwines.co is a **notification only** ("New question from [name] — reply in the admin panel: [link]"). Do not build email-reply-to-SMS routing.
- Same pattern for `/admin/requests` — email is notification only, action happens in admin

---

## 6. Customer-facing pages

### `/ship?token=[token]`

- Validate token (check shipments table, not expired)
- Display: bottle count, customer name, **list of wines in this shipment**
- Address handling: check if the customer has a previous shipment with a saved address. If yes, pre-fill all address fields with that address and show a note: "We'll ship to your saved address — update below if anything's changed."
- Form: delivery address (line 1, line 2, city, postcode) — pre-filled if previous address exists
- **The submit button should clearly frame this as a confirmation** — e.g. "Confirm and ship to this address →". They're confirming their address is correct, not just filling a form.
- Submit → update shipment with address, mark status 'confirmed'
- Confirmation page: "Your case is on its way soon!"

### `/authenticate?token=[token]`

- Validate token (check orders table for requires_action order)
- Use Stripe Elements to complete 3DS authentication
- On success: update order status to succeeded, add to cellar, reply via Twilio with cellar update

### `/billing`

- Simple page for customers to update their card
- Stripe Elements to capture new card
- Updates `stripe_payment_method_id` in customer record and in Stripe

### `/unsubscribe`

- Basic unsubscribe page (alternative to texting STOP)
- Identify by email or phone
- Set active = false

### `/portal` — Customer portal

No-password login. Customers authenticate via SMS OTP (same `verification_codes` table as sign-up, different flow). Issues a portal JWT stored in an httpOnly cookie, valid for 30 days.

**Login flow:**
```
/portal                  → phone number input
POST /api/portal/send-otp → validate phone exists in customers, send OTP, insert verification_codes
/portal/verify           → 6-digit code input
POST /api/portal/verify-otp → check code, issue portal JWT cookie, redirect to /portal/dashboard
```

**`/portal/dashboard` — single screen, mobile-first layout (top to bottom):**

1. **Tier card** (full width, most prominent element)
   - Tier name in large Cormorant Garamond (ELVET / BAILEY / PALATINE)
   - Current rolling 12-month spend: "£247 this year"
   - Progress bar to next tier (Rio Red fill). If Palatine: "You're at the top."
   - Spend to next tier: "£254 until Elvet"
   - Mini benefit comparison: a small two-column inline comparison of current tier benefits vs next tier

2. **Cellar** (collapsible section on mobile)
   - Total bottle count + list of wines with quantities
   - Case deadline if case_started_at is set: "Free shipping if full by 15 June"
   - "Reply SHIP to your phone number to arrange delivery"

3. **Payment**
   - Primary card: masked number (•••• 4242), expiry — with "Update" button
   - Backup card: masked number or "None added" — with "Add backup" / "Update" button
   - Swap button if backup exists: "Make backup my primary"
   - Updating a card uses Stripe Elements (same as /billing page)

4. **Delivery address**
   - Show saved default_address if set, else "No address saved"
   - Edit form: line 1, line 2, city, postcode
   - Save → updates `customers.default_address`

**API routes for portal:**
```
GET  /portal/dashboard                → dashboard (portal auth required)
POST /api/portal/send-otp             → send login OTP
POST /api/portal/verify-otp           → verify OTP, issue cookie
POST /api/portal/logout               → clear cookie
POST /api/portal/update-address       → update default_address
POST /api/portal/update-card          → update primary or backup PaymentMethod via Stripe
POST /api/portal/swap-cards           → swap stripe_payment_method_id ↔ backup_payment_method_id
GET  /api/portal/me                   → return customer data for dashboard (tier, cellar, spend, cards)
```

**Portal session:** JWT signed with `PORTAL_JWT_SECRET` (new env var). Payload: `{ customerId, phone, iat, exp }`. Verified on every portal API route. Do not use NextAuth for this — it's a separate lightweight session.

---

## 7. Business Logic Rules

- A customer can only order once per text blast (check `customer_id` + `text_id` + `order_status = 'confirmed'` before processing)
- Orders are created with `order_status = 'awaiting_confirmation'` — card is NOT charged until customer replies YES
- Pending orders expire after 10 minutes — if YES arrives after expiry, reply with expiry message and release reserved stock
- Only one pending order per customer at any time — if a new order comes in, cancel the previous pending one and release its reserved stock
- Stock is reserved immediately on pending order creation. Released on expiry or cancellation. Only permanently decremented if charge fails (then released) or removed from cellar on shipment.
- Admin manual adds go through the same confirmation flow — create pending order, send confirmation SMS, charge on YES
- Cellar count = `sum(cellar.quantity) where shipped_at is null and customer_id = X`
- Free shipping triggers at exactly 12 bottles — orders that push a customer over 12 trigger the split logic (oldest 12 to shipment, remainder stay in cellar)
- When a shipment is created for a full case, mark the relevant 12 cellar rows with `shipment_id` and `shipped_at = now()`. Reset `case_started_at`, `case_nudge_1_sent_at`, `case_nudge_2_sent_at` to NULL on the customer.
- `price_pence` in `orders` is snapshotted at time of order — never updated retroactively
- All money stored in pence (integers). Display as £X.XX.
- Twilio inbound webhook must be idempotent — check for existing pending/confirmed order before creating

### Tier System — Bailey / Elvet / Palatine

**Thresholds (rolling 12-month spend):**
| Tier | Threshold |
|---|---|
| Bailey | First successful order (automatic) — entry tier |
| Elvet | ≥ £501 rolling 12-month spend |
| Palatine | ≥ £1,000 rolling 12-month spend |

**Annual spend calculation:** Always calculated dynamically — never stored. Query:
```sql
SELECT COALESCE(SUM(total_pence), 0)
FROM orders
WHERE customer_id = :id
  AND stripe_charge_status = 'succeeded'
  AND created_at >= now() - interval '365 days'
```

**Tier model:**
- Status once earned is **locked for 12 months** from the date it was achieved (`tier_since`), regardless of what rolls out of the window during that time
- **Upgrades:** immediate — checked after every successful payment. If rolling spend just crossed a threshold, upgrade tier, set `tier_since = now()`, `tier_review_at = now() + 12 months`, send congratulations SMS
- **Downgrades:** only at `tier_review_at`. Recalculate rolling spend at that date. If below current threshold, drop **one tier at a time** (Palatine → Elvet, Elvet → Bailey — never skip). Set new `tier_since = now()`, new `tier_review_at = now() + 12 months`. Send notification SMS if downgraded.
- **First order:** set `tier = 'bailey'`, `tier_since = now()`, `tier_review_at = now() + 12 months`

**Benefits (marketing only — no code enforcement except where noted):**

| | Bailey | Elvet | Palatine |
|---|---|---|---|
| Free delivery | Per 12 bottles | Per 12 bottles | Per 6 bottles |
| Free storage | Up to 3 months | Up to 3 months | Up to 6 months |
| Build your own case | ✓ | ✓ | ✓ |
| Requests | Unlimited | Unlimited | Unlimited |
| Questions | 5/month | 10/month | Unlimited |
| Discount | — | 5% off | 10% off |
| Wine tasting | — | 1× per year | 1× per quarter |
| Birthday gift | — | — | ✓ |
| Early texts | — | — | 2 hours early (backlog) |

Note: question limits, discounts, early texts, and birthday gifts are **not code-enforced at launch** — handle manually. Enforce once subscriber base justifies it.

**Palatine free delivery at 6 bottles:** When a Palatine customer's cellar hits 6, the post-charge scenario logic should trigger the "case ready" notification (same as the 12-bottle notification for other tiers). Build this as a tier-aware threshold in `handlePostCharge`.

**Congratulations SMS — upgrading to Elvet:**
```
You're now an Elvet member — welcome to the next level.

You've spent £[X] with The Cellar Club this year.

What you now get:
— 5% off every bottle
— Free wine tasting, once a year
— 10 concierge questions a month

Visit [url]/portal to see your membership.
```

**Congratulations SMS — upgrading to Palatine:**
```
You've reached Palatine. That's the top.

You've spent £[X] with The Cellar Club this year.

What that means:
— 10% off every bottle
— Free delivery from 6 bottles
— Quarterly wine tastings
— Unlimited concierge
— A birthday gift from us

Visit [url]/portal to see your membership.
```

**STATUS command (inbound SMS):**
Add `status` to the inbound webhook parser. Reply:
```
You're a [Bailey/Elvet/Palatine] member.

Spent this year: £[X]
[If not Palatine: Next tier ([name]) at £[threshold] — £[gap] to go.]
[If Palatine: You're at the top. Thank you.]

[url]/portal for your full membership.
```

**Tier review cron:** Add to the existing daily cron job (`/api/cron/case-nudges`). For each customer where `tier_review_at <= today`: recalculate tier from rolling 12m spend, apply downgrade logic if needed, notify if changed.

### 3-Month Case Rule

Every customer has a case timer (`case_started_at` on the `customers` table) that tracks how long their current case has been filling. The timer:
- Starts when the first bottle of a new case lands in the cellar (set `case_started_at = now()`)
- Resets to NULL when a full case ships (12-bottle shipment created)
- Is NULL for customers with an empty cellar

A daily Vercel Cron job checks all customers with bottles in their cellar and sends nudges / triggers auto-shipment:

**Nudge 1 — at 2.5 months (75 days):**
Condition: `case_started_at <= now() - 75 days` AND `case_nudge_1_sent_at IS NULL`
Action: Send SMS, set `case_nudge_1_sent_at = now()`
```
You've got [n] bottles in your cellar — your case needs to be full by [case_started_at + 90 days formatted as "15 June"] for free shipping.

Want to ship early? Reply SHIP and we'll send what you've got for £15.
```

**Nudge 2 — at 3 months (90 days):**
Condition: `case_started_at <= now() - 90 days` AND `case_nudge_2_sent_at IS NULL`
Action: Send SMS, set `case_nudge_2_sent_at = now()`
```
Last chance — you've got [n] bottles and your case closes in 2 weeks. We'll ship automatically on [case_started_at + 104 days formatted as "29 June"] for £15.

Reply SHIP CONFIRM to send now, or keep topping up for free shipping.
```

**Auto-ship — at 3 months + 2 weeks (104 days):**
Condition: `case_started_at <= now() - 104 days` AND `case_nudge_2_sent_at IS NOT NULL`
Action:
1. Charge customer £15 shipping via Stripe (new PaymentIntent, off-session)
2. Create a `shipments` row with `shipping_fee_pence: 1500`, status 'pending'
3. Mark all unshipped cellar rows with `shipment_id` and `shipped_at = now()`
4. Reset case timer on customer
5. Send SMS:
```
Time's up — we've popped your [n] bottles in the post and charged £15 for shipping. You'll get a tracking number shortly.
```
If the £15 charge fails, do NOT ship — send SMS: "We tried to ship your case but the payment didn't go through. Update your card at [url]/billing and reply SHIP CONFIRM to try again."

---

## 7b. Scheduled Jobs (Vercel Cron)

Add to `vercel.json`:
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

`GET /api/cron/case-nudges` — runs daily at 9am UTC. Protected by `CRON_SECRET` env var (Vercel sets `Authorization: Bearer <secret>` on cron requests — verify this on every request).

Logic:
1. Fetch all customers where `active = true` AND `case_started_at IS NOT NULL`
2. For each customer, calculate days since `case_started_at`
3. Apply nudge/auto-ship rules from Section 7 above
4. Log all actions taken (SMS sent, shipments created)

Add `CRON_SECRET` to env vars list.

---

## 8. Compliance Requirements

### UK Licensing Act 2003

- Display Premises Licence number in the footer on all pages
- Display: "We do not sell alcohol to anyone under 18"
- Hard DOB check at sign-up — reject under-18s, do not allow workarounds

### GDPR / UK GDPR

- Collect and store explicit marketing consent at sign-up (checkbox + timestamp)
- Privacy Policy page (required) — cover: data collected, purpose, retention, processors (Stripe, Twilio), deletion rights
- Terms & Conditions page (required) — cover: service description, ordering, pricing, cellar terms, shipping, cancellation
- Right to erasure: build `DELETE /api/admin/customers/[id]/erase` that:
  - Deletes the Stripe customer (`stripe.customers.del(stripeCustomerId)`)
  - Deletes or anonymises the Supabase customer row and linked data
  - Logs the erasure request date

### Responsible drinking

- Footer on all pages: "Please drink responsibly. Alcohol should not be consumed by anyone under 18."

### Stripe SCA / 3DS

- SetupIntent for card capture at sign-up handles 3DS automatically via Stripe Elements
- Off-session charges (ordering by text) may trigger `requires_action` — handle with the `/authenticate` page flow described in Section 4

---

## 9. Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Stripe
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=

# Twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=              # E.164 format, e.g. +441234567890

# Admin auth
ADMIN_EMAIL=
ADMIN_PASSWORD_HASH=              # bcrypt hash
NEXTAUTH_SECRET=
NEXTAUTH_URL=                     # e.g. https://yourdomain.com

# App config
NEXT_PUBLIC_APP_URL=              # e.g. https://yourdomain.com
MAX_BOTTLES_PER_ORDER=12
```

---

## 10. Recommended Build Order

1. Project scaffold — Next.js + Supabase + Tailwind + Stripe + Twilio installed, all env vars stubbed with placeholder values
2. Apply database schema to Supabase
3. Sign-up flow (Steps 1–5) — build and test end to end before moving on
4. Twilio inbound webhook handler (the core ordering logic)
5. Admin: wine management (CRUD)
6. Admin: send text blast
7. Admin: dashboard + customer list
8. Admin: shipments + billing views
9. `/ship` page — customer shipping address collection
10. Stripe webhook handler — async payment events (`payment_intent.succeeded`, `payment_intent.payment_failed`)
11. `/authenticate` page — 3DS fallback
12. `/billing` page — customer card update
13. Compliance pages (Privacy Policy, T&Cs — content to be provided separately)
14. End-to-end test with Stripe test mode and Twilio test credentials

---

## 11. Phase 2 Features (backlog)

### Stock philosophy
Out-of-stock is first-come first-served by design. No admin low-stock alerts needed — scarcity is part of the proposition. When a wine sells out mid-blast, the reply should feel laid back and fun, not like an error message. Tone reference: Rochambeau Club. Example: "Gutted — that one's gone. We move fast around here. Keep an eye out for the next drop." Avoid: "Sorry, we're out of stock."

### SMS: SNOOZE command (pause offer texts) — PARKED, do not build yet
Intentionally not building at launch — want to maximise engagement early on. Revisit when subscriber base is established.
When built: `SNOOZE [weeks]` sets `texts_snoozed_until` on customer, blast logic skips them, `RESUME` clears it early.

### Additional database tables needed

```sql
-- SPECIAL_REQUESTS
-- Triggered when customer texts REQUEST [message]
create table special_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  message text not null,
  status text default 'new',            -- 'new' | 'in_progress' | 'resolved'
  created_at timestamptz default now(),
  resolved_at timestamptz
);

-- CONCIERGE_MESSAGES
-- Triggered when customer texts QUESTION [message]. Tracks full thread.
create table concierge_messages (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  direction text not null,              -- 'inbound' | 'outbound'
  message text not null,
  created_at timestamptz default now()
);

-- REFUNDS
-- Tracks refunds issued from admin panel per bottle/order
create table refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id),
  customer_id uuid references customers(id),
  cellar_id uuid references cellar(id),
  quantity int not null,
  amount_pence int not null,
  stripe_refund_id text,
  reason text,
  created_at timestamptz default now()
);
```

### New SMS commands to add to inbound webhook

**CELLAR**
- Query all unshipped `cellar` rows for customer, join with `wines`
- Reply with formatted list: "Your cellar: 2x Malbec (£15), 1x Riesling (£18). Total: 3 bottles."
- If empty: "Your cellar is empty — watch out for our next text!"

**SHIP (updated)**
- If cellar ≥ 12: existing free shipping flow (send /ship link)
- If cellar < 12: reply "You've got [n] bottles. Shipping now costs £15. Reply SHIP CONFIRM to go ahead, or keep collecting for free shipping at 12."
- SHIP CONFIRM: create shipment, charge £15 via Stripe, send /ship link
- Add `shipping_fee_pence int default 0` to `shipments` table

**PAUSE**
- Find the customer's most recent shipment with status 'pending' or 'confirmed'
- Set status to 'paused'
- Reply: "Got it — your shipment is on hold. Text SHIP when you're ready to resume."

**REQUEST [message]**
- Extract message body (everything after REQUEST)
- Insert into `special_requests`
- Send notification email to hello@crushwines.co: "New special request from [name] — view it in the admin panel: [url]/admin/requests"
- Do NOT build email-reply routing — all responses handled from admin panel
- Reply to customer: something warm, e.g. "Got it — we'll take a look and be in touch."

**QUESTION [message]**
- Extract message body (everything after QUESTION)
- Insert into `concierge_messages` as direction: 'inbound'
- Send notification email to hello@crushwines.co: "New question from [name] — reply in the admin panel: [url]/admin/concierge"
- Do NOT build email-reply routing — all responses handled from admin panel
- Reply to customer: something warm, e.g. "Good question — we'll get back to you shortly."

### 12-bottle auto-notification trigger

After every successful payment (in both inbound webhook and Stripe webhook handler), check if this order pushed the customer's cellar to ≥ 12 for the first time (i.e. previous total was < 12, new total is ≥ 12).

If triggered, send:
```
Your cellar just hit 12 bottles! Here's what you've got:
[list of wines + quantities]
We'll ship your case tomorrow, free of charge.
Reply PAUSE if you'd like to hold it.
```

### Email notifications

Add `RESEND_API_KEY` to env vars. Use Resend (https://resend.com) for transactional email — clean Next.js integration, generous free tier.

**Decision — no order receipt emails.** Everything order-related stays in SMS. Adding email receipts creates a second channel to manage and is unnecessary for most wine orders. The only email that goes to customers is shipment dispatch (because it carries a tracking number that's easier to tap from email). All other customer comms are SMS only.

Emails to send:
- REQUEST received → hello@crushwines.co (admin notification only)
- QUESTION received → hello@crushwines.co (admin notification only)
- Shipment dispatched → customer (with tracking number — this is the only customer-facing email)
- ~~Failed payment → customer~~ — handled by SMS only

### Updated build order (Phase 2)

15. New SMS commands (CELLAR, SHIP with fee, PAUSE, REQUEST, QUESTION) + 12-bottle trigger
16. Admin: refund + manual add (customer detail page additions)
17. Admin: /requests and /concierge pages
18. Email notifications via Resend
19. `/authenticate` page (3DS fallback)
20. `/billing` page (customer card update)
21. Compliance pages (Privacy Policy, T&Cs)

---

*Project: The Cellar Club — Craig Lappin-Smith / Crush wine bar*
*Spec last updated: 2026-03-18*
