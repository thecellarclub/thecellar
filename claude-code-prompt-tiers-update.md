# Spec: Tiers Update

## Context

The Cellar Club has three membership tiers: **Elvet** (base), **Bailey** (mid), and **Palatine** (top). Tiers are assigned automatically based on rolling 12-month spend, with upgrades firing in `lib/tiers.ts → checkAndApplyTierUpgrade()` after each charge.

Currently, thresholds in `lib/tiers.ts` are set to the old values (£501 / £1000). Customer records have `tier = 'none'` as their default, which needs correcting. There are no congratulations texts on upgrade.

**Key rule:** Customers do not enter Elvet on sign-up. They stay on `'none'` until they place their first order (any spend > £0). Elvet is earned, not given at registration.

---

## 1. Update tier thresholds

In `lib/tiers.ts`, update the constants:

```typescript
export const BAILEY_THRESHOLD = 100000   // £1,000 in pence
export const PALATINE_THRESHOLD = 250000 // £2,500 in pence
```

Remove `ELVET_THRESHOLD`. Update `tierFromSpend()`:

```typescript
export function tierFromSpend(spendPence: number): 'elvet' | 'bailey' | 'palatine' {
  if (spendPence >= PALATINE_THRESHOLD) return 'palatine'
  if (spendPence >= BAILEY_THRESHOLD) return 'bailey'
  return 'elvet'
}
```

Update `tierRank` in `checkAndApplyTierUpgrade()` to reflect the new hierarchy:

```typescript
const tierRank: Record<string, number> = { none: 0, elvet: 1, bailey: 2, palatine: 3 }
```

`'none'` means "signed up but not yet ordered." When a customer's first charge clears, `tierFromSpend()` will return `'elvet'` (assuming spend < £1,000), and `checkAndApplyTierUpgrade()` will upgrade them from `none` → `elvet`. This upgrade should also trigger the first-order congratulations SMS (see section 4).

---

## 2. Fix customer tier defaults in the database

**Do not** bulk-update `none` → `elvet`. Customers currently on `'none'` have genuinely not placed an order yet and should stay on `'none'` until they do.

Migration `039_fix_tier_defaults.sql` is still needed, but only to correct customers who have placed at least one confirmed order and are incorrectly on `'none'`:

```sql
-- Upgrade to elvet any customers with confirmed orders who are still on 'none'
update customers c
set tier = 'elvet',
    tier_since = now()
where c.tier = 'none'
  and exists (
    select 1 from orders o
    where o.customer_id = c.id
      and o.order_status = 'confirmed'
  );
```

Customers with no confirmed orders remain on `'none'`.

Also update any relevant TypeScript types — add `'none'` to the Tier union if it isn't there, to represent "not yet ordered." The full type is `'none' | 'elvet' | 'bailey' | 'palatine'`.

---

## 3. Tier benefits reference

The tiers and their benefits (for display/reference — no functional changes needed):

| Tier | From | Benefits |
|------|------|----------|
| Elvet | Base (< £1,000/year) | Keep as-is |
| Bailey | £1,000/year | Wine tasting tickets (previously had discount — remove any discount logic tied to Bailey) |
| Palatine | £2,500/year | Wine tasting tickets |

Check if there is any discount logic in the codebase tied to `'bailey'` tier and remove it.

---

## 4. Congratulations SMS on tier upgrade

Fetch the customer's `phone` alongside `tier` in the existing select in `checkAndApplyTierUpgrade()`:

```typescript
const { data: customer } = await sb
  .from('customers')
  .select('tier, phone')
  .eq('id', customerId)
  .maybeSingle()
```

After the DB update, send an SMS based on the new tier:

**none → elvet (first order):** Append to the existing order confirmation SMS — do not send a separate text. Find where the order confirmation SMS is constructed in `post-charge.ts` (or wherever the charge confirmation message is built) and prepend:

> "Congratulations on your first order! "

So the full message begins: "Congratulations on your first order! Your [wine name]..." (or however the existing confirmation reads — just prepend the phrase).

**none/elvet → bailey or elvet → palatine:** Send a separate SMS after the DB update:

```typescript
const tierDisplayName = qualifyingTier === 'bailey' ? 'Bailey' : 'Palatine'
const message = sanitiseGsm7(
  `Congratulations on reaching ${tierDisplayName} tier! Daniel will be in touch shortly to explain the benefits you get with it.`
)
await sendSms({ to: customer.phone, body: message })
```

All SMS should fire after the DB update succeeds, fire-and-forget (same pattern as other SMS in `post-charge.ts`).

---

## 5. Tier review / downgrade cron

The existing downgrade cron in `app/api/cron/case-nudges/route.ts` references the old thresholds. Update it to use the new `BAILEY_THRESHOLD` / `PALATINE_THRESHOLD` constants (remove `ELVET_THRESHOLD` import if present). Ensure the downgrade SMS it sends uses the correct display names.

---

## Files to change

- `lib/tiers.ts` — threshold constants, `tierFromSpend()`, `checkAndApplyTierUpgrade()` (add SMS)
- `supabase/migrations/039_fix_tier_defaults.sql` — one-time data fix
- `app/api/cron/case-nudges/route.ts` — update threshold references
- Any TypeScript type definitions that include `'none'` in the tier union
- Search for any discount logic tied to `'bailey'` and remove it
