# Claude Code Prompt — Collection Workflow

The existing "Mark as collected in person" feature on the customer page instantly creates a shipment marked as delivered. There's no scheduling, no visibility of upcoming collections, and no way to prepare for them. This spec turns it into a proper workflow: admin selects bottles, picks a collection date/time and venue, a shipment is created in a `collection_pending` state, it appears on the shipments page with the collection details, and it gets closed out when the customer actually picks up.

Four areas. Do them in order.

---

## 1. Migration

### A — `034_collection_workflow.sql`

```sql
ALTER TABLE shipments
  ADD COLUMN IF NOT EXISTS collection_venue text,
  ADD COLUMN IF NOT EXISTS collection_date date,
  ADD COLUMN IF NOT EXISTS collection_time time;
```

`collection_venue` stores the venue name (e.g. `'crush'` or `'norse'`). `collection_date` and `collection_time` store when the customer plans to collect. These columns are nullable — they're only populated for `type = 'collection'` shipments.

Check `supabase/migrations/` before creating — if anything has been added since this spec was written, number accordingly.

---

## 2. Update the collection form on the customer page

The current `CollectCellarForm` component (`app/admin/_components/CollectCellarForm.tsx`) has the right starting point: a table of unshipped cellar entries with checkboxes and a "Mark as collected in person" button. Keep all of that, but change what happens after the button click.

### A — Replace the confirmation step with a scheduling form

Currently, clicking the button shows a simple "confirm?" prompt and immediately creates the shipment. Change this:

1. Admin selects bottles via checkboxes (no change).
2. Admin clicks "Mark as collected in person" (rename this button to **"Schedule collection"**).
3. Instead of the confirm/cancel prompt, show an inline scheduling form with:

   - **Venue** — two buttons, toggle-style (only one selected at a time): **Crush** and **Norse**. Default: neither selected (must pick one). Style as pill buttons — selected one is `bg-gray-900 text-white`, unselected is `border border-gray-300 text-gray-700`.

   - **Date** — `<input type="date">`. Default: empty. Required. Minimum value: today.

   - **Time** — `<input type="time">`. Default: empty. Optional (some customers may not have a specific time). Step: 15 minutes.

   - **Confirm / Cancel buttons** — "Confirm" is disabled until venue and date are filled in. Show the bottle count in the confirm button: "Confirm — 3 bottles from Crush, Thu 15 May".

4. On confirm, POST to the updated API (see section 2B).

### B — Update the collect API route

`app/api/admin/customers/[id]/collect/route.ts` — change the request body and shipment creation:

**New request body:**
```ts
{
  cellarIds: string[]
  venue: 'crush' | 'norse'
  date: string       // ISO date, e.g. '2026-05-15'
  time: string | null // e.g. '14:30' or null
}
```

**Validation:**
- `venue` must be `'crush'` or `'norse'`.
- `date` must be a valid date string, today or later.
- `time` is optional.
- `cellarIds` validation stays the same.

**Shipment creation — change these fields:**
```ts
{
  customer_id: customerId,
  status: 'pending',           // was: 'delivered' — now starts as pending
  type: 'collection',
  bottle_count: bottleCount,
  shipping_address: null,
  shipping_fee_pence: 0,
  collection_venue: venue,     // new
  collection_date: date,       // new
  collection_time: time,       // new
  // Remove: dispatched_at, delivered_at — these are no longer set at creation
}
```

**Cellar rows — change the update:**
```ts
// Link cellar rows to the shipment but do NOT set shipped_at yet.
// shipped_at should only be set when the collection is completed (closed).
.update({ shipment_id: shipment.id })
.in('id', cellarIds)
```

This is a key change: bottles are reserved for this collection but not yet marked as shipped. They should disappear from the "unshipped" cellar view (because they have a `shipment_id`) but `shipped_at` stays null until the collection is actually completed.

### C — Customer page: update the cellar query

In `app/admin/(protected)/customers/[id]/page.tsx`, the "Current Cellar" section should only show cellar entries where `shipped_at IS NULL AND shipment_id IS NULL`. This excludes bottles that are reserved for a pending collection but not yet collected. Currently it probably just filters on `shipped_at IS NULL` — add the `shipment_id IS NULL` condition.

### D — Customer page: show pending collections

Below the "Current Cellar" section (and above the existing "Shipped" section), add a new section: **"Pending collections"**.

