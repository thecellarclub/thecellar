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
| Stripe webhook handler | ⏳ In progress |
| `/ship` page | ⏳ In progress |
| `/authenticate` page (3DS) | ⏳ To do |
| `/billing` page (card update) | ⏳ To do |
| Compliance pages | ⏳ To do |
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
  unsubscribed_at timestamptz
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
/join/card          → Step 3: Card + email
/join/details       → Step 4: DOB + consent
/join/confirmed     → Step 5: Confirmation
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

### Step 3 — Card details + email

- Stripe Elements embedded card input
- Email input
- On submit:
  1. `stripe.customers.create({ email, phone })`
  2. `stripe.setupIntents.create({ customer: stripeCustomerId, usage: 'off_session' })`
  3. Frontend confirms SetupIntent with Stripe Elements
  4. On success: store `stripeCustomerId` and returned `PaymentMethod.id` in session
- Redirect to /join/details

### Step 4 — Personal details + consent

- First name
- Date of birth (day/month/year dropdowns — not a date picker)
- Checkbox: "I confirm I am 18 or over and a UK resident" (required)
- Checkbox: "I agree to receive promotional SMS messages from [Brand]. Reply STOP at any time to unsubscribe." (required)
- On submit:
  - Validate DOB >= 18 years old — hard stop if not, do not proceed
  - Create customer row in Supabase with all collected data:
    - `age_verified: true`
    - `gdpr_marketing_consent: true`
    - `gdpr_consent_at: now()`
- Redirect to /join/confirmed

### Step 5 — Confirmed

- Static page: "You're in. Look out for your first text soon."

### API routes

