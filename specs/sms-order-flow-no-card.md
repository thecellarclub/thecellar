# Spec: SMS Order Flow — Robust Reply Parsing + No-Card Path

## Context
We're sending the first real SMS offer from Daniel (sommelier) to customers tonight. Auditing master shows two real problems and one healthy invariant we want to preserve:

**Problem 1 — Strict digit-only quantity parsing.** `app/api/webhooks/twilio/inbound/route.ts:1359-1363` only accepts `/^\d+$/`. Replies like `"two"`, `"3 bottles"`, or `"I'll take one please"` fall through to the open-thread/menu handler and silently drop the sale.

**Problem 2 — Dead end after card save in the no-card path.** When a customer with no card replies with a quantity:
- Today's inbound webhook (route.ts:691-702) creates the pending order, mints a `billing_token`, sends the customer a `/billing?token=...` link, and tells them to **"add a card and reply YES"** — but that's two asks at once, and the YES reference is meaningless before the card exists. The SMS should only ask for the card.
- The save-card endpoint (`app/api/billing/update-card/route.ts:76`) sends `"Card updated — text us again to complete your order."` That's the actual dead end. After saving, the customer should land at the single YES gate — same one a card-on-file customer hits — with a fresh recap and one clear instruction: reply YES.

**Invariant to preserve — single YES confirmation per order.** Julia's rule: every order must end with one explicit YES from the customer at the same final stage, regardless of card status. This guards against fat-finger orders and gives a chance to correct mistakes. The YES is always the last step (when we have everything we need to charge).

**Problem 3 — No visibility on missed replies.** Unparseable replies that don't trigger any keyword end up in `concierge_messages` only if a thread is already open. Otherwise they're invisible. We need every inbound SMS logged with its parse outcome so we can spot lost orders.

---

## Goals
1. Accept a wide range of reply formats (e.g. `2`, `two`, `3 bottles`, `I'll take one bottle please`) and extract the intended quantity.
2. When we can't parse the reply, send a clear fallback that tells the user how to interact (reply with a number, or use the existing `QUESTION` route for a human).
3. Every order — card or no-card — ends with exactly **one YES** from the customer, sent at the moment we have everything to charge.
4. The no-card path must not have a dead end. After the customer saves a card, they receive a fresh order summary SMS with a clear `Reply YES to confirm` instruction — they don't have to scroll back to the previous SMS.
5. If the YES charge fails, do not let the order silently rot — message immediately, nudge on the next daily cron, cancel on the run after that. (Vercel Hobby = daily-only crons; see section 6 for the timeline and the flagged decision.)
6. Admin visibility on every parse failure so we don't quietly miss sales — primarily via a new `/admin/(protected)/sms-log` dashboard page (Julia checks this after sending an offer). Real-time email alerts only for exceptional cases that can't wait for a dashboard check (payment failures, orphan setup intents). Those exceptional alerts go to **members@thecellar.club**; existing `notifyAdmin` callers (REQUEST, QUESTION, etc.) keep their current recipient.

## Non-Goals
- Building a full conversational AI / free-text concierge.
- Changing Daniel's outbound offer SMS content.
- Replacing the existing keyword router or concierge inbox.
- Any auto-confirm path that bypasses YES (explicitly out of scope per Julia).

---

## What Already Exists On Master (REUSE — DO NOT REBUILD)

Verified on `origin/master` after the recent card-first signup + broadcast push.

