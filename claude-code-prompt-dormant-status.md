# Spec: Dormant customer status

## Background

Customers currently have a boolean `active` field. `active = true` means they receive offers; `active = false` means they've opted out (deactivated). We need a third status — **dormant** — for customers who never engaged (never added a card) and should be paused from regular offer texts to save cost, but have not opted out and may be reactivated later.

## Status model

Replace the `active` boolean with a `status` text enum column on `customers`. Three valid values:

| Value | Meaning |
|-------|---------|
| `active` | Receives all offer texts normally |
| `dormant` | Excluded from regular offer broadcasts; may be texted manually for reactivation |
| `deactivated` | Opted out; excluded from all automated texts |

## Database migration

File: `supabase/migrations/038_customer_status.sql`

```sql
-- Add status column, default active
ALTER TABLE customers ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- Backfill: existing active=false → deactivated, active=true → active
UPDATE customers SET status = 'deactivated' WHERE active = false;
UPDATE customers SET status = 'active' WHERE active = true;

-- Add check constraint
ALTER TABLE customers ADD CONSTRAINT customers_status_check
  CHECK (status IN ('active', 'dormant', 'deactivated'));
```

Do NOT drop the `active` column yet — leave it in place for safety. The app should use `status` going forward.

## API changes

### `GET /api/admin/customers`
- Add `status` to the select fields (keep `active` for now)
- Return `status` in the response

### `PATCH /api/admin/customers/[id]`
- Accept `{ status: 'active' | 'dormant' | 'deactivated' }` in the request body
- When `status === 'deactivated'`, also set `unsubscribed_at = now()` (existing behaviour)
- When `status === 'active'` or `status === 'dormant'`, clear `unsubscribed_at` (set to null) if it was previously set
- Keep the `{ active: boolean }` path working for backwards compatibility but have it map to `status`: `active: true → status = 'active'`, `active: false → status = 'deactivated'`

### `GET /api/admin/customers/[id]`
- No change needed (already returns `*`)

### `/api/admin/broadcast`

The broadcast endpoint and page gain a third audience segment — dormant customers. The current two checkboxes (with card / without card) become three:

**API (`app/api/admin/broadcast/route.ts`)**

Accept three new boolean flags in the request body:
- `includeActive` (default `true`) — status = `active`
- `includeDormant` (default `false`) — status = `dormant`
- `includeWithCard` / `includeWithoutCard` — these continue to sub-filter within the included statuses (card vs no card)

Query logic:
1. Build the status filter: fetch customers whose `status` is in the set of included statuses (e.g. `IN ('active', 'dormant')`)
2. Then apply the with/without card sub-filter as before — customers without a card still get the add-card link appended regardless of whether they're active or dormant

Validation: at least one status must be included, and at least one card group must be included.

Error if nothing selected: `'Select at least one audience group'` (unchanged message is fine).

**Page (`app/admin/(protected)/broadcast/page.tsx`)**

The page currently queries `active = true` to compute `withCard` and `withoutCard` counts. Change to query all three statuses separately and pass them all to `BroadcastForm`:

```ts
// fetch counts per status × card
const { data: customers } = await sb
  .from('customers')
  .select('status, stripe_payment_method_id')
  .in('status', ['active', 'dormant'])

// derive counts
const activeWithCard = ...
const activeWithoutCard = ...
const dormantWithCard = ...
const dormantWithoutCard = ...
```

Pass all four counts as props to `BroadcastForm`.

**`BroadcastForm.tsx`**

Add a new `includeActive` checkbox (default checked) and `includeDormant` checkbox (default unchecked) alongside the existing with/without card checkboxes. The audience section should make clear the two axes:

- Status group: Active (N) / Dormant (N)
- Card filter: With card — plain message / Without card — message + add-card link appended

The "Sending to X members" count should reflect all four combinations. For example if both active and dormant are checked, and both card groups are checked, it's all four buckets combined.

The preview section should show:
- "Preview — with card" (if with-card is checked)
- "Preview — without card" (if without-card is checked and at least one status group has cardless members)

No change to the preview content itself.

Update the `Props` interface to accept `activeWithCard`, `activeWithoutCard`, `dormantWithCard`, `dormantWithoutCard` counts. Remove the old `withCard` / `withoutCard` props.

Send `{ body, includeActive, includeDormant, includeWithCard, includeWithoutCard }` to the API.

### `/api/admin/customers/[id]/send-offer`
- Change the `customer.active` check to `customer.status === 'active'`
- Error message: `'Customer is not active'` → unchanged

### `/api/cron/welcome-and-card-prompt`
- Change `.eq('active', true)` to `.eq('status', 'active')`

### `/api/cron/case-nudges`, `/api/cron/payment-retry`
- Review for any `active` filters and update to `.eq('status', 'active')` if present

## UI changes

### Customer list (`CustomersClientView.tsx`)

**Status filter dropdown** — update options:
- All statuses (no filter)
- Active
- Dormant
- Deactivated

**Filter logic** — update `statusFilter` comparisons to match against `c.status` (string) instead of `c.active` (boolean):
- `statusFilter === 'active'` → `c.status === 'active'`
- `statusFilter === 'dormant'` → `c.status === 'dormant'`
- `statusFilter === 'deactivated'` → `c.status === 'deactivated'`

**Status badge colours:**
- `active` → green (existing)
- `dormant` → amber: `bg-amber-100 text-amber-700`
- `deactivated` → grey (existing, currently shown for `!active`)

**Customer type** — add `status: string` field (keep `active: boolean` if it's still returned by the API, but use `status` for display and filtering)

### Customer detail page (`/admin/customers/[id]`)

Update `DeactivateButton.tsx` — replace the current two-state toggle (Deactivate / Reactivate) with a three-state status control:

Rename the component to `CustomerStatusControl` (or update in place — either is fine).

The control should be a dropdown or set of buttons offering all three statuses. The current customer's status is shown as selected/active. Confirmation prompt rules:

- Switching to `deactivated` → confirm: "Deactivate this customer? They will be marked as unsubscribed."
- Switching to `dormant` → no confirmation needed
- Switching to `active` → no confirmation needed

On change, `PATCH /api/admin/customers/[id]` with `{ status: '<new status>' }`.

The component receives `customerId: string` and `status: 'active' | 'dormant' | 'deactivated'` as props. Update the customer detail page to pass `status` (not `active`).

## What does NOT change

- The `deactivated` flow is semantically identical to the current `active = false` path — users who have opted out remain deactivated
- Dormant customers can still receive manually-sent individual offer texts via the admin "Send offer" form on their profile page (the `send-offer` API already requires admin session; the only guard is `status === 'active'` which blocks it — **dormant customers should also be blockable from manual offers by this check**). If the team wants to send a reactivation text to a dormant customer they can reactivate them first, or use the inbox compose directly.
- No changes to cron schedules, Twilio config, or any other systems

## CLAUDE.md update

After implementing, update the `customers` table row in CLAUDE.md to note `status` field: `'active' | 'dormant' | 'deactivated'` and remove the `active` boolean reference from that row.
