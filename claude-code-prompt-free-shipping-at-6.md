# Spec: One-shot free shipping at 6 bottles (per-customer flag)

## Goal

Give the admin team a way to grant an individual customer **free shipping once they
reach 6 bottles** instead of the usual 12 — as a targeted nudge for slow-filling
members. The grant is **single-use**: as soon as it triggers a shipment, it is
automatically turned off, so the customer reverts to the standard 12-bottle case. To
give them the benefit again, an admin must set the flag again.

This is intentionally small and self-contained. It does **not** touch tiers, rebates,
or any other benefit. It reuses the existing case-completion flow exactly — same
shipment creation, same messaging — just with a threshold of 6 for that one case.

---

## How the current flow works (context for the implementer)

Free-shipping / case-completion logic lives in `lib/post-charge.ts`, driven by a single
`threshold` value that today comes from `deliveryThreshold(tier)` in `lib/tiers.ts`:

```typescript
// lib/tiers.ts (current)
export function deliveryThreshold(tier: string): number {
  return tier === 'palatine' ? 6 : 12
}
```

`post-charge.ts` fetches the customer, computes `threshold`, sums unreserved cellar
bottles, and branches:
- `totalBottles < threshold` → Scenario 1: start/maintain case timer, "complete your
  case" SMS.
- `totalBottles === threshold` → Scenario 2: **case complete** — create the pending
  shipment, reset the case timer, send the "your case is ready" SMS.
- `totalBottles > threshold` → Scenario 3: split off the oldest `threshold` bottles into
  a shipment, keep the remainder, restart the timer.

Because everything already flows through one `threshold` variable, the cleanest
implementation is to make `deliveryThreshold` aware of the per-customer flag, then
consume (clear) the flag at the moment a shipment is actually created.

---

## 1. Database

Migration `042_free_shipping_at_6_flag.sql`:

```sql
alter table customers
  add column free_shipping_at_6 boolean not null default false;

comment on column customers.free_shipping_at_6 is
  'One-shot grant: when true, this customer gets free shipping (case complete) at 6 bottles instead of 12. Automatically reset to false the moment it triggers a shipment. Admin must re-enable for another use.';
```

No backfill needed (defaults to `false` for everyone).

---

## 2. Threshold logic

Update `deliveryThreshold` in `lib/tiers.ts` to accept the flag. Keep it a pure
function; do not do DB work inside it.

```typescript
/**
 * The number of bottles a customer needs to trigger free shipping.
 * - Palatine members get 6 (existing behaviour).
 * - Any customer with a one-shot free_shipping_at_6 grant gets 6.
 * - Everyone else gets 12.
 */
export function deliveryThreshold(
  tier: string,
  freeShippingAt6 = false
): number {
  if (tier === 'palatine' || freeShippingAt6) return 6
  return 12
}
```

> Note: if a Palatine customer somehow also has the flag set, behaviour is unchanged
> (still 6); the flag should still be consumed on use per section 3 so it doesn't linger.
> This is an edge case — fine to consume it regardless.

---

## 3. Consume the flag on use (the core requirement)

In `lib/post-charge.ts`:

1. When fetching the customer, also select the flag:
   ```typescript
   const { data: customerData } = await sb
     .from('customers')
     .select('tier, free_shipping_at_6')
     .eq('id', customerId)
     .maybeSingle()

   const currentTier = customerData?.tier ?? 'none'
   const freeShippingAt6 = customerData?.free_shipping_at_6 ?? false
   ```

2. Compute the threshold with the flag:
   ```typescript
   const threshold = deliveryThreshold(currentTier, freeShippingAt6)
   ```

3. **Consume the flag only when a shipment is actually created** — i.e. in Scenario 2
   (`totalBottles === threshold`) and Scenario 3 (`totalBottles > threshold`), NOT in
   Scenario 1 (still under threshold — the grant must persist until they actually reach
   6). Reset it as part of the same DB update that already happens when the case
   completes, so it's atomic with shipment creation:

   ```typescript
   // In the case-complete / split branches, where the customer row is already
   // being updated (e.g. resetting case_started_at), also clear the flag —
   // but ONLY if it was the thing that lowered the threshold. Guard on the flag
   // having been true so we don't write unnecessarily:
   const consumeFlag = freeShippingAt6  // it was set going into this charge
   await sb.from('customers').update({
     case_started_at: null,
     ...(consumeFlag ? { free_shipping_at_6: false } : {}),
   }).eq('id', customerId)
   ```

   Adapt to match the existing update call(s) in each branch — the key behaviour is:
   **the flag flips back to `false` in the same operation that creates the shipment**,
   and it does **not** flip in Scenario 1.