| Concern | Reuse | Path |
|---|---|---|
| Inbound SMS webhook & keyword router | Extend, don't replace | `app/api/webhooks/twilio/inbound/route.ts` |
| Outbound SMS sender (with GSM-7 sanitisation) | `sendSms(to, body)` | `lib/twilio.ts` |
| Admin email alerts | `notifyAdmin(subject, text)` (Resend). Existing recipient `hello@crushwines.co` stays for REQUEST/QUESTION/concierge — do **not** change globally. New SMS-flow alerts (payment failed, orphan setup intent) need a separate recipient. **Action:** extend `notifyAdmin` to accept an optional `to` arg, default unchanged. New callers pass `members@thecellar.club` explicitly. | `lib/resend.ts` |
| Pending order model | `orders` table, `order_status='awaiting_confirmation'`, `confirmation_expires_at` | `app/api/webhooks/twilio/inbound/route.ts:666-677` |
| Billing token storage | `customers.billing_token` + `customers.billing_token_expires_at` | `supabase/migrations/006_billing_token.sql` |
| Card-entry page (token-auth, SetupIntent) | `/billing?token=...` (auto-authenticates via token, no login) | `app/billing/page.tsx` + `app/billing/BillingForm.tsx` |
| Save-card endpoint | `POST /api/billing/update-card` (needs surgery — see below) | `app/api/billing/update-card/route.ts` |
| **Short URL `/b/[token]` redirect** — already on master | Use directly | `app/b/[token]/route.ts` |
| **`generateShortToken()`** — already on master | Use in inbound webhook | `lib/token.ts` |
| YES confirmation handler | `handleYes(from, customer, sb)` — already charges via PaymentIntent off-session | `app/api/webhooks/twilio/inbound/route.ts:711+` (search for `handleYes`) |
| Off-session charge with 3DS handling | PaymentIntent with `off_session: true, confirm: true` → `requires_action` → `/authenticate?token=...` | `app/api/webhooks/twilio/inbound/route.ts:840-849` |
| QUESTION → human route | Routes to `concierge_messages` + emails admin via `notifyAdmin` | `app/api/webhooks/twilio/inbound/route.ts:1299-1328` |
| Stripe webhook (PaymentIntent succeeded/failed) | Already idempotent | `app/api/webhooks/stripe/route.ts` |
| Cron pattern (Vercel cron + `Bearer CRON_SECRET` auth) | Copy the auth/scheduling pattern | `app/api/cron/welcome-and-card-prompt/route.ts` |
| Vercel cron registration | `vercel.json` |

---

## Required Changes

### 1. Replace the digit-only parser with `parseOrderReply`
Create `lib/parse-order-reply.ts`:

```ts
export type ParseResult =
  | { kind: 'quantity'; quantity: number; ambiguous?: boolean; raw: string }
  | { kind: 'unparseable'; raw: string }

export function parseOrderReply(input: string): ParseResult
```

#### Rules (in order)
1. **Trim, lowercase, strip punctuation except `?`.** Empty → `unparseable`.
2. **Digit match:** regex `\b(\d{1,3})\b`. Take the first match. If multiple digits found, set `ambiguous: true`.
3. **Number-word match:** dictionary `one..twelve`. Also: `a` / `an` / `single` → 1; `couple` / `pair` → 2; `few` → 3.
4. **Both digit and word found?** Prefer the digit. Set `ambiguous: true` so it gets logged.
5. **Negation guard:** if the message contains `no`, `not`, `none`, `don't`, `cancel`, or `skip` and no positive phrasing like "yes/want/take/i'll take/please send", treat as `unparseable` so the human stays in the loop.
6. **Quantity must be ≥ 1.** Zero or negative → `unparseable`.
7. **Nothing matches:** `unparseable`.

**No MAX_BOTTLES cap in the new parser.** Julia confirmed there's no hard cap — 12+ triggers free shipping anyway. The existing `MAX_BOTTLES` cap at lines 647-653 should be **removed**. Stock is the only limit.

#### Test table (Vitest/Jest unit test file `lib/parse-order-reply.test.ts`)
| Input | Expected |
|---|---|
| `"2"` | `{ kind: 'quantity', quantity: 2 }` |
| `"two"` | `{ kind: 'quantity', quantity: 2 }` |
| `"3 bottles"` | `{ kind: 'quantity', quantity: 3 }` |
| `"I'll take one bottle please"` | `{ kind: 'quantity', quantity: 1 }` |
| `"a couple"` | `{ kind: 'quantity', quantity: 2 }` |
| `"a bottle"` | `{ kind: 'quantity', quantity: 1 }` |
| `"none"` | `unparseable` |
| `"no thanks"` | `unparseable` |
| `"2 or 3"` | `{ kind: 'quantity', quantity: 2, ambiguous: true }` |
| `"!!!"` | `unparseable` |
| `"twelve"` | `{ kind: 'quantity', quantity: 12 }` |
| `""` | `unparseable` |
| `"   "` | `unparseable` |
| `"4 plz"` | `{ kind: 'quantity', quantity: 4 }` |

