# Claude Code Prompt — Shipments Page Overhaul + Wine Image Upload

Two independent features. Do them in order.

---

## 1. Shipments page overhaul

The current shipments page (`app/admin/(protected)/shipments/page.tsx`) has limited columns and no sorting. It needs to be a one-stop-shop for seeing what needs doing: which cases need courier bookings, what's being collected when, what's in each shipment, and what the next action is.

### A — Fetch shipment contents

The current query selects from `shipments` joined to `customers`, but doesn't include what's actually in each shipment. Add a second query to fetch cellar rows with wine names for all shipments:

```ts
const { data: cellarRows } = await sb
  .from('cellar')
  .select('shipment_id, quantity, wines(name)')
  .not('shipment_id', 'is', null)
```

Group these by `shipment_id` client-side and pass them to the component. For each shipment row, show a comma-separated summary of the wines, e.g. "Chablis ×2, Barolo ×1, Malbec ×3".

### B — New columns

Replace the current table columns with:

| Column | What it shows |
|--------|--------------|
| **Customer** | Name + phone (keep existing) |
| **Contents** | Wine names with quantities, e.g. "Chablis ×2, Barolo ×1". Truncate with "..." and a tooltip/title if more than ~60 chars. Show bottle count in brackets: "(6 bottles)" |
| **Address** | For delivery shipments: city + postcode (compact — no need for full address in the table). For collection shipments: venue name (Crush / Norse). Show "—" if no address and not a collection. |
| **Status** | Status badge (keep existing). For collection types, prefix with "Collection" or "Delivery" as a small grey label above the badge. |
| **Created** | Created date (keep existing, formatted short: "13 May") |
| **Collection** | Courier collection date for delivery shipments (`courier_collection_date`), or bar collection date for collection shipments (`collection_date`). Show venue too if set. Show "—" if not scheduled. Colour: red if date is today or past and status is still pending/collection_booked, amber if within 3 days, grey otherwise. |
| **Tracking** | Tracking number or "—" (keep existing) |
| **Actions** | The next action button for this shipment (keep existing `ShipmentActions` component — it already handles the different statuses) |

### C — Make columns sortable

Add clickable column headers that sort the table. Click once for ascending, click again for descending. Show a small arrow indicator (▲/▼) on the active sort column.

Sortable columns: Customer (alphabetical), Status, Created (date), Collection date.

**Default sort**: Collection date ascending (soonest first), with nulls (no collection date) at the bottom. This puts "needs doing soon" at the top.

Implement sorting client-side — convert the shipments page to use a client component for the table (the page itself can stay as a server component that fetches data and passes it down).

### D — Summary counts

Update the summary line at the top to show all relevant counts:

```
X pending · Y collection booked · Z dispatched · W delivered
```

Use the existing colour scheme per status. Only show counts that are > 0.

### E — Filter by type

Add a simple filter toggle above the table (similar to the inbox assignee filter):

- **All** (default)
- **Deliveries** — `type = 'delivery'`
- **Collections** — `type = 'collection'`

Client-side filter on the already-loaded data.

### F — Mobile

The current table works on mobile with horizontal scroll. Keep that approach but make sure the Contents column doesn't make it unusably wide — truncate aggressively on small screens.

---

## 2. Wine image upload

Replace the manual "Image URL" text input on the wine form with a proper file upload that stores images in Supabase Storage.

### A — Supabase Storage bucket

Create a storage bucket called `wine-images` in Supabase. This needs to be done manually in the Supabase dashboard (Storage → New bucket). Settings:

- **Public bucket**: yes (images need to be accessible without auth for the public wine pages).
- **File size limit**: 5MB.
- **Allowed MIME types**: `image/jpeg`, `image/png`, `image/webp`.

Add an RLS policy allowing public read access (or rely on the bucket being public). Uploads will go through the API route using the service-role client, so no RLS needed for inserts.

### B — API route for image upload: `app/api/admin/wines/upload-image/route.ts`

`POST` — accepts `multipart/form-data` with a single file field `image`.

1. Require admin session.
2. Validate the file: must be an image (jpeg/png/webp), max 5MB.
3. Generate a unique filename: `{uuid}.{extension}` (don't use the original filename — avoids collisions and special characters).
4. Upload to Supabase Storage bucket `wine-images` using the service-role client:
   ```ts
   const sb = createServiceClient()
   const { data, error } = await sb.storage
     .from('wine-images')
     .upload(filename, buffer, { contentType: file.type, upsert: false })
   ```
5. Get the public URL:
   ```ts
   const { data: { publicUrl } } = sb.storage
     .from('wine-images')
     .getPublicUrl(filename)
   ```
6. Return `{ url: publicUrl }`.

### C — Update WineForm component

Replace the "Image URL" text input (`app/admin/_components/WineForm.tsx`) with a file upload area:

1. **Drop zone / file input** — a bordered dashed area that says "Drop an image or click to browse". Clicking opens a native file picker (`<input type="file" accept="image/*">`). Style: `border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400`.

2. **Preview** — when a file is selected (or an existing `image_url` is set), show a thumbnail preview inside the drop zone (replace the placeholder text). Size: constrain to max 200px height.

3. **Upload on selection** — when a file is picked, immediately upload it via `POST /api/admin/wines/upload-image`. Show a loading spinner/progress indicator during upload. On success, set `form.image_url` to the returned URL (this still gets saved with the rest of the form as before). On error, show the error message.

4. **Remove button** — if an image is set, show a small "Remove" link below the preview that clears `form.image_url` back to empty string. This doesn't delete the file from storage (orphaned images are fine — storage is cheap).

5. **Keep backward compatibility** — the `image_url` field still gets saved to the database as a URL string. The only difference is now it's populated by the upload flow instead of pasting a URL manually. Old wines with manually-entered URLs continue to work.

### D — Don't break the form submission

The wine form currently sends `form.image_url` as part of the JSON body to the wine API. Keep this — the upload is a separate step that populates `image_url` before the form is submitted. The wine create/edit API routes don't need any changes.

---

## Implementation notes for Claude Code

- **Supabase Storage setup**: the bucket `wine-images` needs to be created manually in the Supabase dashboard. Add a note to the output/console when the upload route is first hit and the bucket doesn't exist, so the team knows to create it. Or better: have the upload route attempt to create the bucket if it doesn't exist (using `sb.storage.createBucket('wine-images', { public: true })`) and handle the "already exists" error gracefully.
- **File size in Next.js**: Next.js API routes have a default body size limit. For file uploads, you'll need to export a route segment config to increase it: `export const config = { api: { bodyParser: false } }` or use the App Router's built-in `request.formData()` which handles multipart natively.
- **Public URLs**: Supabase public bucket URLs follow the pattern `{SUPABASE_URL}/storage/v1/object/public/wine-images/{filename}`. Make sure `NEXT_PUBLIC_SUPABASE_URL` is available (it should already be in the env).
- **Shipments page**: the cellar contents query could return a lot of data if there are many shipments. Keep it simple for now — fetch all cellar rows with non-null `shipment_id`. If performance becomes an issue later, we can paginate.
- **CLAUDE.md**: after implementation, mention the `wine-images` storage bucket and the new shipments page columns.
