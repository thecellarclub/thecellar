# The Cellar Club — Revision Round 2

**For:** Claude Code
**From:** Julia
**Against:** the current build at `http://localhost:3001/`

This site should feel like a sophisticated, high-end, exclusive wine club. The current pass doesn't — revisions below. Where this conflicts with `DESIGN_BRIEF.md` or `REVISIONS_V1.md`, this document wins.

---

## 1. Display font — revert, don't experiment

The display font in the current build looks heavy and wrong for the brand. **Revert the headline font.**

Two options, pick whichever reads better at size:

1. **Preferred:** Use **Spectral in tracked uppercase** for the hero headline and section titles (see §7). Spectral is already loaded. This gives the "high-end, editorial, understated" feel. Sample treatment for the hero headline:
   - `text-4xl` to `text-5xl` on desktop, scaling down on mobile.
   - `uppercase`, `tracking-[0.18em]` to `tracking-[0.22em]`.
   - Weight 400 or 600 depending on how bold reads — lean lighter rather than heavier.
   - Dark text (`#1C0E09`) on cream background.

2. **Fallback** if the uppercase headline feels too shouty at the hero size: go back to **Cormorant Garamond** for the hero headline specifically — set in title case, light weight (300 or 400), not italic. Yes I said earlier Cormorant was overused as a display font, but the thick display font you picked is worse. Cormorant is better than that.

Do **not** use Fraunces, Playfair, DM Serif Display, or any other new serif display face. Remove any new display-font CSS variable added in V1.

The logo (see §2) is a separate concern — it comes from an image file now, not a webfont.

## 2. Logo — use the PNG file

- A logo file has been placed at `C:\thecellarclub\the cellar club logo.png`.
- **Move this file** to `public/logo.png` (Next.js won't serve files from the project root; it needs to live in `public/`).
- **Delete any inline SVG logo code from V1.** That attempt is not good enough — use the PNG.
- Render with Next.js `<Image>`:
  ```tsx
  import Image from 'next/image'
  // ...
  <Image
    src="/logo.png"
    alt="The Cellar Club"
    width={440}
    height={360}
    priority
    className="mx-auto h-auto w-[280px] md:w-[360px]"
  />
  ```
  Adjust the `w-*` classes so the logo sits at roughly 280–320px wide on mobile and 360–420px wide on desktop. The PNG has a cream background that should blend into the page background — confirm visually.
- Centred at the top of the page, with ~40–56px top padding and ~24–32px below it before the hero headline begins.
- No arch SVG, no background decoration behind it, no top nav. This logo is the only thing above the headline.

## 3. Section titles — bring back the divider treatment

Every major section should have a **small tracked-caps title above the section box**, styled like the reference image Julia shared. Use the existing Spectral sans, small (`text-xs`), uppercase, `tracking-[0.28em]`, muted colour (`rgba(42,24,16,0.65)`), with thin horizontal lines extending left and right.

The exact treatment from the old build (keep using this pattern):

```tsx
<div className="flex items-center gap-4 mb-7">
  <div className="flex-1 h-px" style={{ background: 'rgba(100,50,20,0.2)' }} />
  <p
    className="font-sans text-xs uppercase tracking-[0.28em] shrink-0"
    style={{ color: 'rgba(42,24,16,0.65)' }}
  >
    {title}
  </p>
  <div className="flex-1 h-px" style={{ background: 'rgba(100,50,20,0.2)' }} />
</div>
```

Important: use **Spectral** (`font-sans`) for these titles, not Cormorant. That's what the old build used and it's what Julia means by "that uppercase font".

Position the title **above each section's content** (i.e. above the Daniel's letter box, above the FAQ box, above the phone demo area, etc.). Julia's preference is above the box / below the divider — so the visual is: horizontal rule → title text → horizontal rule, then the section content (card, letter, FAQs, whatever) sits below.

Required section titles (pick appropriate concise labels):

- Hero / text-message demo: no title (headline is enough).
- Daniel's letter section: **FROM DANIEL** or **A LETTER** (Julia's call — default to `FROM DANIEL`).
- FAQ section: **GOOD TO KNOW**.
- Final CTA section: **JOIN THE CLUB** or **TEXT ME ANYTIME** — default to `JOIN THE CLUB`.

## 4. FAQ section — add the card background

The Daniel's-letter treatment (light-toned card, `CARD_BG = #F2EAE0`, 1px border `rgba(42,24,16,0.18)`) is working. **Apply the same card treatment to the FAQ section.**