### 2. Wire `parseOrderReply` into the inbound webhook
In `app/api/webhooks/twilio/inbound/route.ts`, **replace** the block at lines 1359-1363:

```ts
const qty = parseInt(body, 10)
if (!isNaN(qty) && qty > 0 && /^\d+$/.test(body)) {
  return await handlePendingOrder(from, customer, qty, sb)
}
```

with a call into `parseOrderReply` that runs **before** the existing open-thread/concierge fallthrough. The `QUESTION`/`REQUEST`/`STOP`/`STATUS`/`YES`/`OFFER`/`CHANGE` keyword handlers must still run first (already higher in the function — leave them).

The new branch:
- `kind === 'quantity'` → call `handlePendingOrder(from, customer, result.quantity, sb)`. If `ambiguous`, mark the row in `sms_parse_log` with `ambiguous = true` so it appears in the admin dashboard's Ambiguous filter — **do not email** (Julia checks the dashboard after sends, doesn't want noise).
- `kind === 'unparseable'` → send the fallback SMS template and write a row to `sms_parse_log`. Then **return** — do not fall through to the open-thread handler.

Also: **every** branch of the inbound webhook should write one row to `sms_parse_log` before returning. Factor into a small `logInbound(...)` helper near the top of the file.

### 3. Use `generateShortToken()` for billing links from inbound
At `route.ts:692`, replace `crypto.randomUUID()` with `generateShortToken()` and switch the SMS URL from `${APP_URL}/billing?token=${billingToken}` to `${APP_URL}/b/${billingToken}`. Also extend the token + order TTLs from 10 minutes to **24 hours** so the customer has time to enter their card.

The SMS template should remain in the same shape (one final YES gate — see template `noCardCardLink` below) but with the short URL and updated wording so it still fits ≤160 GSM-7 chars.

### 4. Fix the save-card SMS to land the customer back at the same YES gate

Today's `app/api/billing/update-card/route.ts:75-79` sends `"Card updated - text us again to complete your order."` That tells the user to start over.

**Replace with this logic:**

1. Attach payment method + set as default (already done at lines 55-62 — keep).
2. Update `customers.stripe_payment_method_id`, clear `billing_token`/`billing_token_expires_at` (already done at lines 64-72 — keep).
3. **NEW:** look for an `orders` row matching `customer_id = customer.id AND order_status IN ('awaiting_confirmation','payment_failed') AND confirmation_expires_at > now()`. If a single match is found, fetch the wine name, quantity, and total to render a fresh recap. (Match `payment_failed` too so the post-card-save flow handles the failed-payment retry path with the same logic.)
4. Send SMS template `cardSavedOrderRecap` (below). This is the **single confirmation gate** for the no-card flow — the customer replies YES to that SMS exactly the same way a card-on-file customer does. The existing `handleYes` handler at `route.ts:711+` charges and confirms with no further changes.
5. If no matching pending order is found (e.g. customer just updating their card outside an order flow), send `cardSavedNoOrder` (just confirms the card is saved, no YES gate).

**Do not auto-charge in the save-card endpoint.** This is the key point of Julia's invariant: no order ever charges without one explicit YES from the customer.

### 5. Stripe `setup_intent.succeeded` fallback
Browser-side success in `BillingForm.tsx` calls `/api/billing/update-card`. If the user closes the tab before that fires, the card is saved at Stripe but our DB doesn't know.