```
POST /api/signup/send-code              → validate phone, send Twilio SMS, insert verification_codes
POST /api/signup/verify-code            → check code, mark used
POST /api/signup/create-setup-intent    → create Stripe customer + SetupIntent, return client_secret
POST /api/signup/complete               → validate DOB, create customer record in Supabase
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
   - `ship` → trigger SHIP flow (see below)
   - Positive integer → treat as bottle quantity
   - Anything else → reply: "Just reply with a number to order (e.g. '2'). Or reply STOP to unsubscribe."

4. If valid quantity:
   a. Find most recent row in `texts` — this is the active offer. If none: reply "No wine available yet — watch this space!"
   b. Check for duplicate: if `orders` row exists where `customer_id` matches AND `text_id` matches → reply: "You've already ordered from this one! Your bottles are safely in the cellar."
   c. Check stock: `wines.stock_bottles >= quantity`. If not: reply: "Sorry, we only have [n] bottles left. Reply [n] to grab them."
   d. Cap quantity at MAX_BOTTLES_PER_ORDER env var (default 12). If over: reply: "We cap orders at [max] bottles per text — reply [max] if you'd like the maximum."
   e. Calculate `total_pence = quantity * wine.price_pence`
   f. Create Stripe PaymentIntent:
      ```js
      stripe.paymentIntents.create({
        amount: total_pence,
        currency: 'gbp',
        customer: customer.stripe_customer_id,
        payment_method: customer.stripe_payment_method_id,
        off_session: true,
        confirm: true,
      })
      ```
   g. If payment succeeds:
      - Insert `orders` row with `stripe_charge_status: 'succeeded'`
      - Insert `cellar` row(s) with quantity
      - Decrement `wines.stock_bottles` by quantity
      - Query new cellar total for this customer
      - Reply: "Got it — [n] bottle(s) of [wine name] added to your cellar. You now have [total] stored. [If total >= 12: 'You've hit 12 bottles! Reply SHIP to arrange your free case delivery.']"
   h. If payment `requires_action` (3DS required):
      - Insert order with `stripe_charge_status: 'requires_action'`
      - Generate a short-lived signed token (JWT or UUID stored in DB)
      - Reply: "We need you to verify your payment. Visit [url]/authenticate?token=[token] to complete your order."
   i. If payment fails:
      - Insert order with `stripe_charge_status: 'failed'`
      - Reply: "Your payment didn't go through. Update your card at [url]/billing and try again."

**The SHIP flow (triggered by customer replying "ship"):**

- Check cellar total >= 12
  - If not: reply "You've got [n] bottles so far — you need 12 for free shipping!"
  - If yes:
    - Insert `shipments` row with `status: 'pending'`
    - Generate a signed token for the customer
    - Reply: "Brilliant! Confirm your delivery address at [url]/ship?token=[token]"

**Always return valid TwiML from this route:**
```xml
<Response/>
```
Send any reply messages via the Twilio REST API, not via TwiML `<Message>` tags (easier to control async).

### SMS commands — full list

| Customer texts | Action |
|---|---|
| A number (e.g. `2`) | Order N bottles of active wine |
| `STOP` / `UNSUBSCRIBE` | Unsubscribe |
| `CELLAR` | Receive list of all bottles currently in cellar |
| `SHIP` | If ≥12 bottles: free shipping flow. If <12: ask to confirm £15 fee |
| `PAUSE` | Pause a pending shipment (sets status to 'paused') |
| `SNOOZE` / `SNOOZE [weeks]` | Pause receiving offer texts for N weeks (default 4). Auto-resumes. |
| `RESUME` | Resume offer texts early after a SNOOZE |
| `REQUEST [message]` | Special request → admin panel + email to hello@crushwines.co |
| `QUESTION [message]` | Concierge inbox → admin panel + email to hello@crushwines.co |

**Tone note for all SMS replies:** Laid back, warm, a bit fun. Reference: Rochambeau Club. Not corporate, not apologetic. Short sentences. Never "We're sorry for the inconvenience."

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

- **Refund per bottle:** for each cellar item, show a refund button. On click: issue Stripe refund for that bottle's price, remove from `cellar`, insert into `refunds` table
- **Partial refund:** if they ordered multiple bottles in one order, allow partial quantity refund (e.g. refund 1 of 3)
- **Manual add bottles:** dropdown to select a wine from the library + quantity input → inserts directly into `cellar` without charging (for comps, corrections, goodwill)

### `/admin/requests` — Special requests (new)

- List of all `REQUEST` messages from customers
- Shows: customer name, phone, message, timestamp, status (new / in_progress / resolved)
- Mark as resolved

### `/admin/concierge` — Concierge inbox (new)

- List of all `QUESTION` messages from customers
- Shows: customer name, phone, message, timestamp, replied status
- Reply input — sends an SMS reply via Twilio, logs as outbound message in `concierge_messages`

---

## 6. Customer-facing pages

### `/ship?token=[token]`

- Validate token (check shipments table, not expired)
- Display: bottle count, customer name
- Form: delivery address (line 1, line 2, city, postcode)
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

---

## 7. Business Logic Rules

- A customer can only order once per text blast (check `customer_id` + `text_id` before processing)
- Stock is decremented only on successful payment, not on order creation
- Cellar count = `sum(cellar.quantity) where shipped_at is null and customer_id = X`
- Free shipping triggers at 12+ bottles — a customer with 10 who orders 3 goes to 13 and still qualifies
- When shipment is confirmed, mark ALL unshipped cellar rows for that customer with the `shipment_id` and `shipped_at = now()`. Cellar count resets to 0.
- `price_pence` in `orders` is snapshotted at time of order — never updated retroactively
- All money stored in pence (integers). Display as £X.XX.
- Twilio inbound webhook must be idempotent — check if order already exists before creating

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

### SMS: SNOOZE command (pause offer texts)
Note: `PAUSE` is reserved for pausing shipments. Use `SNOOZE` for pausing offer texts.
- `SNOOZE` or `SNOOZE [weeks]` — pause receiving offer texts for a set period (default 4 weeks if no number given)
- Add `texts_snoozed_until timestamptz` to `customers` table
- Blast sending logic must skip customers where `texts_snoozed_until > now()`
- Auto-resumes when date passes (no action needed)
- Customer can text `RESUME` to restart early
- Reply: "No problem — we'll pause your texts for [n] weeks. Text RESUME any time to start again."

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
- Send email to hello@crushwines.co (use Resend or Nodemailer)
- Reply: "Request received! We'll be in touch shortly."

**QUESTION [message]**
- Extract message body (everything after QUESTION)
- Insert into `concierge_messages` as direction: 'inbound'
- Send email to hello@crushwines.co
- Reply: "Got your question — we'll get back to you soon."

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

Emails to send:
- REQUEST received → hello@crushwines.co
- QUESTION received → hello@crushwines.co
- Failed payment → customer (as backup to SMS)
- Shipment dispatched → customer (with tracking number)

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
