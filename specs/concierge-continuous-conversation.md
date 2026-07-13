# Spec: Continuous concierge conversations + unified Inbox

## Problem

Today, when a customer texts `QUESTION` or `REQUEST` and Daniel replies
from the admin panel, the customer cannot send a follow-up. Their next
message falls through every keyword branch in
`app/api/webhooks/twilio/inbound/route.ts` and hits the menu fallback
("OFFER / QUESTION / REQUEST / portal"). The thread breaks.

On top of that, customer ↔ Daniel communication is currently scattered
across **three** admin pages that don't talk to each other:

- `/admin/concierge` — `QUESTION` threads (`concierge_messages` table)
- `/admin/requests` — `REQUEST` items (`special_requests` table)
- `/admin/message` — ad-hoc outbound SMS (no DB record at all)

So when a customer replies to a request or to an ad-hoc message, there's
no obvious place for that reply to land, and the "Reply" button on the
requests page just deep-links into `/admin/message?phone=…` and sends
into the void.

## Goal

1. **Continuous conversations.** Once a customer has any open thread —
   concierge `QUESTION` *or* special `REQUEST` — any unmatched inbound
   text should continue that conversation until Daniel explicitly closes
   it. The customer should never be dropped back to the menu mid-thread.

2. **One Inbox.** Merge `/admin/concierge`, `/admin/requests` and
   `/admin/message` into a single Inbox view. Every inbound and
   outbound SMS is stored as a row in `concierge_messages` and
   surfaces in the same per-customer thread, regardless of how it
   originated (concierge question, special request, ad-hoc outbound,
   purchase query, follow-up to an offer).

3. **Offers still always send.** Marketing offer texts go to all active
   subscribers regardless of `concierge_status`. Replies to offers land
   in the same Inbox thread (they already do — see
   `concierge_messages.category = 'purchase_query'`).

## Scope

In scope:

- `app/api/webhooks/twilio/inbound/route.ts` — continuous-conversation
  routing.
- New `/admin/inbox` page (or rename `/admin/concierge` → `/admin/inbox`),
  which is the single source of truth for conversations.
- Migration to backfill `special_requests` into `concierge_messages` so
  the Inbox can show them as thread messages.
- `/api/admin/message` — log every ad-hoc outbound into
  `concierge_messages`, not just blast and forget.
- Admin nav (`AdminNav.tsx`, `MobileAdminNav.tsx`) — collapse three nav
  items to one "Inbox" item.
- Soft-deprecate `/admin/concierge`, `/admin/requests`, `/admin/message`
  pages — redirect to `/admin/inbox`. Leave the underlying tables.

Out of scope:

- Auto-closing threads on a timer.
- Real-time updates / WebSockets — refresh on send is fine.
- Changing the customer-facing keywords (`QUESTION`, `REQUEST`,
  `OFFER`, etc.).

## Behaviour

### 1. Inbound routing — continuous conversation

In `POST` in `app/api/webhooks/twilio/inbound/route.ts`, after the
existing `sms_awaiting` block and after all keyword branches (`stop`,
`cellar`, `ship`, `ship confirm`, `pause`, `status`, `account`, `snooze`,
`resume`, `request`, `question`, `change`, `offer`, `yes`, positive
integer), but **before** the final menu fallback, add this branch:

```ts
// ── Continuation of any open thread ──────────────────────────────────
// If the customer has an open concierge OR open special request thread
// and the message didn't match any keyword above, treat it as a
// follow-up. Keeps live conversations from being dumped to the menu.
const conciergeOpen = customer.concierge_status === 'open'

let openRequest: { id: string } | null = null
if (!conciergeOpen) {
  const { data } = await sb
    .from('special_requests')
    .select('id')
    .eq('customer_id', customer.id)
    .neq('status', 'resolved')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  openRequest = data ?? null
}

if (conciergeOpen || openRequest) {
  const rawMessage = (params['Body'] ?? '').trim()
  const name = customer.first_name ?? customer.phone

  // Always log into concierge_messages — this is the single source of
  // truth for the Inbox.
  await sb.from('concierge_messages').insert({
    customer_id: customer.id,
    direction: 'inbound',
    message: rawMessage,
    category: openRequest ? 'request_followup' : 'general',
    context: openRequest ? `Re: special request` : null,
  })

  // If the open thread was a request, also flip the request to
  // 'in_progress' so it shows as active.
  if (openRequest) {
    await sb
      .from('special_requests')
      .update({ status: 'in_progress' })
      .eq('id', openRequest.id)
  }

  // Make sure concierge_status is open so future replies route here too.
  if (!conciergeOpen) {
    await sb
      .from('customers')
      .update({ concierge_status: 'open' })
      .eq('id', customer.id)
  }

  await notifyAdmin(
    `Inbox follow-up from ${name}`,
    `Message: ${rawMessage}\nPhone: ${customer.phone}`
  )

  await sendSms(from, `Got it - Daniel will get back to you.`)
  return twimlOk()
}
```