- Wrap the FAQ list in the same card background + 1px border combo.
- Interior padding: roughly `px-8 py-10` on desktop, `px-6 py-8` on mobile.
- The FAQ items themselves (questions with `<details>`/`<summary>`, expand indicators, divider lines between items) stay styled as they are — just wrap the whole group in the card.
- Size applies per V1 §10 (question ~18–19px, answer ~17–18px, muted body colour on answers).

Do the same card treatment for any other major content section that isn't already in a card, so the page reads as a rhythm of titled cards on the cream background. Current build should end up with: logo → hero (no card) → phone demo (no card, or a light card — designer's call) → Daniel's letter card → FAQ card → final CTA (no card, centred text).

## 5. Subheading copy — shorten the first sentence

Change the subheading's first line from:

> ~~Get direct access to Daniel (formerly of the 2 Michelin star Raby Hunt).~~

To:

> **Get direct access to Daniel — formerly at the 2 Michelin star Raby Hunt.**

Use an em-dash, not parentheses. The rest of the subheading (sentence-per-line, not italic) stays as per V1 §5. Final subheading reads:

> Get direct access to Daniel — formerly at the 2 Michelin star Raby Hunt.
>
> Every week he'll send you two exceptional finds.
>
> Text him anytime to ask a question, request something rare, or grab his latest pick.
>
> We cellar everything for free and ship whenever you fill a case.

## 6. Form — stop repeating the label

Current build shows "Your mobile number" twice — once as a label above the input, once as placeholder or inside the input. **Drop the external label entirely.**

- Remove the tracked-caps "Your mobile number" text that sits above the input.
- Inside the input field, use the **same tracked-caps Spectral uppercase style** as the placeholder / inline label. So the only "mobile number" affordance is the styled placeholder inside the input.
- Keep the `+44` prefix chip to the left of the input.
- Keep the submit button beside it.

Applies to both the hero form and the footer form.

## 7. CTA button copy — differentiate the two

- **Hero CTA button:** `JOIN THE CLUB (FREE) →`
- **Footer CTA button:** `GET YOUR FIRST TEXT →`

Both buttons use tracked-caps Spectral (V1 §6 stands — uppercase, `tracking-[0.22em]` or so, `text-sm`). Same red background (`#9B1B30`), same cream text, same hover translate on the arrow.

Note: V1 had these the other way round. V2 overrides — hero is "JOIN THE CLUB (FREE)" because the "(FREE)" signals no barrier to entry, which matters most at the top of the page. Footer is "GET YOUR FIRST TEXT" as the more direct, warmer call after the letter.

## 8. Section ordering sanity check

Top to bottom, after this revision:

1. Logo (centred, PNG, ~280–420px wide)
2. Hero headline + subheading (sentence-per-line, non-italic)
3. Phone-number form (no external label, placeholder inside, tracked-caps) + **JOIN THE CLUB (FREE) →** button, with small "Already a member? Log in" underneath
4. Animated text-message demo (pacing per V1 §4)
5. Divider-with-title: **FROM DANIEL**
6. Daniel's letter card (cream card, border) — copy per V1 §8 and §9
7. Divider-with-title: **GOOD TO KNOW**
8. FAQ card (cream card, border, items with `<details>`)
9. Divider-with-title: **JOIN THE CLUB**
10. Final CTA — "Ready when you are." + phone form + **GET YOUR FIRST TEXT →** button
11. Footer (unchanged)

---

## Summary checklist for Claude Code

- [ ] Revert the heavy display font. Use Spectral uppercase (preferred) or Cormorant for the hero headline. Remove any new display-font config.
- [ ] Move `the cellar club logo.png` from project root to `public/logo.png`. Render with `<Image>` at the top of the page, centred. Delete the inline SVG logo attempt.
- [ ] Add the horizontal-rule + tracked-caps title treatment above each major section (Daniel's letter, FAQ, final CTA).
- [ ] Wrap the FAQ list in a `CARD_BG` card with the same border as Daniel's letter.
- [ ] Update the first line of the subheading to "Get direct access to Daniel — formerly at the 2 Michelin star Raby Hunt."
- [ ] Remove the external "Your mobile number" label. Keep the tracked-caps style as placeholder inside the input only.
- [ ] Hero button: `JOIN THE CLUB (FREE) →`. Footer button: `GET YOUR FIRST TEXT →`.
- [ ] All section titles use Spectral (`font-sans`), uppercase, `tracking-[0.28em]`, muted.

Everything from V1 that isn't contradicted above stands.
