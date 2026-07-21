# Spec: Remove the 90-day case deadline (no rush, no auto-charge)

## Goal

Customers should never feel rushed to fill a case. Remove the 90-day deadline and
everything that enforces it:

- **No deadline** in any customer message ("Complete your case of 12 **by 19th
  August**…" → no date, ever).
- **No auto-ship and no automatic charge.** The day-104 auto-ship that charges the
  tier fee is deleted outright. The only way a customer is ever charged for early
  shipping is the customer-initiated SHIP → SHIP CONFIRM flow, which stays as-is.
- **One gentle reminder instead of two nudges:** at 90 days of filling a case, a single
  no-pressure text with their bottle count and a link to the rewards page (`/club`).
- **Admins get the visibility instead:** slow-filling cellars are flagged in the daily
  inbox digest email, and the admin customers page gains a "days filling case" column —
  so the team can push people along manually (e.g. with the free-shipping-at-6 grant).

## Ordering & relationship to `claude-code-prompt-automated-message-fixes.md`

Implement the fixes spec **first** (or together in one pass). This spec **supersedes**
that spec's §5b (nudge-copy threshold fixes — the nudges it patches are replaced
wholesale here) and the nudge-timing checks in its §6. Everything else there still
applies — in particular the §1a bottle-count fix (sum quantities, never row counts),
which this spec's reminder, digest section, and column all depend on.

---

## 1. Database — migration `047_remove_case_deadline.sql`

```sql
alter table customers rename column case_nudge_1_sent_at to case_reminder_sent_at;
alter table customers drop column case_nudge_2_sent_at;

comment on column customers.case_started_at is
  'When the current (unshipped) case started filling. No longer a deadline — used only to anchor the single 90-day gentle reminder and admin "days filling case" visibility. Cleared when a shipment is created.';
comment on column customers.case_reminder_sent_at is
  'One-per-case gentle reminder marker (sent at ~90 days of filling). Cleared whenever the case timer resets.';
```

**Transition is silent** (per Julia): no announcement text, no data reset. Existing
`case_nudge_1_sent_at` values carry over into `case_reminder_sent_at` deliberately —
anyone who already received the old day-75 nudge for their current case has had their
one reminder and should NOT get another for the same case. The marker clears on their
next shipment as normal. Customers mid-"countdown" simply never hear about deadlines
again.

Update every code reference to the renamed/dropped columns (`lib/post-charge.ts`
resets, the cron, any types).

---

## 2. `lib/post-charge.ts` — drop deadline copy

`case_started_at` keeps its exact current mechanics (set on first bottle of a case,
cleared/reset when a shipment is created) — it's just no longer a deadline.

- **Scenario 1:** remove the deadline computation and the "by ${deadlineStr}" clause:

  > "Your cellar now holds ${totalBottles} bottles. Complete your case of ${threshold}
  > for free shipping - or reply SHIP any time to send what you have for £X."

  (Keep the first-order prefix fix and the tier-fee fix from the fixes spec. Draft copy
  — Julia will polish.)

- **Scenario 3:** remove the trailing deadline sentence. The remainder line becomes:

  > "You have ${remainingBottles} bottle(s) left in your cellar. Complete your next
  > case of ${threshold} for free shipping."

- Wherever these branches reset nudge columns, reset `case_reminder_sent_at` instead.

---

## 3. Cron rewrite — `app/api/cron/case-nudges/route.ts`

Keep the route path and vercel.json schedule (09:00 daily) to avoid config churn;
update the file's doc comment to describe the new behaviour. The cron now does:

1. **Expire stale `awaiting_confirmation` orders** — unchanged.
2. **Per active customer with `case_started_at` set:**
   - Compute `bottles` as a **quantity sum** (fixes spec §1a) of unreserved cellar rows.
   - `bottles === 0` → reset `case_started_at` / `case_reminder_sent_at` silently
     (unchanged behaviour, new column name).
   - `daysSinceCase >= 90` and `case_reminder_sent_at` is null → send the **single
     gentle reminder**, set `case_reminder_sent_at`. Fetch `free_shipping_at_6` and use
     `deliveryThreshold(tier, flag)` for the case size. Draft copy (Julia will polish):

     > "You have ${bottles} bottle${s} in your cellar - ${threshold − bottles} more and
     > your case ships free. No deadline, take your time. Every case counts towards
     > your member rewards: ${appUrl}/club"

     No fee mention, no SHIP instruction, no date. One per case, ever.
