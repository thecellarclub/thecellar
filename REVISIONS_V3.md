# The Cellar Club — Revision Round 3

**For:** Claude Code
**From:** Julia
**Against:** the current build at `http://localhost:3001/`

Overrides V1 and V2 where they conflict.

---

## 1. Logo — 50% smaller

Halve the displayed size of the logo. It should now render at roughly **140–180px wide on desktop** and **120–140px wide on mobile**. Keep it centred, keep it as the `<Image>` rendered from `public/logo.png` (no inline SVG).

```tsx
<Image
  src="/logo.png"
  alt="The Cellar Club"
  width={440}
  height={360}
  priority
  className="mx-auto h-auto w-[130px] md:w-[160px]"
/>
```

Adjust the `w-*` by eye if needed, but don't exceed 180px wide on desktop.

## 2. Page background — match the logo background

The logo PNG has a warm off-white/ecru background. The current page background (`#E6D9CA`) is noticeably darker/pinker than the logo's background, which is why the logo's box edge is visible against the page.

- Sample the corner pixels of `public/logo.png` and use that exact colour as the page background.
- Best eyeball match is around **`#F0EAE0`** (warm cream/ecru). If sampling the PNG gives a slightly different value, use the sampled value.
- Update `PAGE_BG` in `app/page.tsx` (and wherever the body/page background is set — possibly `app/globals.css`) to this new value.
- The existing `CARD_BG` (`#F2EAE0`) used for Daniel's letter and the FAQ card is very close to the new page background. Nudge `CARD_BG` a shade lighter or warmer (e.g. `#F7F1E8`) so the cards still visually differentiate from the page. The card border (`rgba(42,24,16,0.18)`) stays.

Verify: after the change, you should not see a rectangular seam where the logo image meets the page background.

## 3. Heading font — match the logo wordmark

