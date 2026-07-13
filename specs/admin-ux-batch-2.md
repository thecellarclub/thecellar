# Spec: Admin UX — Batch 2

Six discrete improvements to the admin panel. Each is described independently so they can be implemented in any order. There are no dependencies between them.

---

## 1. Ordinal date formatting everywhere

### Problem

Dates rendered via `formatDate` and `formatDateTime` in `lib/format.ts` currently produce e.g. "2 August 2026". Correct British English uses ordinals: "2nd August 2026", "3rd August 2026", "22nd August 2026".

### Scope

All call sites of `formatDate` and `formatDateTime` across the app. This is a utility-level change — fix the functions once, everything inherits it.

### Implementation

**`lib/format.ts`** — add an ordinal helper and use it in both functions:

```ts
function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}
```

`toLocaleDateString` doesn't natively support ordinal day numbers, so format the parts manually:

```ts
export function formatDate(iso: string): string {
  const d = new Date(iso)
  const day = ordinal(d.getDate())
  const month = d.toLocaleDateString('en-GB', { month: 'long' })
  const year = d.getFullYear()
  return `${day} ${month} ${year}`
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  const day = ordinal(d.getDate())
  const month = d.toLocaleDateString('en-GB', { month: 'short' })
  const year = d.getFullYear()
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  return `${day} ${month} ${year}, ${time}`
}
```

Output examples:
- `formatDate` → "2nd August 2026", "3rd March 2026", "22nd January 2025"
- `formatDateTime` → "2nd Aug 2026, 14:30"

### Files to change

- `lib/format.ts` — only file that needs touching.

---

## 2. Collect in person — cellar dispatch option

### Problem

Some customers have requested to collect their wine from the bar rather than have it shipped. There's currently no way to record this in the admin panel. When a customer collects, the bottles should move out of the "Current Cellar" section (same as a shipment), appear in the "Shipped" history with a clear "Collected in person" label, and have a proper `shipments` record for audit purposes.

### Design

A new action on the customer detail page (`/admin/customers/[id]`). The flow:

1. Admin ticks one or more cellar entry rows in the "Current Cellar" table.
2. Clicks **"Mark as collected in person"** button.
3. Confirmation dialog shows which entries are selected and total bottle count.
4. On confirm: a new `shipments` row is created with `type = 'collection'`, and the selected `cellar` rows are updated to link to it and marked as shipped.
5. The customer detail page refreshes. The entries disappear from "Current Cellar" and appear in "Shipped" under a new shipment row labelled **"Collected in person"**.

### Schema change — migration `023_collection_shipment_type.sql`

Add a `type` column to `shipments`:

```sql
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'delivery';
```

Existing rows are already delivery shipments, so the default is correct. No backfill needed.

### New API route: `POST /api/admin/customers/[id]/collect`

**Auth:** NextAuth admin session.

**Request body:**
```ts
{ cellarIds: string[] }  // UUIDs of cellar rows to mark as collected
```

**Logic:**

1. Validate: `cellarIds` is a non-empty array of valid UUIDs.
2. Fetch all cellar rows matching these IDs for this customer. Reject if any are not found, don't belong to this customer, or are already shipped (`shipped_at IS NOT NULL`).
3. Sum `quantity` across selected rows to get `bottle_count`.
4. Insert a new `shipments` row:
   ```ts
   {
     customer_id: customerId,
     status: 'delivered',          // already fulfilled — no dispatch step needed
     type: 'collection',
     bottle_count: totalBottles,
     shipping_address: null,        // no address for collection
     shipping_fee_pence: 0,
     dispatched_at: now,            // treat collection moment as dispatch
     delivered_at: now,
   }
   ```
5. Update all selected `cellar` rows:
   ```ts
   { shipment_id: newShipmentId, shipped_at: now }
   ```
6. Return `{ ok: true, shipmentId }`.

