# Spec: Live Twilio conversation history in the admin inbox

## Problem

The inbox conversation view (`/admin/inbox`) renders messages from the
`concierge_messages` table. That table only holds a curated subset of SMS —
inbound questions/requests/offer-replies and admin replies typed in the inbox.
It does **not** include the automated messages the system sends (offer confirmations,
"sold out", ship/payment flows, etc.) or the inbound messages that triggered them.

The result: when an admin opens a thread, they can't see that a customer tried to
order twice and got "sold out" both times, or what automated message a reply was
responding to. There's no continuous context.

We already log **every** inbound and **every** outbound SMS (including automated
ones) to `sms_messages` via `lib/twilio.ts` `sendSms()` and the inbound webhook —
but the inbox doesn't render that; it only pulls 3 `sms_messages` rows as
pre-thread "context" (see `app/admin/(protected)/inbox/page.tsx`, the `smsContext`
block ~lines 130–170).

## Goal

Make the inbox conversation column show the **full two-way SMS history** for a
customer's phone number, sourced **live from the Twilio Messages API** (not our DB),
so it always reflects everything Twilio actually sent and received — automated
messages included. Default to showing the whole conversation, with pagination so we
don't pull unbounded history on every thread open.

## Decisions (from Julia)

- **Source of truth for the conversation view = the Twilio Messages API**, queried
  live when a thread is opened. Do **not** render the conversation from
  `concierge_messages` or `sms_messages` anymore.
- **Depth:** show all messages ideally, but **paginate** — load the most recent page
  first (page size 20), with a "Load older messages" control that fetches the next
  page. This keeps Twilio API calls (which are billed per request and rate-limited)
  bounded per thread open.
- Keep `concierge_messages` / `sms_messages` writes exactly as they are today
  (other features — digest, activity log, special requests — depend on them). This
  spec only changes how the **conversation column reads**.

## What Twilio gives us

Every message in this app is sent from / received on the single number in
`TWILIO_PHONE_NUMBER`. Twilio's Messages list endpoint can be filtered by the
customer's number on **either** leg:

- outbound (we → customer): `To = customer.phone`, `From = TWILIO_PHONE_NUMBER`
- inbound (customer → us): `From = customer.phone`, `To = TWILIO_PHONE_NUMBER`

Twilio's SDK does **not** support an OR across To/From in a single call, so fetch
both directions and merge:

```ts
import { twilioClient } from '@/lib/twilio'

const ours = process.env.TWILIO_PHONE_NUMBER!

const [outbound, inbound] = await Promise.all([
  twilioClient.messages.list({ to: customerPhone, from: ours, limit: PAGE_SIZE * 2 }),
  twilioClient.messages.list({ from: customerPhone, to: ours, limit: PAGE_SIZE * 2 }),
])
```

Each Twilio message resource exposes the fields we need: `sid`, `body`,
`direction` (`outbound-api` / `outbound-reply` / `inbound`), `dateSent` (fall back
to `dateCreated` when `dateSent` is null, e.g. queued), `status`, `errorCode`,
`numSegments`.

Normalise `direction` to our two-value model: anything starting with `outbound` →
`'outbound'`; `inbound` → `'inbound'`.

> Note on Twilio retention: message **bodies** are retained by Twilio for a limited
> window (Twilio's default is 13 months for delivered message bodies; older messages
> may return with redacted/empty bodies). This is acceptable — the inbox is an
> operational tool, not an archive. If a body comes back empty for an old message,
> render it as `(message content no longer available)` rather than a blank bubble.

## Implementation

### 1. New API route: `GET /api/admin/inbox/conversation`

Create `app/api/admin/inbox/conversation/route.ts`.

- First line: `const auth = await requireAdminSession(); if (!auth.ok) return auth.response`
  (same pattern as every other admin route).
- Query params:
  - `customerId` (required) — used to look up the phone number server-side.
    Do **not** trust a phone number passed from the client; resolve
    `customers.phone` via `createServiceClient()` from `customerId`.
  - `pageToken` (optional) — opaque cursor for pagination (see below). Absent =
    first page (most recent messages).
- Behaviour:
  1. Look up `customers.phone` for `customerId`. 404 if not found.
  2. Fetch from Twilio as above, merge the two direction lists into one array.
  3. Sort merged messages by timestamp **descending** (newest first) for cursoring,
     then return them to the client in **ascending** order (oldest→newest) so the UI
     can append naturally.
  4. De-dupe by `sid` (a message should only appear once even if both list calls
     somehow overlap).
  5. Apply pagination — return at most `PAGE_SIZE` (20) messages per call, newest
     page first. Return a `nextPageToken` (or `hasMore: false`) so the client can
     request older messages.
