# Spec: Public Wine Page

## Context

When Daniel sends an offer by text, the SMS is limited to ~160 characters — just enough for the wine name, origin, price, and a "reply with how many" prompt. Customers who want more info before committing have nowhere to go. Julia wants a public page per wine that she can paste into the offer text, giving customers a photo, tasting notes, producer info, and a retail-vs-Cellar-Club price comparison — without needing to log in or be a member.

No public wine page exists today. The `wines` table has `name`, `producer`, `region`, `country`, `vintage`, `description` (short SMS text), `price_pence`, `stock_bottles`, `active`. It's missing the fields this page needs: an image, a retail comparison price, and a longer website-facing description.

---

## Goals

1. A clean, public page at `/wine/{slug}` that shows a wine's photo and key details — designed to be linked from an SMS offer.
2. New fields on the `wines` table and admin form: image, retail price, website description.
3. Mobile-first layout: bottle image on top, details below. Desktop: side by side.
4. Matches the existing public site design language (beige/cream palette, Spectral serif, warm and minimal).

## Non-Goals

- A wine catalogue or listing page (this is one page per wine, accessed via a direct link).
- Any purchase/ordering functionality on the page (ordering happens by replying to the text).
- Member-only gating (the page is fully public, no auth).

---

## Required Changes

### 1. New columns on `wines` table

Migration `026_wine_page_fields.sql`:

```sql
alter table wines add column image_url text;
alter table wines add column retail_price_pence int;
alter table wines add column website_description text;
alter table wines add column slug text;

-- Slug must be unique (used in URL)
create unique index wines_slug_unique on wines (slug) where slug is not null;
```

**Column notes:**

| Column | Purpose | Nullable? |
|---|---|---|
| `image_url` | URL to the bottle photo. Stored in Supabase Storage or an external CDN. | Yes — page renders a placeholder if missing. |
| `retail_price_pence` | The typical retail/RRP price in pence, shown as a comparison. | Yes — if null, the "Retail price" line is simply omitted from the page. |
| `website_description` | Longer, marketing-quality description for the public page. Separate from `description` which is the short SMS-friendly text. | Yes — if null, the description section is omitted. |
| `slug` | URL-friendly identifier, e.g. `chablis-premier-cru-2022`. Auto-generated from name + vintage on save, editable by admin. | Yes — wine page only works if slug is set. |

### 2. Admin wine form — new fields

**File:** `app/admin/_components/WineForm.tsx`

Add four new fields to the form, below the existing fields:

**Image URL** — text input. Label: "Image URL". Placeholder: "https://...". This is a simple URL field — Julia pastes in a link to an image she's uploaded elsewhere (Supabase Storage, etc.).

**Retail price (£)** — number input, same pattern as the existing "Price (£)" field. Label: "Retail price (£)". Placeholder: "e.g. 18.99". Stored as pence, converted on save — same as `price_pence`.

