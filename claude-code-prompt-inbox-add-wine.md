# Spec: Quick-Add Wine to Cellar from Inbox

## Context

Customers are increasingly requesting ad hoc bottles via the inbox that aren't part of a wine offer campaign. The team needs a way to add bottles directly to a customer's cellar from the inbox right panel, without having to navigate away. Wines added this way may be:

- Existing wines from the catalogue (including historical ones no longer active)
- Newly created wines (e.g. one-off bottles we want to track but not offer via SMS)

New wines created via this flow should be added to the `wines` table but marked as `active = false` (unlisted) so they don't appear in offer selection.

There is already a `/api/admin/customers/[id]/add-bottles` endpoint that handles inserting into `cellar` and decrementing stock. This spec extends it slightly and builds UI on top.

---

## 1. Schema change: bypass stock check for manual adds

The existing `add-bottles` endpoint currently requires `stock_bottles >= quantity`. For inbox manual adds we need to allow adding regardless of stock (the admin is setting aside a specific bottle).

Add a `bypassStockCheck` boolean to the request body (default `false`). When `true`, skip the stock check and still decrement `stock_bottles` (it can go negative — that's fine, it signals the bottle was manually committed). This flag is only available to admin routes (it already is — this endpoint is under `/api/admin/`).

Alternatively, if stock is 0, simply don't decrement it (leave at 0). Either approach is acceptable — use whichever is simpler.

---

## 2. New API route: quick-create wine

**`POST /api/admin/wines/quick-create`**

Creates a minimal wine record and returns its id. Used by the quick-create flow in the inbox.

Request body:
```json
{
  "name": "string (required)",
  "producer": "string (optional)",
  "vintage": "number (optional, 4-digit year)",
  "pricePence": "number (required, in pence)"
}
```

- Sets `active = false` on the created wine (unlisted)
- Returns `{ id, name, producer, vintage, price_pence }`
- Requires admin session (`requireAdminSession()`)

---

## 3. UI: "Add wine to cellar" section in inbox right panel

Add a new collapsible section to the `CustomerPanel` component in `InboxClientView.tsx`, below the existing NotesSection and above the ActivityFeed. Label it **"Add to cellar"**.

### Collapsed state
A single button: **"+ Add wine to cellar"**. Clicking it expands the section.

### Expanded state

Two tabs or toggle: **Search existing** | **Add new wine**

---

#### Tab A: Search existing

A text input that searches the `wines` table as the user types (debounced, min 2 chars). Search should match on `name`, `producer`, `vintage` (as string). Include wines regardless of `active` status (so historical/unlisted wines show up).

Results show in a dropdown list, each row displaying: `Wine Name — Producer, Vintage` and price.

Use a new API endpoint:

**`GET /api/admin/wines/search?q=<query>`**

Returns up to 20 matching wines: `{ id, name, producer, vintage, price_pence, active }`. Requires admin session.

Once a wine is selected from search results:
- Show selected wine name with a ✕ to clear
- Show a quantity input (default 1, min 1)
- Show an **"Add to cellar"** button

On submit: `POST /api/admin/customers/[id]/add-bottles` with `{ wineId, quantity, bypassStockCheck: true }`.

---

#### Tab B: Add new wine

A minimal form:
- Wine name (required)
- Producer (optional)
- Vintage (optional, number)
- Price (required, £ — convert to pence on submit)
- Quantity (default 1, min 1)

On submit:
1. `POST /api/admin/wines/quick-create` with name/producer/vintage/pricePence
2. On success, `POST /api/admin/customers/[id]/add-bottles` with `{ wineId: <new id>, quantity, bypassStockCheck: true }`

---

### Success / error states

On success: collapse the section, show a brief inline confirmation: "Added [quantity]× [wine name] to cellar." Clear after 3 seconds.

On error: show inline error message. Keep the form open.

---

## 4. Migration

No schema migration is needed — wines already have `active` boolean. The `cellar` table already supports `order_id = null` for manual adds.

---

## Files to create / change

- `app/api/admin/wines/search/route.ts` — new search endpoint
- `app/api/admin/wines/quick-create/route.ts` — new quick-create endpoint
- `app/api/admin/customers/[id]/add-bottles/route.ts` — add `bypassStockCheck` param
- `app/admin/_components/InboxClientView.tsx` — add "Add to cellar" section to `CustomerPanel`

---

## Notes

- The right panel is 320px wide on desktop — keep the UI compact. Single-column layout, no wide tables.
- The customer id for the API calls is available in the inbox from the selected thread's `customer_id`.
- Mobile: the same section should appear inside `MobileCustomerPanel` since it uses the same `CustomerPanel` component.