- Response shape:

```ts
{
  messages: Array<{
    sid: string
    direction: 'inbound' | 'outbound'
    body: string            // '' when redacted/unavailable — UI handles
    sentAt: string          // ISO; dateSent ?? dateCreated
    status: string          // Twilio status: delivered, failed, undelivered, queued, ...
    errorCode: number | null
    segments: number
  }>
  hasMore: boolean
  nextPageToken: string | null
}
```

#### Pagination approach

Twilio's own paging (`page()` / `pageToken`) paginates each list call
independently, which is awkward to merge across the two direction queries.
**Simplest robust approach for this volume:** use **time-based cursoring**.

- `pageToken`, when present, is an ISO timestamp = "fetch messages older than this".
- Pass it to Twilio as `dateSentBefore` on both list calls.
- After merging + sorting desc, take the newest `PAGE_SIZE`. `nextPageToken` =
  the `sentAt` of the **oldest** message in the returned page (so the next call
  asks for messages strictly older than that). `hasMore` = true if Twilio returned
  more than `PAGE_SIZE` combined, or if either list call hit its limit.
- Guard the edge case where multiple messages share the same `dateSent` second by
  also de-duping returned `sid`s against what the client already has (client passes
  nothing extra; de-dupe server-side within a page, and the client should ignore any
  `sid` it already holds when appending).

> If, in review, time-cursoring proves fiddly against Twilio's filters, the
> acceptable fallback is: fetch a generous fixed window (e.g. `limit: 200` on each
> direction), merge/sort once, and slice pages in-memory keyed by an integer offset
> token. Pick whichever is cleaner — the **external contract** (`messages` asc,
> `hasMore`, `nextPageToken`) must stay the same either way. Ask if unsure which to
> use.

#### Failure handling

- If the Twilio call throws (network, auth, rate limit `20429`), return HTTP 502
  with `{ error: 'twilio_unavailable' }`. The client shows a non-destructive error
  state with a Retry button — it must **not** wipe the thread or fall back silently
  to stale DB data without telling the admin.

### 2. Inbox conversation column → consume the live endpoint

In `app/admin/_components/InboxClientView` (the client component that renders the
middle conversation column):

- When a thread becomes the selected/active thread, fetch
  `GET /api/admin/inbox/conversation?customerId={id}` and render the returned
  `messages` as the conversation, oldest at top → newest at bottom (same visual
  style as today: inbound left, outbound right).
- Remove the old conversation source for the middle column:
  - Stop rendering `thread.messages` (the `concierge_messages`-derived array) as the
    conversation.
  - Remove the `smsContext` "3 messages before the thread" block — it's fully
    superseded.
  - (Leave the `concierge_messages` fetch in `page.tsx` in place **only** if other
    parts of the inbox still need it for thread-list construction — see §4.)
- Add a **"Load older messages"** button/affordance at the **top** of the
  conversation when `hasMore` is true. Clicking it calls the endpoint again with
  `pageToken = nextPageToken` and **prepends** the older page above the current
  messages, preserving scroll position. De-dupe by `sid` on prepend.
- Loading states:
  - First open: show a lightweight spinner/skeleton in the conversation column.
  - Older-page load: spinner on the "Load older" button only.
  - Error: inline error row with Retry (per §1 failure handling).
- Reload behaviour: after an admin sends a reply (existing
  `POST /api/admin/concierge/[customerId]/reply`), re-fetch the first (newest) page
  so the just-sent message appears from Twilio's record. (Optimistically appending
  the sent text first, then reconciling on refetch, is fine and nicer UX — but the
  source of truth shown after refetch is Twilio.)

### 3. Visual treatment of message types

Because we now show automated messages too, make the conversation readable:

- Render each Twilio `status` subtly where it matters: messages with status
  `failed` or `undelivered` (or a non-null `errorCode`) get a small red
  "Not delivered" marker under the bubble. Delivered/sent need no marker.
- Empty `body` (redacted/old) → render `(message content no longer available)` in
  muted italic instead of an empty bubble.
- Do **not** try to label which messages were "automated" vs "hand-typed" — Twilio
  doesn't reliably distinguish, and the point is just to see the full thread. The
  direction (inbound/outbound) is enough.

### 4. Thread list (left column) — keep as-is

The left-hand thread list, assignment, follow-ups, notes, activity log, filters,
and the daily digest all stay on `concierge_messages` / `inbox_*` tables exactly as
they are. **This spec does not touch them.** Only the middle conversation column
changes its data source. (Note: `sms_messages` is being fully deprecated — see §5.)