Add a `setup_intent.succeeded` branch to `app/api/webhooks/stripe/route.ts` that:
- Looks up the customer by `stripe_customer_id`.
- Idempotently runs the same DB updates as 4(1)-(2) (attach default + persist `stripe_payment_method_id` + clear billing token) if they haven't run yet.
- Looks for an `awaiting_confirmation` order and sends `cardSavedOrderRecap` if found, `cardSavedNoOrder` otherwise.
- Gate on `customers.stripe_payment_method_id` already being set so we don't double-send the SMS.

### 6. Failed-payment retry/escalation
A new state `payment_failed` for `orders.order_status`, plus columns:
- `payment_failed_at timestamptz`
- `payment_failed_attempts int default 0`
- `payment_failed_last_message_at timestamptz`

Modify `handleYes` (and the `payment_intent.payment_failed` Stripe webhook branch) so that when a charge fails, the order moves to `payment_failed` instead of `cancelled`. Add cron `app/api/cron/payment-retry/route.ts` (modelled on `app/api/cron/welcome-and-card-prompt/route.ts` for auth + scheduling). Schedule **daily at 11:00 UTC** in `vercel.json` (Vercel Hobby plan only allows daily crons — Julia's existing setup confirms this in commit `2deebad`).

Because we're capped at daily granularity, the timeline becomes:

- **Synchronous, when YES charge first fails (T+0):** SMS the customer with a fresh `/b/{token}` link (24h expiry):
  > `"Card declined for your {N}-bottle order. Update card here: {url} — we'll send a fresh check once it's saved."`
  Note: the customer doesn't reply YES yet. After they save the new card, the save-card endpoint (or `setup_intent.succeeded` webhook) sends `cardSavedOrderRecap` — that's the YES gate.
  Also `notifyAdmin('Payment failed', ...)` immediately.
- **Daily cron pass (T+~24h):** if still `payment_failed`, send a second nudge SMS with a fresh link.
- **Daily cron pass (T+~48h):** cancel the order (`order_status = 'cancelled'`), release reserved stock, SMS:
  > `"We couldn't charge your card so we cancelled your order. Reply OFFER to try again."`
  `notifyAdmin('Order cancelled — payment never succeeded', ...)`.

If the customer updates their card during the failed-payment window, the next cron run **does not** auto-charge. They still need to reply YES (this preserves the single-confirmation invariant). The retry SMS itself is the prompt.

> **Decision flagged for Julia:** the original ask was "+12h then +24h", but Vercel Hobby = daily-only cron. The next-day / day-after escalation is the closest equivalent. If you want sub-day granularity we'd need to upgrade the Vercel plan or self-host the cron. Confirm direction.

### 7. Visibility — `sms_parse_log`
New table (migration `024_sms_parse_log.sql` — note: 022 is the latest existing migration on master, 023 is reserved for the failed-payment columns from section 6):

```sql
create table sms_parse_log (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  inbound_phone text not null,
  raw_message text not null,
  parse_kind text not null,         -- 'quantity' | 'unparseable' | 'keyword:question' | 'keyword:yes' | etc.
  parse_quantity int,
  ambiguous boolean default false,
  matched_text_id uuid references texts(id),
  created_at timestamptz default now()
);
create index on sms_parse_log (created_at desc);
create index on sms_parse_log (parse_kind);
```

#### Admin dashboard — new page `/admin/(protected)/sms-log`
Replaces the previously-planned daily digest email. Julia checks this page after sending an offer. Pattern after `app/admin/(protected)/inbox/page.tsx` for layout + auth.

The page should show, default sorted by `created_at` desc:
- A header summary for the last 24h: total inbound, count by `parse_kind`.
- A table of inbound rows with columns: timestamp, phone (with link to customer), raw message, parse outcome, matched offer (if any), and any `ambiguous` flag.
- Filter chips at the top: `All / Unparseable / Ambiguous / Quantity / Keyword`.
- A second section below the table: open `payment_failed` orders (linked to the customer + the order), so Julia can spot stuck payments at a glance.
- Add a nav entry in `app/admin/_components/AdminNav.tsx` (between "Inbox" and "Customers" feels right — fits the "what just happened over SMS" mental model).

No cron needed for the dashboard.

#### Real-time email alerts (only the exceptional cases)
Email recipient: `members@thecellar.club` (passed explicitly to the modified `notifyAdmin`).

- Synchronous on YES charge failure (T+0): subject "Payment failed — {customer} — {N} x {wine}".
- Synchronous on order cancellation by retry cron (T+~48h): subject "Order cancelled — payment never succeeded".
- Synchronous on `setup_intent.succeeded` arriving with no matching customer: subject "Orphan setup intent" — indicates a bug.

**Not emailed (visible only on the dashboard):** unparseable replies, ambiguous parses, routine quantity parses, every keyword routing. These are routine and can be checked when convenient.

### 8. Add an optional recipient override to `notifyAdmin`

`lib/resend.ts` currently hard-codes `ADMIN_EMAIL = 'hello@crushwines.co'`. Julia wants that recipient kept for existing callers (REQUEST, QUESTION, concierge, purchase queries). Only the new SMS-flow alerts (payment failed, orphan setup intent) should route to `members@thecellar.club`.

Change the signature:

```ts
export async function notifyAdmin(subject: string, text: string, to?: string): Promise<void>
```

Default `to` to the existing `ADMIN_EMAIL` constant. New callers pass `'members@thecellar.club'` explicitly. Do **not** change any existing call site.

---

## SMS Templates — verify ≤160 GSM-7 chars at max plausible variable lengths

Add `lib/sms-templates.ts` exporting each template + a unit test file `lib/sms-templates.test.ts` that asserts the rendered length is ≤160 for the worst-case variables (wineName up to 30 chars, N up to 24, total up to £999.99, last4 = 4 digits).

| ID | Template | When sent |
|---|---|---|
| `noCardCardLink` | `Got it — {N} of {wineName} (£{total}). Add a card here and we'll send you a final check to confirm: {APP_URL}/b/{token}` | Customer replies with quantity, no card on file. **No YES instruction in this SMS** — the YES gate comes after the card is saved. |
| `cardSavedOrderRecap` | `Card saved. Final check: {N} x {wineName}, £{total}, card ending {last4}. Reply YES to confirm.` | After save-card endpoint OR setup_intent webhook, when a pending order exists |
| `cardSavedNoOrder` | `Card saved. Reply OFFER any time to see what's available.` | After card save with no pending order |
| `orderConfirmed` | (Existing — emitted by `handleYes` on successful charge. No change needed.) | After YES → charge succeeds |
| `unparseableFallback` | `Sorry, didn't catch that. Reply with a number (e.g. 2) to order. For anything else, reply QUESTION followed by your message.` | parseOrderReply returns unparseable |
| `paymentFailedT0` | `Card declined for your {N}-bottle order. Update card here: {APP_URL}/b/{token} — we'll send a fresh check once it's saved.` | Synchronous on charge failure. No YES in this SMS — the YES gate fires after the new card is saved. |
| `paymentFailedNudge` | `Reminder: card still declining for your {N}-bottle order. Update here: {APP_URL}/b/{token}. We'll cancel tomorrow if not.` | Daily cron, if still payment_failed |
| `paymentFailedCancelled` | `We couldn't charge your card so we cancelled your order. Reply OFFER to try again.` | Daily cron, T+~48h |

The `unparseable` template references `QUESTION` (existing keyword route — no `?` prefix needed).

---

## Acceptance Criteria

- [ ] All 14 cases in the parser test table pass.
- [ ] Replying `xyz` from staging phone → fallback SMS sent, row written to `sms_parse_log` with `parse_kind='unparseable'`.
- [ ] Replying `two` → order created (parsed as 2). Same for `"3 bottles"`, `"a couple"`, `"I'll take one"`.
- [ ] Replying `2 or 3` → order for 2, `ambiguous: true` in `sms_parse_log`, visible on the `/admin/sms-log` Ambiguous filter. **No email is sent** for this case.
- [ ] All 8 SMS templates verified ≤160 chars at max variable lengths (failing test fails the build).
- [ ] Customer with no card replies `2` from staging phone → receives `noCardCardLink` SMS with a `/b/<8 char token>` link, total SMS body ≤160 chars.
- [ ] Opening that link goes straight to the card form with no login.
- [ ] Saving a card on that page → receives `cardSavedOrderRecap` SMS within 30s. Replying YES → order charges and confirmation SMS arrives.
- [ ] Order **never** charges without a YES from the customer.
- [ ] Closing the tab between "card submitted" and "Stripe webhook" → `setup_intent.succeeded` handler still sends `cardSavedOrderRecap` once.
- [ ] Forced charge failure on staging → `paymentFailedT0` SMS sent immediately, retry SMS at next cron run, cancellation at the run after.
- [ ] After failed payment, customer updates card and replies YES → charge fires on the new card.
- [ ] `/admin/(protected)/sms-log` page renders: 24h summary, filterable table of inbound rows, list of open `payment_failed` orders. Reachable from the admin nav.
- [ ] Existing `notifyAdmin` callers (REQUEST, QUESTION, concierge, etc.) **continue** routing to `hello@crushwines.co` — no change in their behaviour.
- [ ] Only the new SMS-flow exceptional alerts (payment failed, orphan setup intent) route to `members@thecellar.club`.

---

## Migrations Summary
- `023_orders_payment_failed.sql` — adds `payment_failed_at`, `payment_failed_attempts`, `payment_failed_last_message_at` to `orders`. Adds `payment_failed` to the `order_status` enum (or check constraint, whichever the table currently uses).
- `024_sms_parse_log.sql` — new table per spec above.

(022 is the latest existing migration. Bump 023/024 if Claude Code lands any other migrations between now and implementation.)

## Cron Summary (add to `vercel.json`)

Existing crons (do not modify):
- `/api/cron/case-nudges` — daily at 09:00
- `/api/cron/welcome-and-card-prompt` — daily at 10:00

Add:
- `/api/cron/payment-retry` — daily at 11:00 UTC

(No `sms-digest` cron — replaced by the `/admin/sms-log` dashboard page.)

## Files to Create / Modify
**Create:**
- `lib/parse-order-reply.ts` + test
- `lib/sms-templates.ts` + test
- `app/api/cron/payment-retry/route.ts`
- `app/admin/(protected)/sms-log/page.tsx` (dashboard for inbound SMS log + open payment_failed orders)
- `supabase/migrations/023_orders_payment_failed.sql`
- `supabase/migrations/024_sms_parse_log.sql`

**Modify:**
- `lib/resend.ts` — extend `notifyAdmin` to accept optional `to` recipient. **Do not change** the default; existing callers stay on `hello@crushwines.co`.
- `app/admin/_components/AdminNav.tsx` — add "SMS log" link.
- `app/api/webhooks/twilio/inbound/route.ts`:
  - swap parser call at lines 1359-1363
  - swap `crypto.randomUUID()` → `generateShortToken()` at line 692
  - swap `${APP_URL}/billing?token=${billingToken}` → `${APP_URL}/b/${billingToken}` at line 699
  - extend billing token + `confirmation_expires_at` TTLs to 24 hours for the no-card path
  - remove the `MAX_BOTTLES` cap at lines 647-653
  - add `logInbound(...)` writes to `sms_parse_log` for every branch
  - update `handleYes` payment-failed branch to set `order_status='payment_failed'` instead of `cancelled` and send `paymentFailedT0`
- `app/api/billing/update-card/route.ts`:
  - replace the "text us again" SMS with `cardSavedOrderRecap` lookup + send (or `cardSavedNoOrder` if no pending order)
- `app/api/webhooks/stripe/route.ts`:
  - add `setup_intent.succeeded` handler (idempotent)
  - update `payment_intent.payment_failed` branch to use `payment_failed` status
- `vercel.json` — add `sms-digest` and `payment-retry` cron entries.