The "CELLAR" wordmark in the logo is a high-contrast serif (Julia believes it's Cormorant Garamond, which is already loaded). Match that.

- Use **Cormorant Garamond** for the hero headline.
- Set it in **uppercase**, with **letter-spacing** around `tracking-[0.06em]` to `tracking-[0.08em]` to mirror the tight, slightly-spaced feel of the logo wordmark.
- Weight: lean light — try `font-weight: 400` first, move to `300` if it reads too heavy at size.
- Size: `text-3xl` to `text-4xl` on desktop, scaling down on mobile. Don't go enormous — the logo is small now, so the headline shouldn't dwarf it.
- Colour: `#1C0E09` (dark, not muted).

So the headline now reads: **IMAGINE TEXTING YOUR PERSONAL SOMMELIER.**

Remove any Spectral-uppercase headline treatment from V2 and any leftover Fraunces/DM Serif/Playfair config. The only display choice for the hero headline is Cormorant uppercase.

## 4. Subheading — new copy and a line break

Replace the current subheading with:

> Get direct access to Daniel Jonberger — former sommelier at the 2 Michelin star Raby Hunt. Every week he'll send you two exceptional wines.
>
> You can text him anytime to ask a question, request something rare or secure his latest pick. We cellar everything for free and ship whenever you fill a case.

Structure: **two paragraphs**, with a visible line break between them (use two separate `<p>` tags or a `<br /><br />` — however you're currently doing the sentence breaks, just make it two blocks instead of four).

Styling:
- Not italic.
- Serif (Cormorant Garamond body).
- **Colour: black (`#1C0E09`)** — not the muted `rgba(42,24,16,0.72)`.
- Size ~18–20px.

## 5. Body copy colour — all black

Julia wants all body copy in black (`#1C0E09`), not the muted `rgba(42,24,16,0.72)` that's currently used across the subheading, letter, and FAQ answers.

- Daniel's letter: body paragraphs change from muted to `#1C0E09`.
- FAQ answers: muted → `#1C0E09`.
- Subheading: muted → `#1C0E09` (same change as §4).
- Exception: **small-caption type stays muted** (the tracked-caps section titles, the "Already a member? Log in" line, the footer legal copy — these keep their current faint colours). The rule applies to *body copy only*.

## 6. CTA + input — smaller type, wider input

The tracked-caps on the phone input placeholder and the CTA button currently reads too big/chunky.

- Reduce the font size on the button and on the input's placeholder to roughly **`text-xs` (12px)** or `text-[11px]`, keeping the `uppercase tracking-[0.22em]` treatment and Spectral.
- The input itself (the typed phone number, once the user starts typing) should remain readable — drop it to ~14–15px, not uppercase, not tracked. So placeholder is styled tracked-caps but the user-typed value is normal.
- **Make the phone number input field slightly wider.** On desktop, the form is currently `max-w-md` (~28rem). Bump the phone input's `flex-1` area by increasing the overall form width to `max-w-lg` (~32rem), or keep the form width and reduce the button's horizontal padding so the input gets more room. Target: enough width to show a full UK mobile number (`+44 7700 900000`) without feeling cramped.

Applies to both the hero form and the footer form.

## 7. Hero CTA text — change back to "Join the club"

Reversing V2 §7 for the hero button only.

- **Hero CTA button:** `JOIN THE CLUB →` (drop the "(FREE)" — the "Nothing" answer in the FAQ covers that; Julia wants the button cleaner).
- **Footer CTA button:** `GET YOUR FIRST TEXT →` (unchanged from V2).

Both still tracked-caps Spectral, per §6 sizing.

## 8. Section padding — tighten and balance

The current build has noticeably more space at the bottom of each section than at the top, which makes sections feel saggy. Make the vertical padding **equal top and bottom** on every section, and **reduce the total** vs. current.

- Target: ~64–80px top and bottom on desktop (not the current ~96–120px at the bottom).
- ~48px top and bottom on mobile.
- This applies to every major section block: hero, phone demo, Daniel's letter card, FAQ card, final CTA.
- If a section's content has its own interior padding (e.g. the card's `px-8 py-10`), reduce that too so the visual rhythm between sections is consistent and not puffy.

## 9. Dividers — narrower

The horizontal rules on either side of each section's tracked-caps title (V2 §3) are too long and making the page feel stretched.

- Measure the rendered width of the "JOIN THE CLUB" title text (tracked-caps, `text-xs`, `tracking-[0.28em]`). This is the target width.
- The flanking horizontal rules on either side of each title should each be roughly that width — so the **total divider** (rule + gap + title + gap + rule) spans about **3× the title width**, not the full card/page width.
- Implementation: change the rule elements from `flex-1 h-px` to fixed widths like `w-24` to `w-32` (adjust to eye). Keep the rule colour (`rgba(100,50,20,0.2)`) and the gap (`gap-4`).

Apply this to *every* section-title divider on the page.

## 10. Divider title change — "A NOTE FROM DANIEL"

Rename the `FROM DANIEL` divider title to **`A NOTE FROM DANIEL`**. Tracked-caps, Spectral, same styling as the other section titles.

## 11. Letter — remove the opener

Delete the first sentence of Daniel's letter. The letter now starts cold at "I've worked in wine for twenty years…".

Replace:

> ~~Tickety boo. I'm Daniel. I've worked in wine for twenty years — sommelier at the 2-star Raby Hunt, all that.~~

With:

> I've worked in wine for twenty years — sommelier at the 2-star Raby Hunt, all that. Although it's hard to call yourself a sommelier without coming across like a complete tw\*\*.

The rest of the letter (from "All you really need to know is I bloody love wine." onwards) is unchanged.

---

## Summary checklist

- [ ] Logo displayed width halved (~130px mobile / ~160px desktop).
- [ ] Page background switched to the logo's background colour (sample from `public/logo.png`; `#F0EAE0` is a good starting point). Nudge `CARD_BG` lighter so cards still read as cards.
- [ ] Hero headline set in Cormorant Garamond uppercase, light weight, dark colour, modest size. Remove any Spectral-uppercase / Fraunces / Playfair headline treatment.
- [ ] Subheading copy replaced with the two-paragraph version in §4, colour `#1C0E09`, not italic.
- [ ] All body copy (subheading, letter, FAQ answers) switched to black `#1C0E09`. Small-caption type stays muted.
- [ ] Input placeholder and CTA buttons: smaller tracked-caps (`text-xs` or `text-[11px]`). Typed phone number stays readable (~14–15px, not uppercase). Phone input field slightly wider.
- [ ] Hero button reads `JOIN THE CLUB →`. Footer button stays `GET YOUR FIRST TEXT →`.
- [ ] Section vertical padding reduced and balanced (equal top and bottom, ~64–80px desktop / ~48px mobile).
- [ ] Divider horizontal rules narrowed — each rule ~the width of the title text, total divider ~3× the title width.
- [ ] Daniel's letter section title renamed to `A NOTE FROM DANIEL`.
- [ ] Delete "Tickety boo. I'm Daniel." — letter opens at "I've worked in wine for twenty years…".

Anything not listed above stays as it is in the current build.