All DB writes should be in the same logical block. If the shipment insert fails, do not update cellar rows. If the cellar update fails, return an error (the shipment row will be orphaned but harmless — the next page load won't show it as it has no linked cellar rows).

### UI changes — `app/admin/(protected)/customers/[id]/page.tsx`

This is a server component. Convert the "Current Cellar" section to a client component `CollectCellarForm` to support checkboxes and button state.

**`CollectCellarForm` props:**
```ts
{
  customerId: string
  entries: CellarEntry[]   // unshipped cellar entries
}
```

**Behaviour:**

- Each row in the cellar table gains a checkbox in a new leftmost column.
- A "Mark as collected in person" button appears below the table. It is disabled until at least one row is checked.
- On click, show a confirmation: "Mark [n] bottles as collected in person? This cannot be undone."
- On confirm, `POST /api/admin/customers/[id]/collect` with `{ cellarIds: [...selectedIds] }`.
- On success: `router.refresh()`.
- On error: show the error message inline.

**Shipped section** — update the shipment card rendering to show "Collected in person" instead of the status badge when `shipment.type === 'collection'`. The status badge for `delivered` (green) is still shown but preceded by a "Collected in person" label. No tracking number fields shown for collection shipments.

The global shipments list at `/admin/shipments` should also render a "Collected in person" label in the Status column for `type = 'collection'` rows. The Address column shows "—" (no address).

### Files to change

- `supabase/migrations/023_collection_shipment_type.sql` — new migration
- `app/api/admin/customers/[id]/collect/route.ts` — new API route
- `app/admin/(protected)/customers/[id]/page.tsx` — wire in `CollectCellarForm`, update shipped section rendering
- `app/admin/_components/CollectCellarForm.tsx` — new client component
- `app/admin/(protected)/shipments/page.tsx` — show "Collected in person" label

---

## 3. Orders page — all orders across all customers

### Problem

The admin dashboard shows only the 10 most recent orders. There is no way to see a full chronological feed of all orders (individual payments), e.g. to watch orders come in after an offer blast, or to search/audit orders without going via a specific customer.

### Design

A new top-level admin page at `/admin/orders`. Link it from the admin nav between "Dashboard" and "Customers".

**Page: `app/admin/(protected)/orders/page.tsx`**

Server component. Fetches all orders from newest to oldest. Supports URL-based search and status filter (see section 4 below for the shared search/filter pattern).

Query:
```ts
sb.from('orders')
  .select('id, quantity, price_pence, total_pence, stripe_charge_status, order_status, created_at, wine_id, customer_id, wines(name), customers(first_name, phone)')
  .order('created_at', { ascending: false })
  .limit(200)   // pragmatic cap — extend with pagination later if needed
```

**Columns:** Date / Customer / Wine / Qty / Amount / Status

- Date: `formatDateTime(o.created_at)` (ordinal, from fix in section 1)
- Customer: `first_name` with phone in small grey text — not a link (this page is order-centric, not customer-centric)
- Wine: `wine.name`
- Qty: `o.quantity`
- Amount: `penceToGbp(o.total_pence)`
- Status: a `StatusBadge` combining `stripe_charge_status` (same badge component as existing pages). Show `order_status` as secondary text only if it's `awaiting_confirmation` or `expired` (these are interesting states not captured by `stripe_charge_status`).

**Stat strip at the top** (same card style as dashboard):
- Total orders shown (count of loaded rows)
- Total revenue (sum of `total_pence` where `stripe_charge_status = 'succeeded'`)

**Nav change:** Add `{ href: '/admin/orders', label: 'Orders', exact: false }` to `AdminNav` links array, between Dashboard and Customers. Also add to `MobileAdminNav`.

### Files to change

- `app/admin/(protected)/orders/page.tsx` — new page
- `app/admin/_components/AdminNav.tsx` — add Orders link
- `app/admin/_components/MobileAdminNav.tsx` — add Orders link

---

## 4. Search and filters on Orders and Customers pages

Both pages need client-side search/filter. Use URL search params as state (so filters survive refresh and can be bookmarked).

### Pattern — shared approach

Both pages become hybrid: the server component fetches all data, passes it to a client component that handles filtering in-browser. For current data volumes (hundreds of customers, hundreds of orders) this is simpler and faster than server-side search with re-fetches.

The filter bar sits above the table in each page and contains:
- A text search input (debounced, 200ms)
- One or more filter dropdowns appropriate to the page

Use `useSearchParams` + `useRouter` (or a `nuqs`-free equivalent) to persist filter state in the URL. Alternatively, keep filter state in `useState` — either is fine. Prefer `useState` for simplicity unless URL persistence is easy.

---

### 4a. Customers page search/filter

**`app/admin/_components/CustomersClientView.tsx`** — new client component that receives the full customers array and renders the filter bar + table.

**Filter bar:**
- **Search box** — placeholder "Search name, phone, email…". Filters on `first_name`, `phone`, `email` (case-insensitive substring match).
- **Status filter** — dropdown: All / Active / Inactive. Default: All.
- **Tier filter** — dropdown: All / Bailey / Explorer / Connoisseur (or whatever the tier values are). Default: All.

The count in the page header should update to show filtered count vs total: "Customers (12 / 47)".

**`app/admin/(protected)/customers/page.tsx`** — currently a pure server component. Minimal change: add `first_name, active, tier` to the existing select (tier may already be there — check) and render `<CustomersClientView customers={customers} totalsMap={totalsMap} />`.

The server component currently selects `id, first_name, phone, email, active, subscribed_at` — also add `tier` for the tier filter.

---

### 4b. Orders page search/filter (also applies to the new Orders page from section 3)

The orders page fetches all orders and renders `<OrdersClientView orders={orders} />`.

**Filter bar:**
- **Search box** — placeholder "Search wine, customer…". Filters on `wine.name`, `customer.first_name`, `customer.phone`.
- **Status filter** — dropdown: All / Succeeded / Failed / Pending / Requires action / Awaiting confirmation / Expired. Default: All.
- **Date range** — two date inputs (From / To). Optional. Filters `created_at`.

The page title should reflect the filtered state: "Orders (15 / 200)".

---

## 5. Remove "Daniel here" from manual offer SMS

### Problem

The `SendOfferForm` component and the send-offer API route include "Daniel here — " at the start of the manual offer SMS. Julia wants this removed — the messages should not reference Daniel by name in the admin-sent (manual) offer flow.

### Scope

The "Daniel here" prefix appears in two places that are part of the same manual offer feature (likely in a worktree branch, pending merge — check both locations and fix both):

1. `app/admin/_components/SendOfferForm.tsx` — the `buildPreview` function that renders the SMS preview in the admin UI.
2. `app/api/admin/customers/[id]/send-offer/route.ts` — the actual SMS body sent via Twilio.

Also check `app/api/webhooks/twilio/inbound/route.ts` for any similar greeting in the outbound offer-related SMS paths (e.g. `handlePendingOrder`).

### Change

**Before:**
```
Daniel here — I've set aside 2 x Barolo 2019 for you (£36.00). Reply YES to confirm.
```

**After:**
```
I've set aside 2 x Barolo 2019 for you (£36.00). Reply YES to confirm.
```

Apply the same trim to the no-card variant:

**Before:**
```
Daniel here — I've set aside 2 x Barolo 2019 for you (£36.00). Add your card at thecellar.club/b/aBcDeFgH then reply YES to confirm.
```

**After:**
```
I've set aside 2 x Barolo 2019 for you (£36.00). Add your card at thecellar.club/b/aBcDeFgH then reply YES to confirm.
```

Also update the spec `specs/admin-manual-offer.md` SMS format examples to match.

### Files to change

- `app/admin/_components/SendOfferForm.tsx` — `buildPreview` function
- `app/api/admin/customers/[id]/send-offer/route.ts` — `smsBody` string construction
- `specs/admin-manual-offer.md` — update SMS format examples (cosmetic, not functional)

---

## 6. Remove "Manually add bottles" section from customer detail page

### Problem

The "Manually add bottles" section in the Current Cellar card of `/admin/customers/[id]` is misleading — we would never add bottles to a customer's cellar outside of the payment flow (broadcast or manual offer). The section adds confusion and risk.

### Change

Remove the "Manually add bottles" sub-section from the Current Cellar card entirely. This means:

1. Delete the `<div className="border-t border-gray-200">` block containing the "Manually add bottles" heading and `<AddBottlesForm />` from `app/admin/(protected)/customers/[id]/page.tsx`.
2. Remove the `AddBottlesForm` import from the same file.
3. Remove the `activeWines` query from the page data fetches **only if** it is no longer used elsewhere on the page. Check: `activeWines` is also passed to `SendOfferForm` lower on the page. If `SendOfferForm` still uses it, keep the query as-is.

Do **not** delete `app/admin/_components/AddBottlesForm.tsx` or its API route — they may be useful for internal tooling. Simply remove them from the customer-facing admin page.

### Files to change

- `app/admin/(protected)/customers/[id]/page.tsx` — remove the "Manually add bottles" block and the `AddBottlesForm` import.

---

## Summary table

| # | What | Primary files |
|---|---|---|
| 1 | Ordinal dates ("2nd August") | `lib/format.ts` |
| 2 | Collect in person | `023_collection_shipment_type.sql`, `api/admin/customers/[id]/collect/route.ts`, `CollectCellarForm.tsx`, customer `[id]/page.tsx`, `shipments/page.tsx` |
| 3 | Orders page (all payments) | `admin/(protected)/orders/page.tsx`, `AdminNav.tsx`, `MobileAdminNav.tsx` |
| 4 | Search/filter on Orders + Customers | `CustomersClientView.tsx`, `OrdersClientView.tsx`, customers `page.tsx`, orders `page.tsx` |
| 5 | Remove "Daniel here" from manual offer SMS | `SendOfferForm.tsx`, `send-offer/route.ts` |
| 6 | Remove "Manually add bottles" section | customer `[id]/page.tsx` |
