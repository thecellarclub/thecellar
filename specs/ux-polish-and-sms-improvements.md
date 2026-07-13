# Spec: UX Polish — Smart Quantity Handling, SMS Log Overhaul, Daniel Voice, Admin Styling, Character Counters

## Context

We're a few weeks into live SMS offers. Observing real customer replies and admin usage has surfaced five improvements needed before the next offer round.

**Problem 1 — Wasted "reply with a number" text when we already detected the number.**
When a customer replies to an offer with something like "two bottles please" or "I'll take 2", the parser (in the `charming-goldwasser` worktree) correctly identifies the quantity — but the current code path on master (line 1096-1101 in `route.ts`) only accepts pure digits (`/^\d+$/`). If the `parseOrderReply` branch has been merged, it handles quantity extraction correctly. However, when `ambiguous: true` is set (e.g. "2 or 3"), the system currently still proceeds to create the order. The issue is the **`sms_awaiting === 'offer'` path** (lines 1096-1101): it only accepts pure digits, meaning "two bottles please" falls through to the `pendingType === 'offer'` unparseable handler at line 1156-1189, which sends the wasteful "To order, just reply with a number" SMS even though we successfully detected a number. This costs us a text message segment (~£0.04) and annoys the customer.

**Problem 2 — SMS Log page is confusing.**
The current `/admin/(protected)/sms-log` page shows parse outcomes (quantity/unparseable/ambiguous/keyword) with filter chips. Julia finds it confusing — it's useful for debugging the parser but doesn't show the actual conversation flow. She wants a Twilio-style chronological log of all messages sent and received, so she can investigate how customers are actually responding and what we sent back.

**Problem 3 — Messages don't sound like Daniel.**
20+ outbound SMS messages use "we" / "our" / first-person plural. Daniel is a person, not a company. Every customer-facing SMS should sound like it's from one guy — warm, personal, informal.

**Problem 4 — Grey text on white cards is hard to read.**
The admin dashboard (`app/admin/(protected)/page.tsx`) uses `text-gray-500` for stat labels and `text-gray-400` for secondary info on `bg-white` cards. Low contrast, especially on laptop screens in bright environments.

**Problem 5 — Missing character counters on SMS inputs.**
3 of 5 admin textareas have character counters (BroadcastForm, SendMessageForm, SendBlastForm). Two are missing them: WineForm description textarea and ConciergeReplyForm. The counter logic also needs to be segment-aware.

---

## Goals

1. When we detect a quantity in an offer reply (including natural language like "two bottles"), skip straight to the order confirmation message — never send an intermediate "reply with a number" text.
2. Replace the SMS Log page with a chronological message log (inbound + outbound) that shows the full conversation, like Twilio's message log.
3. Rewrite all customer-facing SMS messages to sound like they're from Daniel (first person singular, warm, informal).
4. Fix admin dashboard text contrast.
5. Add segment-aware character counters to all SMS input textareas.

## Non-Goals