#### Why this position in the chain

After keyword branches → so `STATUS`, `CELLAR`, `SHIP`, `OFFER`, `STOP`,
numeric replies, etc. still work mid-thread.

After `sms_awaiting` block → that block already handles the very first
message of a brand-new thread.

Before menu fallback → so the menu only fires when there's genuinely
nothing in flight.

### 2. Offers always go out

No change needed. `app/api/texts/send/route.ts` filters customers only
on `active` and `texts_snoozed_until` — `concierge_status` is irrelevant.
A customer with an open thread will still receive the next offer SMS.

When they reply to that offer with a number, the existing
`handlePendingOrder` flow wins (number branch comes before the new
follow-up branch in routing order). When they reply with free text, the
existing `sms_awaiting === 'offer'` block already routes it to
`concierge_messages` with `category = 'purchase_query'` — that flow keeps
working unchanged and lands in the same Inbox.

### 3. Unified Inbox UI

#### Route

Create `app/admin/(protected)/inbox/page.tsx`. Old `/admin/concierge`,
`/admin/requests`, `/admin/message` redirect to `/admin/inbox` (use
Next.js `redirect()` in the page server component).

#### Data model

The Inbox is a **list of customers** with one merged thread per customer.
A thread message is a row in `concierge_messages`. A "special request"
becomes a thread message via the migration in §4 and becomes a thread
attribute (badge + status pill).

Server-side query in `inbox/page.tsx`:

```ts
// 1. All concierge messages, grouped by customer (existing pattern).
// 2. All non-resolved special_requests, indexed by customer_id, used to
//    decorate threads with a "Request: …" badge + status.
// 3. Customer info: first_name, phone, concierge_status.
```

Order threads:

1. Open threads with last message inbound (unanswered) — most recent
   first.
2. Open threads with last message outbound — most recent first.
3. Closed threads — most recent first, hidden behind "Show closed"
   toggle (already exists in `ConciergeClientView`).

#### Per-thread UI

Reuse `ConciergeClientView` as the base, with three additions:

a. **"Request" badge.** If the customer has a non-resolved
   `special_requests` row, show a small amber "Request" badge next to
   the name in both the list and the detail view. Clicking it expands
   the request text + `Resolve` button (PATCH
   `/api/admin/requests` — already exists).

b. **"New conversation" entry point.** A button at the top of the
   Inbox: "+ New message". Clicking it opens an inline form (the
   existing `SendMessageForm`) inside a modal/drawer. Selecting a
   customer + sending creates a new `concierge_messages` outbound row,
   sets that customer's `concierge_status = 'open'`, and selects the
   thread. This replaces the standalone `/admin/message` page.

c. **Reply form (existing `DesktopReplyForm` / `MobileReplyInput`)**
   stays as is — already POSTs to
   `/api/admin/concierge/[customerId]/reply`.

#### Status controls

Existing `CloseButton` already toggles `concierge_status` and is
sufficient for closing a thread. Add one rule: when the admin marks a
thread closed, **also** mark any non-resolved `special_requests` for
that customer as `resolved`. Otherwise the request status badge will
linger after Daniel has clearly finished the conversation. Implement
this by extending `PATCH /api/admin/concierge/[customerId]/status`:
when `status: 'closed'`, additionally `UPDATE special_requests SET
status='resolved' WHERE customer_id=$1 AND status<>'resolved'`.

### 4. `special_requests` ↔ Inbox coupling

Two changes to keep `special_requests` consistent with the Inbox view:

a. **Backfill migration.** New migration
`021_backfill_requests_into_concierge.sql`:

```sql
-- Insert one inbound concierge_messages row for every special_requests
-- row that doesn't already have a corresponding entry.
-- Use category='special_request' so the Inbox can render the badge.
INSERT INTO concierge_messages (customer_id, direction, message, category, context, created_at)
SELECT
  sr.customer_id,
  'inbound',
  sr.message,
  'special_request',
  'Special request',
  sr.created_at
FROM special_requests sr
WHERE NOT EXISTS (
  SELECT 1 FROM concierge_messages cm
  WHERE cm.customer_id = sr.customer_id
    AND cm.message = sr.message
    AND cm.category = 'special_request'
);
```

