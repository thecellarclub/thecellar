# Spec: Quiet Unparseable Handling — Inbox + Silence Instead of Auto-Replies

## Context

Customers are replying to offers with natural-language messages that reference multiple wines across multiple offers — e.g. "2 silverhand 1 roter veltliner". Today this gets parsed as quantity 2 (first digit wins, `ambiguous: true` logged but ignored) and creates a pending order for 2 of whatever the current active offer is. That's wrong — the customer wanted 2 of one wine and 1 of another, possibly from different offers.

Even when the parser correctly identifies a message as unparseable, the auto-reply feels like a chatbot:

- `"Didn't catch that — just reply with a number (e.g. "2") to order."` (offer context)
- `"Sorry, didn't catch that. Reply with a number (e.g. 2) to order. For anything else, reply QUESTION followed by your message."` (general context)
- The full keyword menu: `"OFFER — see my latest wine / QUESTION — ask me anything..."` (final fallback)

These break the illusion that they're texting Daniel. Customers shouldn't need to learn keywords or be told how to format their replies. The automation should quietly capture clean orders (a plain number) and route everything else to a human.

**Principle:** automation handles payment capture (quantity → YES → charge). Everything else is Daniel. When in doubt, stay silent and let Daniel follow up.

---

## Goals

1. **Ambiguous parses go to inbox, not to `handlePendingOrder`.** If the parser finds multiple digits or can't confidently extract a single quantity, treat it as a human message — log it, notify admin, don't auto-reply.
2. **Unparseable replies in offer context go to inbox silently.** No auto-reply SMS. The message lands in the admin inbox with an email notification so Daniel can follow up in his own voice.
3. **Keep the keyword menu for non-offer contexts.** When a customer texts something unparseable outside of an active offer (e.g. after first signup, or weeks between offers), the keyword menu is genuinely helpful — it tells them how to reach Daniel. Only remove the chatbot-y auto-replies that fire during the offer flow.
4. **Keep the happy path fast.** A clean "2" or "yes" still gets the instant automated response. Only the edges slow down.

## Non-Goals

- Removing keywords entirely (STOP, HELP, STATUS etc. still work — they're useful for customers who know them).
- Building smarter NLP parsing (that's a chatbot, which is what we're avoiding).
- Changing how the YES flow works.
- Changing outbound offer SMS content.

---

## What Already Exists (REUSE — DO NOT REBUILD)

| Concern | Current behaviour | Path |
|---|---|---|
| `parseOrderReply()` | Returns `{ kind: 'quantity', quantity, ambiguous? }` or `{ kind: 'unparseable' }` | `lib/parse-order-reply.ts` |
| Offer-context unparseable | Logs to `concierge_messages` as `purchase_query`, emails admin, **then sends auto-reply SMS** | `route.ts` ~line 1248-1266 |
| General unparseable | Sends `unparseableFallback()` SMS (keyword menu) | `route.ts` ~line 1481-1508 |
| General unknown message (no keyword match, no quantity) | Sends keyword menu SMS | `route.ts` ~line 1503-1507 |
| Concierge inbox | `concierge_messages` table + admin inbox UI at `/admin/inbox` | `app/admin/(protected)/inbox/` |
| Admin email alerts | `notifyAdmin(subject, text)` | `lib/resend.ts` |
| Parse logging | `sms_parse_log` table via `logInbound()` | `route.ts` top of file |

---

## Required Changes

### 1. Treat ambiguous parses as unparseable

**File:** `app/api/webhooks/twilio/inbound/route.ts`

**Where:** Both places where `parseOrderReply` result is checked — the `sms_awaiting === 'offer'` block (~line 1170) and the general quantity-reply block (~line 1472).

**Change:** If `parseResult.kind === 'quantity'` AND `parseResult.ambiguous === true`, do NOT call `handlePendingOrder`. Instead, fall through to the new silent-inbox handler (see section 3 below).

```ts
// Before:
if (parseResult.kind === 'quantity') {
  void logInbound({ ... ambiguous: parseResult.ambiguous ?? false })
  return await handlePendingOrder(from, customer, parseResult.quantity, sb)
}

// After:
if (parseResult.kind === 'quantity' && !parseResult.ambiguous) {
  void logInbound({ ... ambiguous: false })
  return await handlePendingOrder(from, customer, parseResult.quantity, sb)
}
// ambiguous quantity falls through to inbox routing below
```

This means "2 silverhand 1 roter veltliner" (ambiguous: two digits found) goes to a human instead of blindly ordering 2 of the active offer.

### 2. Remove auto-reply SMS for offer-context unparseable messages only

**Two places to change:**

**a) Offer-context unparseable** (~line 1265):

Remove the `sendSms` call that sends `"Didn't catch that — just reply with a number..."`. Keep the `concierge_messages` insert and the `notifyAdmin` call — those are good. Just delete the SMS.

**b) General unparseable with pending order** (~line 1503-1504):

Remove the `sendSms` call that sends `"Didn't catch that. Reply YES to confirm your order, NO to cancel it..."`. The pending order is still there — if they reply YES later it still works. No need to prompt them.

**Keep the keyword menu for non-offer, no-pending-order contexts** (~line 1505):

