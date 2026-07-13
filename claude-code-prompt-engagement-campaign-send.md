# Spec: Send the three engagement campaigns via Twilio

## Goal

Send three one-off, personalised SMS campaigns to specific customer segments, through
the existing `sendSms()` path in `lib/twilio.ts` so every message is logged in
`sms_messages` / concierge history exactly like any other outbound text. This is a
**one-time operational send**, not a permanent feature — implement it as a script under
`scripts/` that can be run once, with a dry-run mode and safety guards.

The audiences and the free-shipping flag have already been set in the database (see
below). Do NOT recompute segments from scratch in a way that could drift — use the exact
membership rules given here so the send matches what was reviewed.

## Pre-state already done (do not redo)

- `customers.free_shipping_at_6` has already been set to `true` for the 11 Segment-2
  recipients (customers with ≥1 confirmed order and < 4 unshipped cellar bottles). You
  do not need to set the flag; just send their message.

## Segment definitions (use these EXACT rules)

All segments exclude anyone where `unsubscribed_at IS NOT NULL` or `status = 'deactivated'`.

- **Segment 1 — card saved, no order** (~56):
  `stripe_payment_method_id IS NOT NULL`
  AND no confirmed orders (`NOT EXISTS order with order_status='confirmed'`).

- **Segment 2 — first order(s), under 4 bottles** (~11):
  has ≥1 confirmed order
  AND `coalesce(sum(cellar.quantity),0) < 4`.
  (These are exactly the customers currently flagged `free_shipping_at_6 = true` — you
  may simply target `free_shipping_at_6 = true` for this segment, which is the safest
  match.)

- **Segment 3 — no card, no order** (~117, of which ~12 have no first name):
  `stripe_payment_method_id IS NULL`
  AND no confirmed orders.

## Message templates

Personalise with the customer's `first_name`. Use a sanitised first name (trimmed; if
it is stored ALL-CAPS, convert to title case). Apply GSM-7 sanitisation via the existing
`sanitiseGsm7()` helper.

**Segment 1:**
> Hello {first_name} - I saw you saved your card but not ordered yet. What do you normally like to drink? Can I find you something to get you started?

**Segment 2:**
> Hello {first_name} - so great to see you made your first orders. As a little thank you, I've dropped your free shipping to 6 bottles (instead of 12) for this first shipment! What would you like to see more of?

**Segment 3 (has first name):**
> Hello {first_name} - you signed up a little while back but haven't ordered yet, and I'd love to know why. Was it the wines, the prices, the way it works over text, or just timing? Totally honest answers welcome - we just started.

**Segment 3 (NO first name — first_name is null/blank):** send this greeting-less
variant (do NOT send "Hello  -"):
> You signed up a little while back but haven't ordered yet, and I'd love to know why. Was it the wines, the prices, the way it works over text, or just timing? Totally honest answers welcome - we just started.

## Implementation

Create `scripts/send-engagement-campaign.ts`:

1. Accepts a `--segment=1|2|3` arg (send one segment at a time — do NOT send all 184 in
   one go) and a `--dry-run` flag.
2. Queries the segment using the exact rules above via the service-role Supabase client
   (`createServiceClient()`).
3. For each recipient, builds the personalised, `sanitiseGsm7()`-cleaned body.
4. **Dry-run (default if `--live` not passed):** prints `phone | first_name | body` for
   every recipient and a total count. Sends nothing. Run this first for each segment and
   eyeball the output.
5. **Live send (`--live`):** calls the existing `sendSms(phone, body, { trigger:
   'engagement-campaign:seg<N>', customerId })` so messages are logged and attributed
   the same as all other outbound SMS.
6. **Throttle:** sleep ~500ms–1s between sends to stay within Twilio rate limits and
   avoid carrier spam flags.
7. **Idempotency guard:** to avoid double-sending if the script is re-run, before sending
   to a customer check there is no existing outbound `sms_messages` row for them with
   `trigger = 'engagement-campaign:seg<N>'`; skip anyone who already has one. Log skips.
8. Print a final summary: attempted, sent, skipped, failed (with phone + error for
   failures). Wrap each send in try/catch so one failure doesn't abort the batch.

## Safety checklist (important)

- Re-exclude `unsubscribed_at IS NOT NULL` and `status = 'deactivated'` at query time —
  never rely solely on a prebuilt list.
- Send **one segment at a time**, dry-run first, and confirm the count matches
  (~56 / ~11 / ~117) before going live.
- These invite free-text replies that the SMS parser will treat as `unparseable`. Make
  sure the team is watching the concierge inbox when Segment 1 and 2 go out, since those
  replies need a human. (Operational note, not code.)
- Suggested timing: Tue–Thu early evening (~19:00), the peak engagement window in the
  order data.

## Files

- `scripts/send-engagement-campaign.ts` (new)
- Reuses `lib/twilio.ts` (`sendSms`, `sanitiseGsm7`) and `lib/supabase.ts`
  (`createServiceClient`) — no changes to those.

## Verification

- `--segment=1 --dry-run` prints ~56 rows, correct names merged, no "Hello  -" blanks.
- `--segment=3 --dry-run` shows the ~12 no-name recipients using the greeting-less
  variant.
- A live send to one segment logs one outbound `sms_messages` row per recipient with the
  `engagement-campaign:seg<N>` trigger; re-running the same segment skips everyone
  (idempotency works).