b. **New requests dual-write.** Update both places that insert into
`special_requests` in
`app/api/webhooks/twilio/inbound/route.ts` (lines ~1108 and ~1260) to
also insert a `concierge_messages` row with `category='special_request'`,
`context='Special request'`. And set `concierge_status = 'open'` on the
customer. This way every new REQUEST shows up in the Inbox immediately.

Keep the `special_requests` table as the source of truth for "is this
request still pending vs resolved" — the Inbox displays the badge and
links the resolve action; the row continues to live in its own table so
existing reporting/filtering still works.

### 5. Ad-hoc outbound (`/api/admin/message`)

Currently this endpoint just calls Twilio and returns. Update it to also
insert a `concierge_messages` row:

```ts
await sb.from('concierge_messages').insert({
  customer_id,        // looked up from phone
  direction: 'outbound',
  message,
  category: 'adhoc',
})
// And ensure concierge_status='open' so any reply continues the thread.
await sb
  .from('customers')
  .update({ concierge_status: 'open' })
  .eq('id', customer_id)
```

If the phone doesn't match any customer (e.g. typed manually for a
non-customer number), skip the DB write and just send via Twilio (current
behaviour). Surface a small warning in the form: "This number isn't a
customer — the reply won't appear in the Inbox."

### 6. Admin nav

`app/admin/_components/AdminNav.tsx` and `MobileAdminNav.tsx`:

- Remove `Concierge`, `Requests`, `Send message`.
- Add `Inbox` linking to `/admin/inbox`.
- Show an unread badge on `Inbox` (count of open threads where last
  message is inbound). The current `ConciergePage` already computes
  `unansweredCount` — lift that into a small server util and use it
  here.

## Files to change

- `app/api/webhooks/twilio/inbound/route.ts`
  - Add the new "open thread continuation" branch before the menu
    fallback (§1).
  - At the two `special_requests` insert sites (~L1108, ~L1260): also
    insert a `concierge_messages` row with `category='special_request'`
    and set `concierge_status='open'` on the customer (§4b).

- `app/api/admin/concierge/[customerId]/status/route.ts`
  - When closing, also resolve outstanding `special_requests` for that
    customer (§3 status controls).

- `app/api/admin/message/route.ts`
  - Look up customer by phone. If found, insert outbound
    `concierge_messages` row and set `concierge_status='open'`. If not
    found, send via Twilio only (§5).

- `app/admin/(protected)/inbox/page.tsx` (NEW)
  - Server component: fetches `concierge_messages` + `special_requests`
    + customer metadata, builds threads, renders `<InboxClientView>`.

- `app/admin/_components/InboxClientView.tsx` (NEW or rename
  `ConciergeClientView` → `InboxClientView`)
  - Same layout as today's concierge view, plus:
    - "Request" badge on threads with a non-resolved `special_request`
      and an inline "Resolve" action that calls existing
      `PATCH /api/admin/requests`.
    - "+ New message" button → opens `<SendMessageForm>` in a drawer.

- `app/admin/(protected)/concierge/page.tsx` →
  `redirect('/admin/inbox')`.
- `app/admin/(protected)/requests/page.tsx` →
  `redirect('/admin/inbox')`.
- `app/admin/(protected)/message/page.tsx` →
  `redirect('/admin/inbox')`.

- `app/admin/_components/AdminNav.tsx` and
  `app/admin/_components/MobileAdminNav.tsx` — collapse to a single
  Inbox link with unread badge.

- `supabase/migrations/021_backfill_requests_into_concierge.sql` (NEW)
  — backfill (§4a).

## Files NOT to change

- `app/api/admin/concierge/[customerId]/reply/route.ts` — already
  inserts the outbound row correctly. Replies do **not** auto-close.
- `app/api/admin/requests/route.ts` — keep PATCH endpoint for the
  inline Resolve action.
- `supabase/migrations/014_concierge_thread_status.sql` — already
  exists; no change.
- `app/api/texts/send/route.ts` — offer sends remain gated only on
  `active` and `texts_snoozed_until`.

## Edge cases

1. **Customer texts `STOP` mid-thread.** Existing `stop` branch wins
   first. They unsubscribe; thread state untouched.

2. **Customer texts a number mid-thread, with no active offer.**
   `handlePendingOrder` returns "There's no active offer right now…"
   and the message is **not** logged into the Inbox. Acceptable v1; if
   it becomes confusing, mirror the integer to the Inbox when no offer
   is active.