- If `page.tsx` currently uses `concierge_messages` to decide which threads exist /
  their last-message direction for sorting, leave that intact.
- The only `page.tsx` change permitted by this spec: you may **remove the
  `smsContext` fetch/derivation** (the `sms_messages` `.limit(600)` block and the
  `contextAcc` logic), since the conversation column no longer uses it. If removing
  it risks touching anything else, leave it and just stop rendering it — ask if
  ambiguous.

### 5. Deprecate `sms_messages` entirely

Once the conversation view reads live from Twilio, the `sms_messages` table has **no
remaining reader** — it was only read by the `smsContext` block (removed in §2) and
the standalone SMS-log admin page. Twilio is now the source of truth for SMS history,
so the table is redundant. Remove it completely:

**a. Stop writing to it (2 call sites):**

- `lib/twilio.ts` `sendSms()` — remove the `sms_messages` insert block (the
  `try { ... sb.from('sms_messages').insert(...) }` after the Twilio send, ~lines
  50–63). Keep the actual `twilioClient.messages.create(...)` send untouched.
- `app/api/webhooks/twilio/inbound/route.ts` — remove the `logSmsInbound()` helper
  (~lines 103–120) and its call site (`void logSmsInbound({ ... })`, ~line 1179, with
  its `// Log every inbound to sms_messages` comment). Removing this must not change
  any control flow — it's a fire-and-forget call.

**b. Remove the SMS-log admin page:**

- Delete `app/admin/(protected)/sms-log/` (the `page.tsx` and its `_components/`
  folder, incl. `SmsLogClientView`).
- Remove the nav entry in `app/admin/_components/AdminNav.tsx`
  (`{ href: '/admin/sms-log', label: 'SMS log', exact: false }`).
- Grep for any other links/references to `/admin/sms-log` and remove them.

**c. Drop the table:**

- Add migration **`041_drop_sms_messages.sql`** (NOT 039 — migrations already exist
  up to 040; CLAUDE.md's "next is 039" note is stale and should be corrected to 041):
  `DROP TABLE IF EXISTS sms_messages;`
- The original table was created in `025_sms_messages.sql` — the drop migration
  supersedes it.

**d. Verify nothing else references it:**

- `grep -ri "sms_messages"` across the repo after the changes — the only remaining
  hits should be the old `025_sms_messages.sql` migration and the new `041` drop
  migration. Any TypeScript type referencing the table (e.g. `SmsMessageRow`) should
  be gone with the deleted page; confirm no stray imports break the build.

> If any reference to `sms_messages` is found outside the call sites listed above
> (e.g. an export, a report, an analytics query not surfaced in this spec), **stop
> and ask** rather than dropping the table — there may be a reader this spec didn't
> account for.

## Out of scope

- No change to `concierge_messages` (writes and thread-list/digest reads stay).
- No change to how messages are **sent** (only the redundant DB logging is removed).
- No change to thread-list sorting, assignment, follow-ups, notes, activity, digest.
- No caching layer for Twilio responses (revisit later if API volume becomes a
  cost/latency problem — a short-TTL cache keyed by customerId+pageToken would be
  the place to start).

## Acceptance criteria

1. Opening a thread for a customer who has had automated exchanges (e.g. tried to
   order and got "sold out") shows those automated messages **and** the customer's
   triggering replies, inline in time order.
2. The conversation reflects Twilio's record live — a message sent outside the inbox
   (via a cron/automated flow) appears after a thread reload without any DB write to
   `concierge_messages`.
3. Default open loads the most recent 20 messages; "Load older messages" fetches and
   prepends the previous 20, repeatable until `hasMore` is false, with no duplicate
   bubbles.
4. A failed/undelivered message is visibly marked; an old redacted message renders
   the placeholder rather than a blank bubble.
5. If Twilio is unreachable, the conversation column shows an error + Retry, and does
   not silently show stale data as if it were live.
6. The thread list, assignment, follow-ups, notes, activity log, filters, and daily
   digest are unchanged in behaviour.
7. `sms_messages` is fully removed: no code writes to or reads from it, the
   `/admin/sms-log` page and its nav entry are gone, migration `041` drops the table,
   and the app builds with no dangling references or broken types.

## Open questions for implementer

- Pagination: time-cursor (`dateSentBefore`) vs fixed-window-then-slice. Spec
  prefers time-cursor; fallback documented. Flag if Twilio's filter behaviour makes
  one clearly better.
- Whether any thread-list logic in `page.tsx` genuinely depends on `smsContext`
  before removing it.
