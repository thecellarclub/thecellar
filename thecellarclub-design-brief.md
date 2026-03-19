# The Cellar Club — Website Design Brief

## Overview

Build the public-facing landing page (`/`) and apply a consistent design system across all customer-facing pages (`/join/*`, `/ship`, `/billing`, `/authenticate`, `/privacy`, `/terms`).

The aesthetic reference is **The Rochambeau Club** (therochambeauclub.com) — dark, elegant, confident, a little curious. Understated luxury. Not a wine shop. Not corporate. Feels like somewhere you'd want to be a member.

---

## Colour Palette

| Name | Hex | Usage |
|---|---|---|
| Deep Maroon (background) | `#120608` | Page background — near black with warmth |
| Dark Maroon (sections) | `#1E0B10` | Alternate section backgrounds, cards |
| Rio Red (accent) | `#9B1B30` | CTAs, highlights, hover states |
| Cream (primary text) | `#F0E6DC` | All body text and headings |
| Gold (Sunflower, sparingly) | `#C9851D` | One or two words in hero headline only, dividers |
| Faint border | `rgba(240,230,220,0.12)` | Section dividers, card borders |

**Primary CTA buttons:** Rio Red background `#9B1B30`, cream text, no border radius (sharp corners, premium feel).

---

## Typography

Use Google Fonts — load in `layout.tsx`:

- **Headings:** `Cormorant Garamond` — serif, elegant, matches the logo treatment
- **Body:** `Spectral` — elegant serif designed for screen reading. Replace all instances of Inter with Spectral. Spectral gives the whole site a unified, all-serif feel that suits the brand.
- **Small labels / nav:** Cormorant Garamond, tracked out (`letter-spacing: 0.15em`), all caps

Logo treatment: "the" and "club" in small tracked serif, "CELLAR" in large caps — match the existing brand mark exactly.

---

## Page Structure — Single Long Page

The landing page is one scrolling page with four sections. No separate marketing pages.

---

### Section 1 — Hero (full viewport height)

**Layout:** Centred, vertically and horizontally. Dark maroon background (`#120608`). Subtle line art illustration as a background layer (see Line Art section below).

**Content (top to bottom):**

1. Brand mark — `THE CELLAR CLUB` in Cormorant Garamond, all caps, cream, large. Match the logo typographic treatment exactly: "the" small, "CELLAR" large, "club" small.

2. Subheading — split across three distinct line breaks (not a single paragraph). No italic. Cormorant Garamond, approximately 1.4rem. Not bold. Centred. Max width 600px.

   ```
   Two texts a week. Bottles you won’t find on any shelf at prices that feel like a secret.
   Reply how many you want.
   We store and ship for free once you fill a case.
   ```

   Each line should read as its own statement with a visible line break between them.

3. Sign-up row — two elements side by side (stacked on mobile):
   - Phone number input: cream border, dark background, placeholder "Your mobile number"
   - Button: "Join the Club →" in Rio Red

   Clicking the button or submitting the phone number navigates to `/join` (passing the phone number as a query param so `/join` can pre-fill it).

4. Small reassurance line below the form (cream, 0.8rem, Spectral):
   > *You're only ever charged when you confirm an order.*

---

### Section 2 — How It Works

**Background:** `#1E0B10` (slightly lighter dark maroon)

**Section label:** `HOW IT WORKS` — small caps, tracked, gold, centred

**Three steps, laid out horizontally (stacked on mobile):**

**01 — We text you**
Twice a week, Daniel picks something remarkable. A skin-contact Slovenian, a Texan Tempranillo, a Burgundy that shouldn't be this affordable. It lands in your phone.

**02 — Reply to order**
Text back how many bottles you want. We'll confirm the total and take payment once you reply YES. That's it.

**03 — We store it, you collect**
Your bottles go straight to your cellar. When you've got 12, we ship the whole case to your door. Free.

---

### Section 3 — The Benefits

**Background:** `#120608`

**Section label:** `MEMBERSHIP` — small caps, tracked, gold, centred

**Six benefits in a 2×3 grid (1 column on mobile).** Copy-led — no icons. Each benefit has a short bold heading and 1–2 sentences.