Query: shipments where `customer_id = id AND type = 'collection' AND status != 'delivered'`, ordered by `collection_date asc`.

For each pending collection, show:
- Venue name (capitalised: "Crush" / "Norse")
- Collection date (formatted nicely: "Thu 15th May")
- Collection time (if set: "at 2:30pm", otherwise "no time set")
- Bottle count
- A **"Mark as collected"** button — calls a new API endpoint (see section 3A) to complete the collection.
- A **"Cancel"** button — small, secondary style. Cancels the collection: sets the shipment status to a cancelled state and unlinks the cellar rows (see section 3B).

Show this section only if there are pending collections. If the customer has no pending collections, hide the section entirely.

---

## 3. New API endpoints

### A — Complete a collection: `POST /api/admin/shipments/[id]/complete-collection`

Marks a collection shipment as done. The customer has picked up their bottles.

1. Fetch the shipment. Verify `type = 'collection'` and `status = 'pending'`.
2. Update the shipment: `status = 'delivered'`, `dispatched_at = now()`, `delivered_at = now()`.
3. Update all cellar rows with `shipment_id = this shipment`: set `shipped_at = now()`.
4. Return 200.

Requires admin session.

### B — Cancel a collection: `POST /api/admin/shipments/[id]/cancel-collection`

Cancels a pending collection. The bottles go back into the customer's available cellar.

1. Fetch the shipment. Verify `type = 'collection'` and `status = 'pending'`.
2. Update all cellar rows with `shipment_id = this shipment`: set `shipment_id = null` (unlink them — they're available again).
3. Delete the shipment row entirely (or set `status = 'cancelled'` if you prefer — but since the cellar rows are unlinked, deleting is cleaner and avoids clutter on the shipments page).
4. Return 200.

Requires admin session.

---

## 4. Shipments page updates

The shipments page (`app/admin/(protected)/shipments/page.tsx`) already shows collection shipments, but the display needs updating to show the new scheduling details and appropriate actions.

### A — Show collection details

For shipments where `type = 'collection'`, update the row:

- **Address column** — instead of "—", show the venue and date:
  ```
  Crush
  Thu 15th May, 2:30pm
  ```
  If no time was set, just show the date. Use the same compact format as other dates in the table.

- **Status column** — for `type = 'collection'` shipments:
  - `pending` status: show a distinct badge — use **"Collection pending"** in `bg-amber-100 text-amber-700` (same style as existing pending badge but with the label changed).
  - `delivered` status: show **"Collected"** in `bg-green-100 text-green-700`.

### B — Actions column for collection shipments

For `type = 'collection'` shipments, the actions should be different from delivery shipments:

- **When `status = 'pending'`**: show a **"Mark collected"** button (calls `POST /api/admin/shipments/[id]/complete-collection`). Style: `bg-green-100 text-green-700 hover:bg-green-200`. No tracking number input — collections don't have tracking.

- **When `status = 'delivered'`**: show "Collected" (static text, no actions). Same as current "Delivered" text for delivery shipments.

Update the `ShipmentActions` component to accept the shipment `type` as a prop and render the appropriate actions.

### C — Shipment detail page

`app/admin/(protected)/shipments/[id]/page.tsx` — for collection shipments, show the venue, date, and time instead of the address section. Show the "Mark collected" / "Cancel" buttons here too if the status is pending.

### D — Sort order

Collections with today's date or past dates should sort near the top of the shipments list (alongside other pending shipments). The existing `order('created_at', { ascending: false })` is probably fine, but consider sorting pending collections by `collection_date asc` so the soonest collection is at the top.

---

## Implementation notes for Claude Code

- **Migration numbering**: start from `034`. Check `supabase/migrations/` first.
- **Cellar row lifecycle**: the key change is that `shipment_id` is set when the collection is scheduled (reserving the bottles) but `shipped_at` stays null until completion. Update any queries that use `shipped_at IS NULL` to mean "available" — they should also check `shipment_id IS NULL` to exclude reserved bottles.
- **Don't break delivery shipments.** The collection-specific fields (`collection_venue`, `collection_date`, `collection_time`) are nullable and only used when `type = 'collection'`. Delivery shipments are unaffected.
- **The ShipmentActions component** needs the shipment `type` prop added. Pass it from the shipments page and the shipment detail page.
- **CLAUDE.md**: after implementation, update the shipments description to mention the collection workflow and the new migration number.
