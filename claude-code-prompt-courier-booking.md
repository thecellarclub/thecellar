# Claude Code Prompt — Courier Booking Workflow for Delivery Shipments

Delivery shipments (cases posted to customers) currently go straight from `pending` / `confirmed` to `dispatched`. In reality there's a step in between: someone has to book a courier collection from the bar, wait for the courier to actually show up and collect the parcel, and only then is it dispatched. We need visibility into this so we know which cases need courier bookings, which are waiting to be collected, and from which location.

This spec adds a `collection_booked` status to the delivery shipment lifecycle and the UI to support it. It does **not** affect bar pickup (in-person collection) shipments — those have their own workflow.

Three areas. Do them in order.

---

## 1. Migration

### A — `035_courier_booking.sql`

```sql
ALTER TABLE shipments
  ADD COLUMN IF NOT EXISTS courier_collection_date date,
  ADD COLUMN IF NOT EXISTS courier_collection_location text;
```

`courier_collection_date` is the date the courier is booked to collect the parcel from the bar. `courier_collection_location` is which bar it's being collected from (`'crush'` or `'norse'`).

These columns are nullable and only relevant for `type = 'delivery'` shipments. The existing `collection_venue` / `collection_date` / `collection_time` columns (from the bar pickup spec) are separate — those are for customer-facing bar pickups.

We don't need a new status value in the schema because `status` is a plain `text` column. We just start using `'collection_booked'` as a valid value.

Check `supabase/migrations/` before creating — if anything has been added since this spec was written, number accordingly.

---

## 2. Shipments page — updated actions and display

The shipments page (`app/admin/(protected)/shipments/page.tsx`) needs to show the new stage and provide the right buttons at each step.

### A — New delivery shipment lifecycle

For `type = 'delivery'` shipments, the statuses are now:

```
pending → confirmed → collection_booked → dispatched → delivered
```

(The `pending → confirmed` transition is unchanged — it happens when the customer confirms their address via the `/ship?token=` flow.)

### B — Update `StatusBadge`

Add the new status to the badge styles in both the shipments page and the shipment detail page:

```ts
collection_booked: 'bg-indigo-100 text-indigo-700'
```

Display label: **"Collection booked"**.

### C — Actions column: step-by-step buttons

Update `ShipmentActions` (`app/admin/_components/ShipmentActions.tsx`) for `type = 'delivery'` shipments. The component needs the shipment `type` as a new prop (if not already added by the bar pickup spec). The flow for delivery shipments is:

1. **When `status = 'pending'` or `status = 'confirmed'`**: show a **"Book collection"** button. Clicking it reveals an inline form (same pattern as the existing tracking number input):
   - **Location** — two toggle-style pill buttons: **Crush** / **Norse**. Must pick one.
   - **Collection date** — `<input type="date">`. Required. Minimum: today.
   - **Tracking number** — text input. Optional at this stage (can be added later).
   - **Confirm / Cancel** buttons. "Confirm" is disabled until location and date are filled.

   On confirm, call `PATCH /api/admin/shipments/[id]` with:
   ```json
   {
     "status": "collection_booked",
     "courier_collection_location": "crush",
     "courier_collection_date": "2026-05-20",
     "tracking_number": "optional-at-this-point"
   }
   ```

2. **When `status = 'collection_booked'`**: show two things:
   - The collection details as read-only text: "Crush · Tue 20th May" (and tracking number if set).
   - A **"Mark dispatched"** button. Clicking it reveals an inline form:
     - **Tracking number** — text input, pre-filled if already set during booking. Optional (some couriers give the number at booking, others at collection).
     - **Confirm / Cancel** buttons.

   On confirm, call the existing `POST /api/admin/shipments/[id]/dispatch` with `action: 'dispatch'` and the tracking number. This sets `status = 'dispatched'` and `dispatched_at = now()` and sends the SMS with tracking info if provided.

3. **When `status = 'dispatched'`**: show **"Mark delivered"** button (no change from current behaviour).

4. **When `status = 'delivered'`**: show "Delivered" text (no change).

### D — Update the PATCH route for the new status

`app/api/admin/shipments/[id]/route.ts` — update to accept the new fields:

```ts
// In the PATCH handler, accept these additional fields:
{
  status: 'collection_booked',
  courier_collection_location: 'crush' | 'norse',
  courier_collection_date: string,  // ISO date
  tracking_number?: string
}
```

Validate:
- `courier_collection_location` must be `'crush'` or `'norse'` when status is `collection_booked`.
- `courier_collection_date` must be a valid date when status is `collection_booked`.
- Only allow transition to `collection_booked` from `pending` or `confirmed`.

### E — Shipments table: show collection details

For `type = 'delivery'` shipments with `status = 'collection_booked'`, update the row display:

- **Status column** — show the "Collection booked" badge, plus the date and location below it:
  ```
  Collection booked
  Crush · Tue 20th May
  ```

- **Tracking column** — show the tracking number if it was entered at booking time, otherwise "—" (can still be added at dispatch).

### F — Summary counts

Update the summary line at the top of the shipments page (currently shows "X pending · Y in transit"). Add collection_booked:

```
X pending · Y collection booked · Z in transit
```

Use `text-indigo-700` for the collection booked count.

---

## 3. Shipment detail page

`app/admin/(protected)/shipments/[id]/page.tsx` — update for the new status.

### A — Courier collection info section

For `type = 'delivery'` shipments, add a section (or add fields to the existing summary grid) showing:

- **Courier collection** — location (Crush / Norse) and date, if set.

Only show this when `courier_collection_date` is not null. Format the date nicely ("Tue 20th May 2026").

### B — Query update

The detail page query doesn't currently select `type`, `courier_collection_date`, or `courier_collection_location`. Add these to the `.select()`.

### C — Dispatch form

The existing `ShipmentDispatchForm` component handles tracking and dispatch. It should work with the new flow — when status is `collection_booked`, the dispatch form should be available (it currently shows for `pending` and `confirmed` too). No changes needed to the form itself, just make sure it renders for `collection_booked` status.

### D — Tracking number: addable at either stage

The tracking number can be entered:
1. When booking the courier collection (optional field in the booking form).
2. When marking as dispatched (existing tracking input in the dispatch flow).
3. After dispatch, via the "Update tracking" action (already supported by the dispatch route's `update_tracking` action).

The `ShipmentDispatchForm` already handles updating tracking on dispatched shipments. Make sure the booking form in `ShipmentActions` also passes tracking through correctly.

---

## Implementation notes for Claude Code

- **Migration numbering**: this should be `035` if the bar pickup spec used `034`. Check `supabase/migrations/` first.
- **Don't break bar pickup shipments.** The courier booking fields (`courier_collection_date`, `courier_collection_location`) are only for `type = 'delivery'`. Bar pickup shipments (`type = 'collection'`) use different fields from the bar pickup spec.
- **ShipmentActions needs type and courier fields.** The component already needs `type` from the bar pickup spec. Now it also needs `courier_collection_date`, `courier_collection_location`, and the existing `tracking_number` to render the correct state. Pass these as props from both the shipments page and detail page.
- **Status transitions**: `collection_booked` is only valid for `type = 'delivery'`. The PATCH route should reject this status for `type = 'collection'` shipments.
- **CLAUDE.md**: after implementation, update the shipments lifecycle description and migration counter.