- Changing the order flow logic (YES gate, pending orders, stock checks — all stay the same).
- Adding new keywords or changing keyword routing.
- Modifying the parser logic in `parseOrderReply` itself (it's correct — just needs to be wired in properly).
- Rebuilding the admin layout/nav from scratch.

---

## Required Changes

### 1. Smart quantity detection — skip the "reply with a number" text

**Problem location:** `app/api/webhooks/twilio/inbound/route.ts`, the `sms_awaiting === 'offer'` block (lines 1096-1101 on master).

**Current behaviour:** Only `/^\d+$/` is accepted. Natural-language replies like "two bottles please" fall through to the `pendingType === 'offer'` handler (line 1156), which logs a `concierge_messages` row, emails admin, and sends:
> `To order, just reply with a number - e.g. 2 for 2 bottles. We have passed your message to Daniel and he will be in touch.`

**Required behaviour:** Use `parseOrderReply()` in the `sms_awaiting === 'offer'` block. If it returns `kind === 'quantity'`, proceed directly to `handlePendingOrder(from, customer, result.quantity, sb)` — the customer gets the confirmation message ("Got it — 2 bottles of X (£Y). Reply YES to confirm.") with no intermediate text.

**Change:**
Replace the digit-only check at lines 1096-1101:
```ts
// BEFORE
if (customer.sms_awaiting === 'offer') {
  const qty = parseInt(body, 10)
  if (!isNaN(qty) && qty > 0 && /^\d+$/.test(body)) {
    await sb.from('customers').update({ sms_awaiting: null }).eq('id', customer.id)
    return await handlePendingOrder(from, customer, qty, sb)
  }
}
```

```ts
// AFTER
if (customer.sms_awaiting === 'offer') {
  const parseResult = parseOrderReply(rawBody)
  if (parseResult.kind === 'quantity') {
    await sb.from('customers').update({ sms_awaiting: null }).eq('id', customer.id)
    void logInbound({
      sb, phone: from, raw: rawBody, customerId: customer.id,
      parseKind: 'quantity', parseQuantity: parseResult.quantity,
      ambiguous: parseResult.ambiguous ?? false,
    })
    return await handlePendingOrder(from, customer, parseResult.quantity, sb)
  }
}
```

The `pendingType === 'offer'` fallback at lines 1156-1189 stays as-is for genuinely unparseable replies — but now "two bottles please", "3 plz", "I'll take a couple" etc. will never hit it.

**Also:** The main quantity route (line 1359-1363 on master) should use `parseOrderReply` as well if not already updated. The worktree `charming-goldwasser` already does this — ensure it's merged.

---

### 2. SMS Log → Full Message Log

**Replace** the current `/admin/(protected)/sms-log` page (parse-outcome view) with a chronological message log showing all SMS activity.

#### Data source

Create a new table `sms_messages` (migration `025_sms_messages.sql`) that logs every SMS sent and received:

```sql
create table sms_messages (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  phone text not null,
  direction text not null check (direction in ('inbound', 'outbound')),
  body text not null,
  created_at timestamptz default now(),
  -- Optional metadata
  twilio_sid text,
  trigger text  -- what caused this: 'offer_reply', 'keyword:yes', 'cron:nudge', 'admin:reply', etc.
);
create index on sms_messages (created_at desc);
create index on sms_messages (customer_id, created_at desc);
create index on sms_messages (phone, created_at desc);
```

#### Logging writes

- **Inbound:** Add a write to `sms_messages` at the top of the inbound webhook, immediately after we identify the customer (before any routing logic). Direction = `inbound`, body = raw message body.
- **Outbound:** Modify `sendSms()` in `lib/twilio.ts` to also insert a row into `sms_messages` with direction = `outbound`. Pass an optional `trigger` string from each call site so we can see why a message was sent.

The existing `sms_parse_log` table stays for parse debugging — it's still written to for quantity/unparseable/keyword routing outcomes. But the new page shows `sms_messages` instead.

#### New page UI — `/admin/(protected)/sms-log/page.tsx`

Replace the current parse-outcome view entirely. New layout:

**Header:** "Message log" with a subtitle showing total message count for last 24h.

**Filters (top bar):**
- Text search (filters on `body` and customer name)
- Direction toggle: All / Inbound / Outbound
- Date range (default: last 7 days)

**Main view — chronological table:**
| Column | Content |
|---|---|
| Time | Timestamp, `en-GB` short format |
| Direction | Arrow icon: ↓ (inbound, blue) or ↑ (outbound, green) |
| Customer | Name (linked to `/admin/customers/{id}`) or phone if unknown |
| Message | Full body text (not truncated — wrap text). Monospace for readability. |
| Trigger | Badge showing what triggered the outbound (e.g. "offer_reply", "cron", "admin") — blank for inbound |

**Pagination:** 100 rows per page, load more button (or cursor-based pagination).

**Conversation drill-down:** Clicking a customer name filters to show only that customer's messages — effectively a conversation view.

**Keep the parse log as a separate admin page** (`/admin/(protected)/parse-log`) for debugging if needed, but it's secondary. The main nav link stays "SMS Log" and points to the new message log.

---

### 3. Daniel voice — rewrite all customer-facing SMS messages

Every `sendSms()` call that goes to a customer should sound like Daniel. Guidelines:

- **First person singular:** "I" not "we". "I've" not "we've". "I'll" not "we'll".
- **Warm and informal:** conversational but not sloppy. No corporate-speak.
- **Brief:** SMS messages cost money per segment. Stay under 160 chars where possible.
- **Never refer to "The Cellar Club" in third person** — Daniel IS the cellar club from the customer's perspective.

#### Message rewrites (full list)

Each message below shows the current text → the new Daniel-voice version. The implementor should find-and-replace each one in the codebase. All messages must still fit within 160 GSM-7 characters (or the minimum segments currently used).

| Location | Current | New (Daniel voice) |
|---|---|---|
| Unknown number | `Hello! We don't recognise this number. If you'd like to join The Cellar Club, sign up at {url}/join` | `Hey! I don't recognise this number. If you'd like to join, sign up at {url}/join` |
| Offer fallback (no active) | `There's no active offer right now. We'll text you when the next wine is ready.` | `Nothing live right now — I'll text you when the next one's ready.` |
| Wine sold out | `Sorry, that one sold out. We will be in touch with the next drop.` | `Sorry, that one sold out. I'll be in touch with the next drop.` |
| Out of stock | `Sorry, we're out of stock on this one!` | `Sorry, this one's sold out!` |
| Limited stock | `Sorry, we only have {n} bottle(s) left. Reply {n} to grab them.` | `Only {n} left on this one — reply {n} to grab them.` |
| Order cap | `We cap orders at {MAX} bottles per text - reply {MAX} if you would like the maximum.` | *(Remove MAX_BOTTLES cap entirely per existing spec. If kept for any reason:)* `I can do up to {MAX} at a time — reply {MAX} for the max.` |
| Pending order, no card | `Got it — {qty} bottle(s) of {wine} (£{total}). We just need a card on file to confirm — add one at {url} and reply YES. Expires in 10 minutes.` | `Got it — {qty} of {wine} (£{total}). Just need a card on file first: {url}. Once saved, I'll send a final confirm.` |
| Pending order, with card | `Got it - {qty} bottle(s) of {wine} (£{total}). Reply YES to confirm your order. This offer expires in 10 minutes.` | `{qty} x {wine} — £{total}. Reply YES to confirm.` |
| No card on YES | `We don't have a payment card on file. Add one at {url} then reply YES once done.` | `I don't have a card on file for you. Add one here: {url} — then reply YES.` |
| 3DS required | `We need you to verify your payment. Visit {url} to complete your order.` | `Your bank needs a quick verification. Tap here to complete: {url}` |
| Card declined | `Your payment didn't go through. Update your card at {url} and reply YES again to try.` | `Card didn't go through. Update it here: {url} — then reply YES to try again.` |
| Ship no card | `We don't have a payment card on file. Add one at {url} and reply SHIP CONFIRM again.` | `I don't have a card on file. Add one here: {url} — then text SHIP CONFIRM again.` |
| Ship 3DS | `We need you to verify your payment. Visit {url} to complete your shipment.` | `Your bank needs a quick check. Tap here to complete: {url}` |
| Shipment confirmed | `Confirmed! We'll get your {n} bottles on their way to {addr}. We'll text you a tracking number when they're dispatched.` | `Done! I'll get your {n} bottles on their way to {addr}. I'll text you a tracking number when they ship.` |
| Special request ack | `Got it - we will look into it. Daniel will be in touch if we decide to run it as a drop.` | `Got it — I'll look into that. If I can get hold of it, I'll run it as a drop.` |
| Unparseable fallback (offer context) | `To order, just reply with a number - e.g. 2 for 2 bottles. We have passed your message to Daniel and he will be in touch.` | `Didn't catch that — just reply with a number (e.g. "2") to order. If you need something else, text QUESTION and I'll get back to you.` |
| Welcome back (RESUME) | `Welcome back - you will start getting our drops again soon.` | `Welcome back — I'll have something for you soon.` |
| Cellar empty | `Your cellar is empty right now - keep an eye out for our next drop.` | `Nothing in your cellar yet — I'll text you when the next wine's ready.` |
| Payment taken (early ship) | `Payment taken - we will ship your {n} bottle(s) to: {addr}` | `Payment taken — I'll ship your {n} bottles to {addr}.` |
| Menu fallback | `OFFER: Daniel's latest wine\nQUESTION: ask anything\nREQUEST: something you'd like to see\n\nSee your cellar and update details: {url}/portal` | `OFFER — see my latest wine\nQUESTION — ask me anything\nREQUEST — something you'd like to see\n\nManage your account: {url}/portal` |

**Note:** Some messages (STATUS display, CELLAR list, shipment address confirmations) are data-heavy and don't need voice changes — leave those as-is unless they contain "we"/"our".

**Implementation approach:** Do NOT create a templates file for these — keep them inline at each call site (easier to grep and contextualise). Just rewrite the strings in place.

---

### 4. Admin — fix grey text contrast across all pages

The problem is widespread across all admin pages, not just the dashboard. The rule is simple:

- `text-gray-400` and `text-gray-300` on white or light (`bg-white`, `bg-gray-50`, `bg-gray-100`) backgrounds → bump to `text-gray-600` minimum.
- `text-gray-500` for secondary content on white cards is acceptable but labels and data should be `text-gray-700` or darker.
- **Exception:** `text-gray-400` and `text-gray-300` on the dark sidebar (`bg-gray-900`, `bg-gray-800`) are intentional — leave those alone.

**Full audit of `text-gray-400` / `text-gray-300` on light backgrounds to fix (grep confirms these exist):**

| File | Instance | Fix |
|---|---|---|
| `app/admin/_components/InboxClientView.tsx` line 62 | `text-gray-400` — "SMS before this thread" label on `bg-gray-100` | → `text-gray-600` |
| `app/admin/_components/InboxClientView.tsx` line 67 | `text-gray-400` — timestamp on SMS context bubble | → `text-gray-600` |
| `app/admin/_components/InboxClientView.tsx` line 690 | `text-gray-400` — outbound message timestamp | → `text-white/70` (it's on a dark `bg-gray-900` bubble — already acceptable, but can use `text-gray-300` for clarity) |
| `app/admin/_components/ConciergeClientView.tsx` line 487 | `text-gray-400` — outbound message timestamp | → `text-gray-300` (on dark bubble — fine, leave or bump slightly) |
| `app/admin/_components/SendOfferForm.tsx` line 143 | `text-gray-400` — inline char counter | → Replace with `SmsCharCounter` (see section 5) |
| `app/admin/_components/WineForm.tsx` line 174 | `text-gray-400` — URL preview text | → `text-gray-600` |
| `app/admin/(protected)/wines/page.tsx` line 65 | `text-gray-300` — em dash placeholder | → `text-gray-500` |
| `app/admin/(protected)/layout.tsx` line 36 | `text-gray-400` — "Admin" label on dark sidebar | Leave — dark background |
| `app/admin/_components/MobileAdminNav.tsx` line 32 | `text-gray-400` — "Admin" label on dark sidebar | Leave — dark background |
| `app/admin/_components/AdminNav.tsx` line 27 | `text-gray-400` — inactive nav links on dark sidebar | Leave — dark background |
| `app/admin/_components/SignOutButton.tsx` line 9 | `text-gray-400` — on dark sidebar | Leave — dark background |
| `app/admin/_components/MobileAdminNav.tsx` line 96 | `text-gray-400` — inactive nav links on dark sidebar | Leave — dark background |

**Additionally — `text-gray-500` that should be darker (data/labels on white cards):**

These are widespread across all pages. Rather than enumerating every instance, apply this rule: any `text-gray-500` that is a **label** (e.g. "Joined", "Status", "Tier", column header labels in the summary strip) should become `text-gray-700`. Any `text-gray-500` that is **secondary data** (phone numbers, dates, sub-labels) should become `text-gray-600`.

The table column headers on `bg-gray-50` (`text-gray-500 uppercase tracking-wide`) are fine as-is — the uppercase tracking makes them readable at that weight.

**Summary of the rule for the implementor:**
- On `bg-white` or `bg-gray-50` cards: minimum `text-gray-600` for any visible text. Labels → `text-gray-700`. Data → `text-gray-700`. Secondary/meta → `text-gray-600`.
- `text-gray-500` acceptable only for table column headers on `bg-gray-50` (they're uppercase).
- `text-gray-400` / `text-gray-300` only on dark sidebar backgrounds (`bg-gray-900`).

---

### 5. Segment-aware character counter on all SMS textareas

#### The rule

SMS segments work as follows:
- **1 segment:** up to 160 GSM-7 characters
- **2+ segments:** once you exceed 160 chars, the message is split into segments of **153 characters each** (7 chars per segment are used for concatenation headers). So the first segment also becomes 153.
- Formula: `segments = length <= 160 ? 1 : Math.ceil(length / 153)`

#### Component

Create a reusable component `app/admin/_components/SmsCharCounter.tsx`:

```tsx
// Props: value (string), className (optional)
// Displays: "{length} chars · {segments} segment(s)"
// Styling:
//   - Green (text-green-600): ≤ 140 chars (safe single segment)
//   - Amber (text-amber-600): 141-160 chars (still 1 segment but close)
//   - Red (text-red-600 font-bold): > 160 chars (multi-segment) — also show segment count
```

#### Apply to all SMS textareas

`SmsCharCounter` has been created at `app/admin/_components/SmsCharCounter.tsx`. The following table shows implementation status:

| Component | File | Status |
|---|---|---|
| SendBlastForm | `app/admin/_components/SendBlastForm.tsx` | ✅ Done |
| BroadcastForm | `app/admin/_components/BroadcastForm.tsx` | ✅ Done |
| SendMessageForm | `app/admin/_components/SendMessageForm.tsx` | ✅ Done |
| ConciergeReplyForm | `app/admin/_components/ConciergeReplyForm.tsx` | **TODO — add** |
| WineForm (description) | `app/admin/_components/WineForm.tsx` | **TODO — add** |
| InboxClientView — DesktopReplyForm | `app/admin/_components/InboxClientView.tsx` | **TODO — add** |
| InboxClientView — MobileReplyInput | `app/admin/_components/InboxClientView.tsx` | **TODO — add** |

**DesktopReplyForm** (inside `InboxClientView.tsx`, around line 437): the textarea already exists but has no counter. Add `<SmsCharCounter value={message} className="text-xs" />` between the textarea and the send button row.

**MobileReplyInput** (inside `InboxClientView.tsx`, around line 216): add `<SmsCharCounter value={message} className="text-xs" />` above the flex row containing the textarea and send button. It should sit between the error line and the input row.

For the WineForm, the description field feeds into the offer SMS template. The counter should show the character count of the description field itself, with a note like "(this is appended to the offer template — total SMS length may vary)" underneath.

**SendOfferForm** (`app/admin/_components/SendOfferForm.tsx`) has an inline char/segment counter at line 143 (`text-gray-400 mt-1`). Replace it with `<SmsCharCounter value={preview} />` for consistency, and drop the inline counter.

---

## Migrations Summary

- `025_sms_messages.sql` — new `sms_messages` table for full message log.

(Existing `sms_parse_log` table stays unchanged. No schema changes to `orders`, `customers`, or other tables.)

---

## Files to Create

- `supabase/migrations/025_sms_messages.sql`
- `app/admin/_components/SmsCharCounter.tsx`

## Files to Modify

- `app/api/webhooks/twilio/inbound/route.ts` — wire `parseOrderReply` into the `sms_awaiting === 'offer'` path; add `sms_messages` inbound write; rewrite all outbound SMS strings to Daniel voice.
- `lib/twilio.ts` — modify `sendSms()` to write outbound rows to `sms_messages`.
- `app/admin/(protected)/sms-log/page.tsx` — replace with chronological message log UI.
- `app/admin/(protected)/sms-log/_components/SmsLogClientView.tsx` — rewrite for new message log layout.
- `app/admin/_components/InboxClientView.tsx` — add `SmsCharCounter` to `DesktopReplyForm` and `MobileReplyInput`; fix `text-gray-400` instances on light backgrounds (lines 62, 67).
- `app/admin/_components/WineForm.tsx` — add `SmsCharCounter` to description textarea; fix `text-gray-400` URL preview (line 174).
- `app/admin/_components/ConciergeReplyForm.tsx` — add `SmsCharCounter`.
- `app/admin/_components/SendOfferForm.tsx` — replace inline `text-gray-400` char counter with `SmsCharCounter`.
- `app/admin/_components/SendBlastForm.tsx` — replace inline counter with `SmsCharCounter` (already done — verify).
- `app/admin/_components/BroadcastForm.tsx` — replace inline counter with `SmsCharCounter` (already done — verify).
- `app/admin/_components/SendMessageForm.tsx` — replace inline counter with `SmsCharCounter` (already done — verify).
- All other files containing customer-facing `sendSms()` calls (grep for `sendSms(` across the codebase) — rewrite strings to Daniel voice.
- All admin pages (`app/admin/`) — bump `text-gray-400`/`text-gray-300` on light backgrounds to `text-gray-600`; bump label `text-gray-500` on white cards to `text-gray-700`; bump data `text-gray-500` to `text-gray-600`. Leave sidebar nav colours alone.

---

## Acceptance Criteria

- [ ] Customer texts "two bottles please" after an offer → receives order confirmation message directly (no intermediate "reply with a number" text). Saves one SMS segment per natural-language order.
- [ ] Customer texts "2 or 3" → order created for 2, `ambiguous: true` logged in `sms_parse_log`. No extra SMS sent to clarify — the confirmation message shows the quantity clearly so customer can check.
- [ ] Customer texts "sounds lovely" (no quantity detected) → still gets the fallback "Didn't catch that — just reply with a number" message (this is correct — no quantity was found).
- [ ] `/admin/(protected)/sms-log` shows a chronological log of all inbound and outbound messages with timestamps, direction indicators, customer links, and full message bodies.
- [ ] Clicking a customer in the SMS log filters to show only their messages (conversation view).
- [ ] No customer-facing SMS contains "we", "we'll", "we've", "our" (except where it would be truly unnatural to avoid — flag any exceptions in PR).
- [ ] All customer-facing SMS messages sound warm, personal, from one person.
- [ ] Admin dashboard stat labels are clearly readable (minimum `text-gray-700` on white).
- [ ] No `text-gray-400` on light backgrounds anywhere in admin pages.
- [ ] Every SMS textarea in admin has a character counter showing chars and segment count — including both the desktop and mobile reply inputs in the Inbox.
- [ ] Character counter turns amber at 141+ chars, red at 161+ chars with segment count displayed.
- [ ] WineForm description counter includes a note about template composition.
- [ ] No `text-gray-400` or `text-gray-300` visible on any white or light-grey admin background.
- [ ] All label text on white cards is `text-gray-700` or darker.
- [ ] All secondary/meta text on white cards is `text-gray-600` or darker.
- [ ] Sidebar nav text colours are unchanged.
- [ ] `sendSms()` logs every outbound message to `sms_messages` table.
- [ ] Every inbound message is logged to `sms_messages` table at webhook entry.