3. **Tier review (annual soft-demote)** — unchanged.

**Delete entirely:** nudge 2, and the whole day-104 auto-ship block (Stripe
`paymentIntents.create`, shipment creation, the "Your 90-day deadline has passed -
I've started shipping… and charged £X" SMS). Nothing in this cron may ever charge a
customer or create a shipment. If any of that code is shared, inline what the remaining
paths need — do not leave a dormant auto-charge path behind.

---

## 4. Admin visibility — the replacement for enforcement

### 4a. "Days filling case" column on `/admin/customers`

Per Julia: days since the **first bottle in the current cellar, counting unshipped
bottles only** — i.e. `now − min(cellar.added_at) where shipment_id is null`, per
customer. (Use the cellar rows, not `case_started_at`, so it matches what the admin
sees in the Cellar column next to it.)

- `app/admin/(protected)/customers/page.tsx` already aggregates unshipped totals into
  `totalsMap` — extend that same query/aggregation to also carry `min(added_at)`.
- `CustomersClientView.tsx`: add a column (header e.g. "Case days") between Cellar and
  Joined, showing whole days (blank/— when cellar is empty). Add a subtle highlight
  (e.g. amber text) at ≥ 120 days so slow fillers stand out at a glance.

### 4b. "Slow-filling cellars" section in the daily digest email

`app/api/cron/inbox-digest/route.ts`: add a section listing customers with unshipped
bottles > 0 and days-filling ≥ **120** (30 days after the gentle reminder), oldest
first, capped at the 10 oldest (note "…and N more" if capped):

```
SLOW-FILLING CELLARS
- Angela W. (+44…1234): 8 bottles, 131 days filling — consider a free-at-6 grant
```

Include the same section for every admin (these aren't assigned to anyone), count its
items toward the digest's `totalItems` / subject count, and keep the existing "skip
admins with nothing" behaviour working sensibly — an admin whose only items are slow
cellars should still get the email.

---

## 5. Out of scope / do NOT change

- **SHIP / SHIP CONFIRM** (customer-initiated paid early shipping) stays exactly as it
  is — customer-triggered, single explicit confirmation, per the standing rule that
  nothing is ever charged without the customer's own YES/CONFIRM.
- Tier annual review, milestones, credit — untouched.
- Public site copy: verified — no page (`/`, `/club`, portal dashboard) mentions the
  90-day deadline, so no frontend copy changes are needed. If you spot a stray mention
  anywhere else, remove it and note it in the implementation log.
- No announcement SMS to existing customers (Julia handles comms).

---

## Files to change

- `supabase/migrations/047_remove_case_deadline.sql` (new)
- `lib/post-charge.ts` — deadline copy out, renamed column
- `app/api/cron/case-nudges/route.ts` — single reminder; delete nudge 2 + auto-ship
- `app/api/cron/inbox-digest/route.ts` — slow-cellars section
- `app/admin/(protected)/customers/page.tsx` + `app/admin/_components/CustomersClientView.tsx` — case-days column
- Customer types wherever the nudge columns are typed

## Verification

- Order confirmation SMS (Scenarios 1 and 3) contain no date and no word "deadline".
- Customer at day 89: no reminder. Day 90: exactly one reminder with correct summed
  bottle count, correct threshold (6 for flagged/Palatine), and the /club link. Day 91+:
  nothing further, forever, until the case ships and a new one starts.
- Customer who received the old day-75 nudge before this deploys: gets NO further texts
  for the current case (marker carried over); after their case ships, the next case
  behaves like a fresh one.
- Day 104+, nudges long since sent: **no shipment created, no charge, no SMS.** Grep
  the cron for `paymentIntents` — zero matches.
- Digest email lists a customer with 8 unshipped bottles at 131 days; a customer at
  100 days is absent; counts appear in the subject line.
- `/admin/customers` shows correct whole-day "Case days" per customer, blank for empty
  cellars, highlighted at ≥ 120.
- `npx tsc --noEmit` and `npx next build` clean; no remaining references to
  `case_nudge_1_sent_at` / `case_nudge_2_sent_at`.