**01 — Wines you won't find anywhere else**
We import directly and have relationships most retailers don't. Taiwan, Georgia, Texas, India — if it's interesting, Daniel will find it.

**02 — Sommelier selected**
Every bottle is chosen by Daniel Jonberger — 20 years in wine, including time at the 2 Michelin Star Raby Hunt. He doesn't pick anything he wouldn't open himself.

**03 — Better prices**
We buy in volume across our two wine bars. You get the benefit of that.

**04 — Free storage & shipping**
We hold your bottles until you've got 12, then ship the whole case to your door for free. No faff, no trips to the post office.

**05 — Wine concierge**
Got a question? Looking for a gift? Text Daniel directly. He'll sort it.

**06 — Request a wine**
Want something we haven't featured? Request it. If enough members are in, we'll run it as a drop — at bulk prices. This is how you get access to bottles that simply aren't available in small quantities.

---

### Section 4 — The Story

**Background:** `#1E0B10`

**Layout:** Two columns on desktop — text left, line art right. Single column on mobile.

**Copy:**

*We're Craig and Daniel. We run Crush and Norse — two wine bars and shops in Durham. Our cellar is big enough to warrant its own membership.*

*Daniel is fab with wine. Somehow so knowledgeable yet totally unpretentious. Twenty years in the industry, time at the Raby Hunt, and a genuine obsession with finding bottles that make people feel something.*

*The Cellar Club is what happens when a great sommelier has a big cellar, direct import relationships, and a group of people who trust him to find something worth drinking.*

**Second CTA at the bottom of this section:**
> *Ready to fill your cellar?*

Button: "Join the Club →" in Rio Red, centred.

---

### Section 5 — Membership Tiers

**Background:** `#120608`

**Section label:** `THE LEVELS` — small caps, tracked, gold, centred

**Intro line** (centred, Spectral, cream, max-width 560px):
> *Spend more, get more. Here's what membership looks like.*

**Three tier cards** — side by side on desktop, stacked on mobile. Each card:
- Background: `#1E0B10`
- Faint cream border (`rgba(240,230,220,0.12)`)
- **Palatine** card gets a gold top border (3px) instead of Rio Red — it's the premium tier
- **Bailey** and **Elvet** get a Rio Red top border (2px)
- Tier name in large Cormorant Garamond, all caps, cream
- Spend threshold in gold, small tracked caps (e.g. "FROM £501 / YEAR")
- Benefits list in Spectral — clean, left-aligned, not bullet points — use a subtle `—` dash prefix
- No icons — copy-led

**Card order (left to right):** Bailey → Elvet → Palatine. Palatine should feel slightly taller/more prominent — use a subtle transform or additional padding to elevate it visually.

**Benefits to show per card:**

Bailey:
```
— Free delivery (per 12 bottles)
— Free storage (up to 3 months)
— Build your own case
— Unlimited special requests
— Wine concierge (5 questions/month)
```

Elvet:
```
— Free delivery (per 12 bottles)
— Free storage (up to 3 months)
— Build your own case
— Unlimited special requests
— Wine concierge (10 questions/month)
— 5% off every bottle
— Free wine tasting (once a year)
```

Palatine:
```
— Free delivery (per 6 bottles)
— Free storage (up to 6 months)
— Build your own case
— Unlimited special requests
— Unlimited wine concierge
— 10% off every bottle
— Free wine tasting (quarterly)
— Birthday gift
— Wine texts two hours early
```

**Tone note:** The tier section should feel like an airline lounge card — exclusive, understated, something worth aspiring to. Not a pricing table. No ticks or crosses. The language should feel earned, not marketed.

---

### Footer

Dark background, cream text, small Inter font.

```
CD WINES LTD · Company No. 15796479
Licensed under the Licensing Act 2003 · Licence No. DCCC/PLA0856
We do not sell alcohol to anyone under 18. Please drink responsibly.
Privacy Policy · Terms & Conditions
```

Links to `/privacy` and `/terms`.

---

## Line Art

In the style of The Rochambeau Club — cream line art on the dark background. Use SVG. Suggestions:

- A wine cellar arch with bottle racks (hero background, very faint opacity ~0.06, large scale)
- A single wine bottle (decorative element in Section 4, alongside the story copy)
- Optional: a corkscrew or tastevin as a small decorative divider between sections