The `unparseableFallback()` menu stays. It's useful when customers text outside of the offer window — e.g. after first signup, or between offers — because it tells them how to reach Daniel. The problem was never the menu itself, it was sending chatbot-y replies *during an offer conversation* when the customer clearly thinks they're talking to a human.

### 3. Route all unparseable/ambiguous messages to inbox with admin notification

**File:** `app/api/webhooks/twilio/inbound/route.ts`

The offer-context block (~line 1233) already logs to inbox and emails admin — keep that, just remove the SMS. Extend the same silent-inbox pattern to the ambiguous-quantity case and the general-unparseable-with-pending-order case.

**For the offer-context unparseable block** (customer has `sms_awaiting = 'offer'`):

Keep as-is (concierge_messages insert + notifyAdmin) but remove the sendSms line. No other changes.

**For the ambiguous-quantity case and general-unparseable-with-pending-order case:**

Route to inbox silently (no SMS reply):

```ts
// ── Unparseable or ambiguous → silent inbox routing ──────────────
const rawMessage = (params['Body'] ?? '').trim()
const name = customer.first_name ?? customer.phone

// Log to concierge inbox
await sb.from('concierge_messages').insert({
  customer_id: customer.id,
  direction: 'inbound',
  message: rawMessage,
  category: 'general',
})

if (customer.concierge_status === 'closed') {
  await sb.from('customers').update({ concierge_status: 'open' }).eq('id', customer.id)
}

// Notify admin
await notifyAdmin(
  `Message from ${name}`,
  `${name} sent a message that needs a human reply.\n\nMessage: ${rawMessage}\nPhone: ${customer.phone}`
)

// No SMS reply — Daniel will follow up manually
return twimlOk()
```

### 4. Remove the open concierge thread auto-reply for unknown messages

**File:** `app/api/webhooks/twilio/inbound/route.ts` (~line 1527+)

Currently when a customer has an open concierge thread (`concierge_status === 'open'`) or an open special request, their message is routed to `concierge_messages` and admin is notified — that's correct. Check that no auto-reply SMS is sent in this path. (Based on the exploration, this path already doesn't send an auto-reply, which is the right behaviour. Just confirm.)

### 5. Clean up dead code

- Remove the `hasPendingOrder` check logic (~lines 1484-1501). We now split into two paths: pending order → silent inbox, no pending order → keyword menu. The branching on `hasPendingOrder` to choose between two different auto-reply messages is no longer needed.
- Keep `unparseableFallback()` in `lib/sms-templates.ts` — it's still used for the non-offer keyword menu path.

---

## What Doesn't Change

- **Clean quantity replies** ("2", "six", "a couple") — still handled instantly by `handlePendingOrder`. No regression.
- **YES / NO / STOP / HELP / STATUS / ACCOUNT / SHIP / PAUSE** — all keyword handlers unchanged. These are useful and don't feel chatbot-like because customers initiate them.
- **OFFER keyword** — still works (customer can text OFFER to see the current wine). The reply to OFFER is Daniel's offer description, which is fine.
- **QUESTION / REQUEST keywords** — still work. These route to concierge with a brief acknowledgement SMS. The acknowledgement is fine because the customer explicitly asked for human contact.
- **Keyword menu for non-offer unparseable messages** — still shown when a customer texts something we don't understand outside of an offer context and with no pending order. Useful for new signups and between-offer periods.
- **The concierge thread continuation path** — already silent (inbox + admin email, no auto-reply). No change.
- **Post-charge SMS** ("You have N bottles in the cellar...") — these are transactional confirmations, not chatbot prompts. Keep them.
- **Billing link SMS** for no-card customers — necessary for the payment flow. Keep.

---

## Edge Cases

**Customer texts "2 silverhand 1 roter veltliner":**
Parser finds two digits → `ambiguous: true` → goes to inbox silently. Admin sees the message, creates manual offers (per the admin-manual-offer spec) for the right wines at the right quantities. Much better outcome than blindly ordering 2 of the wrong wine.

**Customer texts gibberish while they have a pending order:**
No auto-reply. The pending order stays active — if they reply YES within the expiry window, it still works. If the expiry passes, the daily cron cleans it up. No harm done.

**Customer texts "thanks" or "cheers" after a successful order:**
Goes to inbox silently. Daniel can reply or not. Previously this would trigger the keyword menu, which is a terrible response to "thanks".

**Customer texts a quantity but with extra context ("3 please, can you also check if you have any Barolo?"):**
Parser extracts 3, no ambiguity (single digit) → `handlePendingOrder` runs for 3 bottles. The "can you also check" part is lost. This is acceptable for v1 — the parser isn't trying to understand natural language, and the customer gets their 3 bottles. If the extra context matters, they can text QUESTION separately. If we see this pattern frequently in the parse log, we can revisit.

**Customer texts a word quantity with extra context ("two bottles of the Chablis please"):**
Parser extracts 2 from "two", no ambiguity → `handlePendingOrder` runs. "of the Chablis" is ignored. This is fine — there's only one active offer at a time, and the customer is almost certainly referring to it.

---

## Verifying the Change

After deploying, check the `sms_messages` table for outbound messages with `trigger = 'unparseable'` or `trigger = 'offer_unparseable'` or `trigger = 'menu'`. There should be zero new rows with these triggers. All unparseable inbound messages should appear in the admin inbox instead.
