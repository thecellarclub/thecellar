# Spec: YES keyword should tolerate punctuation

## What happened with Clare

1. Admin sent a manual offer for 2 × Bruno Andreu Elixir (£38.00) via the customer page at 19:03.
2. This created an `awaiting_confirmation` order and set `sms_awaiting = 'offer'` on the customer.
3. Clare replied **"YES."** at 19:04 — note the full stop.
4. The inbound webhook lowercases the body to `"yes."` and checks `body === 'yes'` — exact match, fails.
5. Because `sms_awaiting === 'offer'` and `"yes."` didn't match, the message fell through the `pendingType === 'offer'` unparseable handler (lines ~1249-1276), which logged it to `concierge_messages` and cleared `sms_awaiting` — silently consuming her YES without charging.
6. Clare then sent a second message ("Not a problem for the Roter…") which also fell through without issue because `sms_awaiting` was already cleared.

**The order is still `awaiting_confirmation` and has not expired yet. Clare should be charged.**

---

## Immediate action (manual — do this now, outside Claude Code)

Go to Clare's customer page in admin (`/admin/customers/[id]`), find the pending order for Bruno Andreu Elixir, and use the **Send offer** form to re-send it to her, or use the admin Supabase panel to:

1. Find the `awaiting_confirmation` order for Clare for Bruno Andreu Elixir.
2. Confirm she still wants it (she said YES, so proceed).
3. Trigger the charge by either:
   - Using the manual offer re-send (creates a fresh pending order → she'll get another SMS and need to reply YES again — cleanest option), or
   - Directly via the Stripe dashboard: create a PaymentIntent for £38.00 against her saved payment method, then mark the order as `confirmed` in Supabase and run `handlePostCharge` logic manually (add to cellar, update tier, check case threshold).

The re-send approach is recommended — keeps the YES gate intact and gives Clare a clean confirmation SMS.

---

## The fix

### Root cause

Two places in `app/api/webhooks/twilio/inbound/route.ts` check for YES with an exact string match against the lowercased body. Neither tolerates trailing punctuation:

**Line ~1180** (inside `sms_awaiting === 'offer'` block):
```ts
if (body === 'yes') {
```

**Line ~1445** (main keyword router):
```ts
if (body === 'yes') {
```

`body` is `rawBody.toLowerCase()` with leading/trailing whitespace trimmed, but punctuation is not stripped. So `"YES."`, `"Yes!"`, `"yes,"`, `"YES!!"` all fail to match.

### Fix — strip trailing punctuation when checking YES (and other keywords)

The cleanest approach is to derive a `keyword` variable from `body` that strips trailing punctuation, and use it for keyword checks. **Do not strip punctuation globally** — `rawBody` is still needed for quantity parsing and concierge message content.

**In `route.ts`, immediately after line 1145 where `body` is defined:**

```ts
const rawBody = (params['Body'] ?? '').trim()
const body = rawBody.toLowerCase()
// Strip trailing punctuation for keyword matching only
// e.g. "yes." → "yes", "YES!" → "yes", "no," → "no"
const keyword = body.replace(/[.!?,;]+$/, '')
```

Then replace the two YES checks:

**Line ~1180:**
```ts
// BEFORE
if (body === 'yes') {

// AFTER
if (keyword === 'yes') {
```

**Line ~1445:**
```ts
// BEFORE
if (body === 'yes') {

// AFTER
if (keyword === 'yes') {
```

Also apply `keyword` to the other single-word exact-match keyword checks that are equally vulnerable to punctuation:

| Current check | Change to |
|---|---|
| `body === 'no'` | `keyword === 'no'` |
| `body === 'cancel'` | `keyword === 'cancel'` |
| `body === 'stop'` | `keyword === 'stop'` |
| `body === 'unsubscribe'` | `keyword === 'unsubscribe'` |
| `body === 'cellar'` | `keyword === 'cellar'` |
| `body === 'ship'` | `keyword === 'ship'` |
| `body === 'pause'` | `keyword === 'pause'` |
| `body === 'resume'` | `keyword === 'resume'` |
| `body === 'status'` | `keyword === 'status'` |
| `body === 'account'` | `keyword === 'account'` |
| `body === 'offer'` | `keyword === 'offer'` |
| `body === 'change'` | `keyword === 'change'` |
| `body === 'exit'` | `keyword === 'exit'` |

**Do NOT change** prefix checks (`body.startsWith('request ')`, `body.startsWith('question ')`, `body.startsWith('snooze ')`, `body === 'ship confirm'`) — these are multi-word and the trailing punctuation stripping doesn't help or hurt them. Leave `body` for those. `'ship confirm'` in particular should stay on `body` since "ship confirm." could reasonably be treated as intent but the risk of false positives from mid-string punctuation is low — if needed, `keyword` could be used here too, but not required now.

### Why not strip all punctuation from `body`?

Two reasons:

1. Quantity parsing via `parseOrderReply` operates on `rawBody` directly (not `body`), so that's unaffected either way.
2. Concierge messages and request content use `rawBody` or `body` for the stored message text — we want to preserve the original message for display in the inbox. Stripping from a separate `keyword` variable keeps this clean.

---

## Files to change

- `app/api/webhooks/twilio/inbound/route.ts` — add `keyword` derivation (~line 1146), replace exact single-word keyword checks with `keyword ===` throughout.

---

## Acceptance criteria

- [ ] Customer replies "YES." → order is charged, confirmation SMS sent.
- [ ] Customer replies "Yes!" → order is charged.
- [ ] Customer replies "yes," → order is charged.
- [ ] Customer replies "YES!!" → order is charged.
- [ ] Customer replies "no." → pending order cancelled.
- [ ] Customer replies "stop." → customer deactivated (Twilio opt-out — though Twilio handles bare STOP itself, belt-and-braces).
- [ ] Customer replies "yes please" → does **not** match YES keyword (only trailing punctuation stripped, not interior words). Falls through to quantity parser / unparseable handler as before.
- [ ] `rawBody` and `body` are unchanged for all downstream uses (concierge messages, quantity parsing, request content).