**Website description** — textarea, 5 rows. Label: "Website description (shown on wine page)". Placeholder: "Tasting notes, food pairings, producer story...". No character counter needed (this isn't SMS).

**Slug** — text input. Label: "Page URL slug". Auto-populated on blur of the Name or Vintage fields using the formula: `slugify(name) + (vintage ? `-${vintage}` : '')`. Editable so Julia can override. Show a preview underneath: `thecellar.club/wine/{slug}`. The `slugify` helper should lowercase, replace spaces/special chars with hyphens, collapse multiple hyphens, trim leading/trailing hyphens.

Group these four fields visually under a small heading or divider: "Wine page" — to separate them from the core SMS/stock fields above.

### 3. Image upload to Supabase Storage (optional enhancement)

If easy to wire up: add a file input next to the Image URL field that uploads to a `wine-images` bucket in Supabase Storage and auto-fills the URL. If this adds significant complexity, skip it — Julia can upload images manually to Storage and paste the URL. Flag in the PR which approach was taken.

### 4. Public wine page — `/app/wine/[slug]/page.tsx`

Server component. Fetches the wine by slug from the `wines` table. If not found or no slug match, return 404.

#### Data fetched

```ts
const { data: wine } = await sb
  .from('wines')
  .select('name, producer, region, country, vintage, price_pence, retail_price_pence, image_url, website_description')
  .eq('slug', params.slug)
  .eq('active', true)
  .maybeSingle()
```

Only show active wines. If the wine is deactivated after an offer, the page returns 404 — keeps things simple and avoids showing stale offers.

#### Layout

**Design tokens — match the public site exactly:**
```
PAGE_BG    = '#EDE8DF'     // Warm beige
CARD_BG    = '#F5EFE6'     // Slightly darker beige card
TEXT_DARK  = '#1C0E09'     // Deep brown
TEXT_FAINT = 'rgba(42,24,16,0.40)'
BORDER     = 'rgba(42,24,16,0.18)'
ACCENT     = '#9B1B30'     // Burgundy
```

**Fonts:** Spectral (serif) for headings and body. System sans for small labels.

**Mobile layout (< md breakpoint) — single column, top to bottom:**

```
┌─────────────────────────────────┐
│  Logo (centred, links to /)     │
├─────────────────────────────────┤
│  ┌───────────────────────────┐  │
│  │                           │  │
│  │     Bottle image          │  │
│  │     (within a border)     │  │
│  │                           │  │
│  └───────────────────────────┘  │
│                                 │
│  Wine Name                      │
│  Vintage                        │
│                                 │
│  Producer: Domaine X            │
│  Region: Chablis                │
│  Country: France                │
│                                 │
│  ┌───────────────────────────┐  │
│  │ The Cellar Club  £12      │  │
│  │ Retail price     £18.99   │  │
│  └───────────────────────────┘  │
│                                 │
│  Website description text...    │
│                                 │
│  ┌───────────────────────────┐  │
│  │ Text Daniel to order →    │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

**Desktop layout (md+ breakpoint) — two columns, side by side:**

```
┌──────────────────────────────────────────────────┐
│          Logo (centred, links to /)               │
├────────────────────┬─────────────────────────────┤
│                    │                             │
│  ┌──────────────┐  │  Wine Name                  │
│  │              │  │  Vintage                    │
│  │   Bottle     │  │                             │
│  │   image      │  │  Producer: Domaine X        │
│  │   (border)   │  │  Region: Chablis            │
│  │              │  │  Country: France             │
│  │              │  │                             │
│  └──────────────┘  │  ┌──────────────────────┐   │
│                    │  │ The Cellar Club  £12  │   │
│                    │  │ Retail price   £18.99 │   │
│                    │  └──────────────────────┘   │
│                    │                             │
│                    │  Website description text…  │
│                    │                             │
│                    │  Text Daniel to order →     │
├────────────────────┴─────────────────────────────┤
│              Footer / join CTA                    │
└──────────────────────────────────────────────────┘
```

#### Element details

**Logo:** The site logo (`/logo.png`), centred, same sizing as homepage (`w-[155px] md:w-[192px]`), links to `/`. Use `mixBlendMode: 'multiply'` to match.

**Bottle image:**
- Displayed inside a card with the `CARD_BG` background and a `1px solid BORDER` border.
- Padding inside the card: `p-6 md:p-8`.
- Image should use `object-contain` so the bottle is shown in its natural proportions, not cropped.
- Max height on desktop: roughly `500px` so it doesn't dominate.
- If no `image_url`, show a subtle placeholder — the text "No image" in `TEXT_FAINT` on the `CARD_BG` background, or the logo as a watermark.

**Wine name:** Large serif heading, same `DecoratedHeading` style as homepage or a simpler variant — uppercase Spectral, weighted, `TEXT_DARK`. Include vintage as a separate smaller line below (not appended to the name).

**Details list (Producer / Region / Country):**
- Each line: label in small sans uppercase tracking-wide `TEXT_FAINT`, value in serif `TEXT_DARK`.
- Only show lines where the value exists (skip nulls).
- Simple vertical stack with modest spacing.

**Price comparison card:**
- Small card with `CARD_BG` background and `BORDER`.
- Two rows:
  - "The Cellar Club" — value in `ACCENT` colour, bold, large-ish (e.g. `text-xl`).
  - "Retail price" — value in `TEXT_FAINT`, with a strikethrough. Only shown if `retail_price_pence` is set.
- Prices formatted as `£{(pence / 100).toFixed(2)}` — but drop the `.00` if it's a round number (e.g. `£12` not `£12.00`).

**Website description:**
- Rendered as prose, Spectral serif, `TEXT_DARK`, generous line height (`leading-[1.75]`).
- Whitespace-pre-wrap so line breaks in the admin textarea are preserved.
- Only shown if `website_description` is not null/empty.

**CTA:**
- A gentle prompt at the bottom: "Reply to Daniel's text to order this wine." in serif italic, `TEXT_FAINT`.
- Below it, a link to `/join` styled as a small text link: "Not a member yet? Join here →"
- No "buy now" button — ordering is by text reply only.

#### SEO / metadata

Generate dynamic metadata from the wine data:

```ts
export async function generateMetadata({ params }) {
  // fetch wine...
  return {
    title: `${wine.name}${wine.vintage ? ` ${wine.vintage}` : ''} — The Cellar Club`,
    description: wine.website_description?.slice(0, 155) ?? `${wine.name} — sommelier selected, direct import price.`,
    openGraph: {
      title: `${wine.name}${wine.vintage ? ` ${wine.vintage}` : ''}`,
      description: wine.website_description?.slice(0, 155),
      images: wine.image_url ? [{ url: wine.image_url }] : [],
    },
  }
}
```

This matters because Julia might share the link beyond SMS (WhatsApp, email) and a rich preview with the bottle image would look good.

---

## Migrations Summary

- `026_wine_page_fields.sql` — adds `image_url`, `retail_price_pence`, `website_description`, `slug` to `wines` table. Unique index on `slug`.

(Check latest migration number on master before creating — bump if 026 is taken.)

## Files to Create

- `supabase/migrations/026_wine_page_fields.sql`
- `app/wine/[slug]/page.tsx` — public wine page (server component)

## Files to Modify

- `app/admin/_components/WineForm.tsx` — add image URL, retail price, website description, and slug fields. Add "Wine page" section divider. Auto-generate slug from name + vintage.
- `app/admin/(protected)/wines/[id]/page.tsx` — ensure new fields are fetched and passed to WineForm in edit mode.
- `app/admin/(protected)/wines/page.tsx` — optionally add a "Page" column to the wine list with a link icon that opens `/wine/{slug}` in a new tab (only if slug is set). Useful for Julia to quickly preview.

---

## Acceptance Criteria

- [ ] New columns `image_url`, `retail_price_pence`, `website_description`, `slug` exist on the `wines` table.
- [ ] Admin wine form shows all four new fields under a "Wine page" section.
- [ ] Slug auto-generates from name + vintage on blur, but is editable.
- [ ] Slug preview shows `thecellar.club/wine/{slug}` below the input.
- [ ] `/wine/{slug}` renders the public wine page for active wines with a matching slug.
- [ ] `/wine/{slug}` returns 404 for inactive wines or non-existent slugs.
- [ ] Mobile: image on top (in bordered card), details below in single column.
- [ ] Desktop: image card on the left, details on the right, side by side.
- [ ] Page uses the same beige/cream palette, Spectral font, and design tokens as the homepage.
- [ ] Price shows The Cellar Club price in accent burgundy; retail price in faint strikethrough (only if set).
- [ ] Producer, Region, Country lines only appear if the value is set.
- [ ] Website description renders with line breaks preserved and generous line height.
- [ ] Page has dynamic OG metadata with wine name, description, and image for rich link previews.
- [ ] Logo links back to `/`.
- [ ] CTA text says to reply to Daniel's text — no purchase button.