The art should feel architectural and understated — not illustrative or playful. Think blueprint meets fine dining menu.

---

## Gold Text — Sizing

Gold (`#C9851D`) text must be set at least 1–2 sizes larger than surrounding cream text to compensate for its lower contrast against the dark background. A gold word in a cream sentence should feel like emphasis, not an afterthought. Minimum 1.1× the surrounding font size; larger in headlines.

---

## Visual Richness

The page should feel more layered and atmospheric — less plain. Ideas to incorporate:

- **Section dividers:** Use a thin gold line or a small SVG ornament (tastevin, corkscrew, single vine) between sections — centered, subtle.
- **Dark Maroon cards:** Benefits in Section 3 should sit in `#1E0B10` cards with a faint cream border (`rgba(240,230,220,0.12)`) and 2px Rio Red top accent, not just plain text on background.
- **Rio Red left border accents:** Use a 3px Rio Red left border on pull quotes and step descriptions to add visual rhythm.
- **Texture:** Add a very subtle noise/grain texture overlay on section backgrounds (CSS or SVG filter) for depth — like aged parchment.
- **Section numbering in gold:** Section numbers (01, 02, 03) should be larger and more prominent — use them decoratively as background watermarks in the benefits grid.
- **Line art:** Ensure the cellar arch SVG in the hero is present and visible (opacity ~0.08). Add the wine bottle SVG to Section 4 as a decorative element.
- **Horizontal rules:** Between major content blocks, use a rule that blends cream and gold — not a plain `<hr>`.

---

## Animations

Add tasteful, non-distracting animations. Performance matters — use `will-change` sparingly and prefer CSS transitions over JS.

**On scroll (use Intersection Observer):**
- Fade-in + slight upward translate (20px → 0) on: section headings, benefit cards, step descriptions, story paragraphs. Stagger children by 100ms.
- The hero subheading lines should each animate in sequentially (100ms apart) on page load.

**Hover states:**
- Benefit cards: subtle scale (1.01) + slightly lighter background on hover. Transition 200ms.
- CTA buttons: Rio Red darkens slightly, small rightward nudge on the arrow (→). Transition 150ms.
- Step numbers (01, 02, 03): gold colour intensifies on hover.

**Mobile-specific:**
- Touch feedback on all tappable elements (`:active` state with 50ms background flash).
- Ensure animations are `prefers-reduced-motion` safe — wrap all motion in `@media (prefers-reduced-motion: no-preference)`.

---

## Customer-Facing Pages — Apply Consistent Design

Apply the same colour palette and typography to all customer-facing pages:

- `/join/*` (steps 1–5) — same dark background, cream text, Rio Red CTAs. The step forms should feel like part of the same experience as the landing page.
- `/ship` — same design
- `/billing` — same design
- `/authenticate` — same design
- `/privacy` — same dark background, cream text, clean readable layout
- `/terms` — same

The admin (`/admin/*`) keeps its existing functional styling — don't touch it.

---

## Membership Gate Copy

On the `/join` page, include a small line (not a checkbox, just copy):

> *The Cellar Club is for guests who've visited Crush or Norse.*

No technical enforcement — this is positioning language. If someone joins who hasn't visited, that's fine.

---

## Mobile

Everything must be fully responsive. The audience will primarily sign up on their phone (they're receiving a text). Priorities:

- Hero sign-up form stacks cleanly on mobile
- Tap targets are large enough (phone number input, join button)
- Text is readable without zooming
- Benefits grid goes to 1 column

---

## Implementation Notes for Claude Code

- All new pages go in `/app` (Next.js App Router)
- Landing page is `/app/page.tsx`
- Create `/app/globals.css` or extend Tailwind config with the colour variables
- Use `next/font/google` to load Cormorant Garamond and Inter
- The phone number input on the landing page should accept a UK number, pass it to `/join?phone=[number]` where the `/join` page pre-fills it
- Line art should be inline SVG components — clean and crisp at all sizes
- No external image dependencies — everything self-contained

---

*Design brief for The Cellar Club — Craig Lappin-Smith*
*Created: 2026-03-18*