### Important: only consume it when it actually mattered?

Keep it simple: **consume whenever a shipment is created while the flag was true.** Do
not try to detect "would 12 also have shipped" — if the flag was set and a shipment
went out, the grant is spent. (In practice the admin sets this for people stuck well
under 12, so at 6 bottles the flag is exactly what triggered the ship.)

---

## 4. Messaging

The existing case-complete SMS in Scenario 2 says "Your case of 12 is ready!" — with a
6-bottle threshold that wording is wrong for these customers. Make the completion
message use the actual `threshold`:

- Scenario 2 "case ready" SMS: replace the hardcoded `12` with `${threshold}` so it
  reads "Your case of 6 is ready!" for a flagged customer.
- Scenario 1 "complete your case" SMS (line ~99) also hardcodes 12. For a flagged
  customer still under 6, it should say "Complete your case of ${threshold}…". Use the
  computed `threshold` there too.

Leave the £10 "ship what you have" wording as-is (that's the pay-to-ship-early path and
unrelated to this grant).

---

## 5. Admin control

In the admin customer view (the inbox right-hand customer panel and/or the customer
detail page — wherever per-customer settings are edited), add a simple toggle:

- **Label:** "Free shipping at 6 bottles (one-time)"
- **State:** reflects `customers.free_shipping_at_6`.
- **On enable:** set the flag `true`.
- **On disable:** set it `false` (lets admin cancel a grant they set by mistake).
- Show a hint that it auto-clears after the next shipment.

Log the change to `inbox_activity` so there's an audit trail:
- `action = 'free_shipping_at_6_set'` when enabled,
- `action = 'free_shipping_at_6_cleared'` when disabled or auto-consumed.
  (For the auto-consume in section 3, write an `inbox_activity` row with a system/actor
  id or null actor, detail e.g. "auto-cleared on shipment creation".)

An admin API route under `app/api/admin/` that calls `requireAdminSession()` and
updates the single boolean is sufficient.

---

## 6. Out of scope / do NOT change

- **Do not** change the default 12-bottle behaviour for anyone without the flag.
- **Do not** change Palatine's existing 6-bottle behaviour.
- **Do not** wire this into bulk campaigns yet — per-customer toggle only. (A bulk
  "set for these customer IDs" action can be a fast follow; not part of this spec.)

---

## 7. Known hardcoded `12`s to be aware of (flag them, don't silently change)

The manual **SHIP** path in `app/api/webhooks/twilio/inbound/route.ts` has hardcoded
12s that this flow does **not** run through:

- line ~201: `const bottlesToShip = Math.floor(total / 12) * 12`
- line ~287: `if (total >= 12) { … }`

These govern the customer-initiated "reply SHIP" flow, which is a different path
(pay-£10-to-ship-early / manual ship). This spec's one-shot free-at-6 grant is about the
**automatic case-completion** path in `post-charge.ts`, so these do not need to change
for the feature to work. **Flag to the reviewer:** if a flagged customer replies SHIP at
exactly 6 bottles expecting free shipping, that path won't honour the grant. Decide
separately whether that edge case matters; for v1 the grant is honoured via the
automatic accumulation flow only. Note this behaviour in the implementation log.

---

## Files to change

- `supabase/migrations/042_free_shipping_at_6_flag.sql` (new) — add boolean column
- `lib/tiers.ts` — `deliveryThreshold(tier, freeShippingAt6)`
- `lib/post-charge.ts` — select flag, pass to `deliveryThreshold`, consume flag on
  shipment creation (Scenarios 2 & 3), use `${threshold}` in the two SMS strings
- Admin customer panel UI — the toggle
- `app/api/admin/…` — route to set/clear the flag + `inbox_activity` logging
- TypeScript customer types — add `free_shipping_at_6: boolean`

## Verification

- Set flag on a test customer; add bottles to 5 → still "complete your case of 6" SMS,
  flag stays `true`, no shipment.
- Add 1 more to hit 6 → shipment created exactly like the 12-bottle flow, "case of 6 is
  ready" SMS sent, and `free_shipping_at_6` is now `false`.
- Same customer, add 6 more bottles → this time it does NOT ship at 6 (flag consumed);
  normal 12-bottle behaviour resumes.
- A customer without the flag is unaffected at 6 bottles.
- Palatine customer still ships at 6 as before.
- `inbox_activity` shows set + auto-cleared entries.
