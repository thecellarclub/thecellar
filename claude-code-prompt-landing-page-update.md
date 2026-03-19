# Claude Code Prompt — Landing Page Design Update

Reference `thecellarclub-design-brief.md` for the full design spec. This prompt makes a series of targeted updates to the existing landing page (`/app/page.tsx`) and the shared design system.

---

## 1. Font: Replace Inter with Spectral

In `layout.tsx` (or wherever fonts are loaded via `next/font/google`):
- Remove `Inter`
- Add `Spectral` with weights 400, 400 italic, 600
- Replace all uses of `font-inter` / `className={inter.className}` with `font-spectral` / `className={spectral.className}` across **all customer-facing pages** (`/`, `/join/*`, `/ship`, `/billing`, `/authenticate`, `/privacy`, `/terms`)
- Do NOT touch the admin panel fonts

---

## 2. Remove all italic text

- The subheading was set in italic — remove italic from it and all other body text. Only Cormorant Garamond heading elements should remain — those can stay non-italic (they're not set italic anyway). The goal: nothing in Spectral body copy should be italic.

---

## 3. Split hero subheading into three line breaks

The current subheading is one paragraph. Replace it with three distinct lines, each on its own line with visible spacing between them:

```
Two texts a week. Bottles you won't find on any shelf at prices that feel like a secret.

Reply how many you want.

We store and ship for free once you fill a case.
```

Implement as three `<p>` tags (or `<span>` elements with `display: block`) with a small gap between them (e.g. `mb-3` or `mb-4`). Not italic. Cormorant Garamond, ~1.35rem, centred, max-width 600px.

---

## 4. Remove "Why we take your card upfront" box

Delete the info box in Section 2 (How It Works) that explains card capture. Remove the box, the copy, and any surrounding wrapper elements. The section should end cleanly after the three steps.

Update the reassurance line under the hero CTA to just:
> *You're only ever charged when you confirm an order.*

---

## 5. Gold text sizing

Wherever gold (`#C9851D`) is used for text (section labels, any highlighted words), increase the font size by at least 10–15% relative to surrounding text. If section labels are currently `0.75rem`, bump to `0.875rem`. If a gold word sits inline in cream copy, it should feel emphasised, not undersized.

Also increase `letter-spacing` slightly on gold labels — aim for `0.2em` tracked out.

---

## 6. Visual richness — layering and atmosphere

The page should feel warmer, more textured, and more layered. Make all of the following changes:

### Section dividers
Between each major section, add a centred decorative divider. Use a thin gold horizontal line (`1px`, `rgba(201,133,29,0.4)`, max-width 120px) flanked by two small SVG ornaments (use a simple diamond `◆` or minimalist vine motif). Not a plain `<hr>`.

### Benefit cards (Section 3)
Wrap each of the six benefits in a card:
- Background: `#1E0B10`
- Border: `1px solid rgba(240,230,220,0.12)`
- Top accent: `3px solid #9B1B30` (Rio Red top border)
- Padding: `1.5rem`
- Subtle hover: scale `1.015`, background slightly lighter, `transition: all 200ms`
- The benefit number (01–06) should render large and faint in the background of each card — Cormorant Garamond, ~5rem, `opacity: 0.06`, gold, positioned top-right of the card

### Rio Red left accent on step descriptions (Section 2)
Each of the three steps (01, 02, 03) should have a `3px solid #9B1B30` left border, with `paddingLeft: 1rem`. Adds visual rhythm and warmth.

### Background texture
Add a very subtle noise texture overlay to section backgrounds. Use a CSS background-image with an SVG filter or a base64-encoded noise SVG at ~3% opacity. This adds a slight parchment/grain feel.

### Hero line art
Ensure the cellar arch SVG is rendering in the hero at `opacity: 0.08` as a background layer. If it's missing or too faint/strong, adjust accordingly. The arch should be large (full viewport width), centred, and very subtle.

### Wine bottle SVG in Section 4
Section 4 (The Story) is a two-column layout on desktop. The right column should contain a large wine bottle SVG line art — cream stroke, no fill, `opacity: 0.7`, approximately 300px tall. If this is missing or broken, create it as an inline SVG: a clean minimal wine bottle outline (no label, no label text — just the silhouette as a line drawing in the Rochambeau Club architectural style).

---

## 7. Copy updates

### Section 4 — The Story copy

Replace the existing story copy with:

```
We're Craig and Daniel. We run Crush and Norse — two wine bars and shops in Durham.
Our cellar is big enough to warrant its own membership.

Daniel is fab with wine. Somehow so knowledgeable yet totally unpretentious.
Twenty years in the industry, time at the Raby Hunt, and a genuine obsession
with finding bottles that make people feel something.

The Cellar Club is what happens when a great sommelier has a big cellar, direct
import relationships, and a group of people who trust him to find something worth drinking.
```

### Membership gate on `/join` (Step 1)

Update the small positioning line to:
> *The Cellar Club is for guests who've visited Crush or Norse.*

---

## 8. Animations

### On page load — hero subheading
Each of the three subheading lines should fade in and translate up (20px → 0) sequentially:
- Line 1: delay 0ms
- Line 2: delay 120ms
- Line 3: delay 240ms

Duration: 600ms, ease-out. Use CSS animation classes with `animation-fill-mode: both`.

### On scroll — Intersection Observer
Apply a `fade-up` animation to these elements as they scroll into view:
- Section headings
- Step descriptions (01, 02, 03 in How It Works)
- Benefit cards (stagger each card by 80ms)
- Story paragraphs

Animation: opacity 0→1, translateY 20px→0, 500ms ease-out.

### Hover states
- **Benefit cards:** scale 1.015, lighter background — 200ms transition (already covered in card styles above)
- **CTA buttons (Rio Red):** darken background by ~10%, the `→` nudges 3px right on hover — 150ms transition
- **Step numbers (01, 02, 03):** gold colour intensifies (opacity 1 from 0.7) on hover

### Mobile touch feedback
On all interactive elements, add `:active` state with `opacity: 0.8` and a 50ms transition. Makes the site feel native on mobile.

### Reduced motion
Wrap ALL animation code in `@media (prefers-reduced-motion: no-preference)`. For users who've opted out of motion, elements should simply appear without animation.

---

## Files to modify

- `app/layout.tsx` — font swap (Inter → Spectral)
- `app/page.tsx` — all section and copy changes
- `app/globals.css` or Tailwind config — animation keyframes, texture overlay, any new utility classes
- `app/join/page.tsx` (or Step 1) — membership gate copy update

Do NOT modify the admin panel (`/admin/*`).

---

*Ref: thecellarclub-design-brief.md*
