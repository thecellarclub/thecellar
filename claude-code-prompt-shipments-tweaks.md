# Claude Code Prompt — Shipments Page Tweaks

Small adjustments to the shipments table (`app/admin/(protected)/shipments/page.tsx` and related components).

---

## 1. Remove Tracking column

Drop the Tracking column entirely from the table. Remove the header and the cell. If there's a tracking number input elsewhere (e.g. in a modal or detail page), leave that alone — just remove it from the table view.

## 2. Show full address

The Address column currently shows a compact version (city + postcode). Change it to show the full address. For delivery shipments, show the complete address (line1, line2 if present, city, postcode) — each part on its own line or comma-separated. For collection shipments, show the venue name (Crush / Norse) as before.

## 3. Contents column formatting

Make the Contents column the widest column in the table. Instead of showing wines as a comma-separated string, put each wine on its own line (line break between each item). Keep the bottle count summary at the end, e.g.:

```
Bruno Andreu
Elixir
Syrah
Montblanc, France ×3
Domain...
(5 bottles)
```

Each wine name + quantity on its own line. Use `<br />` or `flex-col` or similar — whatever works with the current table markup.

## 4. Fix collection action button

Collection shipments (type `'collection'`) should NOT show "Book collection" as their action. A collection only appears on the shipments page because it's already been booked/scheduled. The only action for a pending collection should be **"Mark collected"** — which marks it as complete (sets status to `delivered`, sets `shipped_at` / `delivered_at` timestamps on the cellar rows and shipment).

## 5. Fix delivery action after dispatch

Once a delivery shipment has been marked as `dispatched`, the next action should be **"Mark complete"** (not "Mark delivered"). This should set the shipment status to `delivered` and update any relevant timestamps. Keep it simple — just a single button that completes the shipment.

---

## Summary of action buttons by type and status

| Type | Status | Action button |
|------|--------|--------------|
| Delivery | `pending` | Confirm shipment |
| Delivery | `confirmed` | Book collection |
| Delivery | `collection_booked` | Mark dispatched |
| Delivery | `dispatched` | Mark complete |
| Collection | `pending` | Mark collected |
| Collection | `delivered` | _(none — already complete)_ |