3. **Customer texts a number mid-thread, with an active offer.** Goes
   into the order flow. This is desirable — if Daniel just recommended
   "go for 2 bottles", the customer reply `2` should buy, not log a
   message.

4. **Brand new customer, no prior thread, default
   `concierge_status='open'`.** Their first unmatched message will now
   route to the Inbox follow-up branch instead of the menu. **Decision
   from Julia:** this is the desired behaviour ("if they have any open
   status their messages get sent there and they don't go to the menu").
   We are explicitly choosing to never show the menu when
   `concierge_status='open'`.

5. **Customer with `concierge_status='closed'` and no open request
   sends an unmatched message.** Falls through to menu, as today. To
   reopen, they text `QUESTION` (existing reopen logic handles it).

6. **Two `special_requests` rows for one customer.** The query in §1
   picks the most recent non-resolved one. The "Resolve" action on the
   thread should resolve **all** outstanding requests for that customer
   in one click, otherwise the badge persists confusingly.

7. **Backfill double-write.** The `WHERE NOT EXISTS` clause in §4a
   protects against re-running. New requests after the migration will
   be dual-written by the inbound webhook (§4b), so no duplicates.

8. **Ad-hoc message to a non-customer phone.** Sent via Twilio, **not**
   logged in Inbox (no `customer_id` to attach to). Form warns the user.

## Test plan

Manual SMS tests against staging Twilio number, using a test customer
with a known phone number.

1. **Concierge follow-up loop (the main bug).**
   - `QUESTION` → prompt → free-text question → ack.
   - Daniel replies from Inbox. Customer receives SMS.
   - Customer replies again with `Sounds great, can I get 2?`
     - **Expected:** logged as inbound in Inbox, admin notified
       ("Inbox follow-up from …"), customer gets
       "Got it - Daniel will get back to you."
     - **Currently broken:** customer sees the menu.

2. **Request follow-up loop.**
   - `REQUEST something from Georgia` → request stored, ack.
   - Inbox shows the customer with a "Request" badge.
   - Daniel replies "We just got a Saperavi in — interested?"
   - Customer replies "Yes!" → logged in Inbox, request flips to
     `in_progress`.
   - Daniel marks Inbox thread closed → `special_requests` row also
     flips to `resolved`.

3. **Offer reply still routes correctly.**
   - With an open thread and an active offer, customer texts `2`. They
     get the pending-order confirmation prompt, not the Inbox ack.
   - With an open thread and an active offer, customer texts free text
     (e.g. "what does it taste like?"). The existing
     `sms_awaiting='offer'` block fires first and logs to Inbox with
     `category='purchase_query'`. Daniel sees a purchase-query badge.

4. **Keyword commands still work mid-thread.**
   - With an open thread, `STATUS` returns the tier summary, not logged
     to Inbox.
   - `CELLAR`, `SHIP`, `OFFER`, `STOP`, `SNOOZE`, `RESUME`, `CHANGE`
     all behave as today.

5. **Brand new customer, first message.**
   - New customer (just signed up, default `concierge_status='open'`,
     no prior messages). Texts `hi`.
   - **Expected:** logged in Inbox + admin notified. Daniel can reply.

6. **Closed thread customer.**
   - Daniel closes a thread. Customer texts `hello?`. Receives the
     menu (current behaviour preserved). Customer texts `QUESTION`,
     reopens.

7. **Ad-hoc outbound logged.**
   - From Inbox "+ New message", select a customer, send "Hi, just
     checking in." Inbox now shows that thread with the outbound
     message at the bottom and `concierge_status='open'`.
   - Customer replies → reply lands in same thread.

8. **Backfill migration.**
   - Run migration on a staging DB with N existing `special_requests`
     rows. Confirm N new `concierge_messages` rows with
     `category='special_request'`. Re-run migration → no duplicates.

9. **Twilio signature still validated.** Send a request with an invalid
   signature → 403, no DB writes.

## Open questions for Julia

1. Confirm the new "Inbox" name (vs "Messages" / "Conversations" /
   keeping "Concierge"). The spec assumes "Inbox".

2. Should the "+ New message" button also work for non-customer
   phone numbers (e.g. a prospect Daniel met IRL), or restrict to
   active customers only? Spec assumes restrict to known customers
   for the Inbox-logged path; non-customers go via Twilio only with
   a warning.

3. When Daniel closes a thread, should we send the customer a quiet
   "Thanks, anything else just text us" message, or close silently?
   Recommendation: silent close — sending a closing message can feel
   dismissive and risks an unwanted reply.

4. Do you want the unread badge in the nav to be a count or just a
   dot? Recommendation: a count, capped at "9+".
