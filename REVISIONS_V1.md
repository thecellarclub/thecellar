# The Cellar Club — Revision Round 1

**For:** Claude Code
**From:** Julia
**Against:** the current build at `http://localhost:3001/` (the first pass against `DESIGN_BRIEF.md`)

The first pass is close. Revisions below. Apply all of them. Where an item conflicts with `DESIGN_BRIEF.md`, the revision below wins.

---

## 1. Header / nav

- **Remove the navbar entirely.** No wordmark in the top-left, no "Log in" link in the top-right. The whole top strip goes.
- In its place, the new logo (see §2) sits centred at the top of the page.
- Bring back the small **"Already a member? Log in"** line directly underneath the hero's phone-number form (small, muted serif italic — same treatment as the original pre-redesign site). That's the only login entry point on the homepage.

## 2. Logo — inline SVG, centred at top

- **Remove the existing `CellarDoorSvg` background from the hero area.** It's doing too much. Delete it from the page.
- Replace the current small "theCELLARclub" wordmark with an **inline SVG recreation of the reference logo** (Julia's reference image: rounded arch outline with "THE / CELLAR / CLUB" wordmark centred inside it, with a small double-circle door-handle detail on the right side of the arch).
- Build it as inline SVG/HTML — no external image file needed. Tailwind + SVG primitives only.
- Layout specifics:
  - Centred horizontally on the page.
  - Sits at the top of the page with generous top padding (~48–64px desktop, ~32px mobile).
  - Overall logo height roughly 140–180px on desktop, scaling down proportionally on mobile (~110–130px).
  - The arch outline should be a thin stroke (~1–1.5px) in a muted warm brown — use a subtle tone like `rgba(42,24,16,0.35)` so it recedes behind the wordmark.
  - "THE" sits in tracked caps inside the top of the arch (small, ~10–11px).
  - "CELLAR" is the dominant wordmark — serif, large, dark (`#1C0E09`). See §3 for the font choice.
  - "CLUB" sits below, tracked caps, small (~11–13px).
  - The double-circle "door handle" on the right-hand vertical of the arch is decorative — keep it subtle, same stroke colour as the arch.
- This logo block is the *only* thing that appears before the headline. No other chrome above it.

## 3. Typography — new display font

- Cormorant Garamond is overused on the web as a display face. **Keep it for body copy only.**
- For headlines, the logo "CELLAR" wordmark, and any other large display text, pick a more distinctive serif. Load via `next/font/google` in `app/layout.tsx` alongside the existing fonts.
- Preferred options (pick the first one you think feels right for a wine bar that's warm and a bit cheeky, not stuffy):
  1. **Fraunces** — contemporary, slightly quirky, lots of character at large sizes. Strong first choice.
  2. **DM Serif Display** — high-contrast, elegant, a bit more classical.
  3. **Playfair Display** — only if the above two don't land; it's more common but reliable.
- Add a new CSS variable in `globals.css` (e.g. `--font-display`) and apply it to:
  - The logo "CELLAR" wordmark
  - The hero headline ("Imagine texting your personal sommelier.")
  - Any section headers if they're currently using Cormorant at large sizes
- Body copy, Daniel's letter, FAQ questions/answers, and the menu-style text stay on Cormorant Garamond as today.

## 4. Text-message animation timing

The "2" reply is fine as-is — it's short and mimics a quick tap.

Slow down the **longer incoming/outgoing messages** so users have time to read them *and* so the pacing feels like someone actually typing. Guidance:

- Typing-dots indicator for an incoming message: show for **~1.2–1.6s** before the message appears (not the current near-instant flash).
- Once a message appears, **hold it on screen for ~3.5–5s** before advancing to the next step, scaled to message length. Rough rule: ~60ms per character, minimum 3s, maximum 6s.
- The outgoing "2" can appear almost immediately (as if the user tapped) and can hold briefly (~1.5s) before the confirmation comes in.
- Outgoing "Can you help me with a special 60th birthday present…" — this one should feel typed: show a brief typing state (~0.8s) and then the full bubble, then hold ~4s.
- Total loop length should land somewhere around 20–26 seconds, not the current ~10–12.

Keep the `prefers-reduced-motion` fallback as-is (all messages static).

## 5. Subheading — no italics, sentence-per-line

Current subheading is a single italic block. Change to:

- **Not italic.** Roman/upright serif, same family as body (Cormorant Garamond is fine) or the display font — designer's call, but *not italic*.
- **Break to a new line after each sentence.** Use real line breaks (`<br />` or separate `<p>` tags), not CSS word-wrap. Rendered like this:

> Get direct access to Daniel (formerly of the 2 Michelin star Raby Hunt).
>
> Every week he'll send you two exceptional finds.
>
> Text him anytime to ask a question, request something rare, or grab his latest pick.
>
> We cellar everything for free and ship whenever you fill a case.

Keep the same muted colour (`rgba(42,24,16,0.72)`) and size (~18–20px).

## 6. Form labels / CTA button — use the tracked-caps sans

The small tracked-uppercase treatment currently used for "A note from Daniel" (Spectral sans, `text-xs`, `uppercase`, `tracking-[0.28em]`, muted) — apply that same treatment to:

- The **"Your mobile number"** label above or inside the phone input (both hero and footer CTAs).
- The **CTA button text** itself ("Get your first text" and "Text me anytime"). So the button reads `GET YOUR FIRST TEXT →` in tracked caps, not sentence case.
- Button font-size can step up to `text-sm` so it doesn't look too tiny inside a chunky button, but keep the letter-spacing and uppercase.

Retain the `→` arrow and the hover translate.

## 7. Daniel's letter — remove the pre-amble label

- **Remove the "A note from Daniel" small-caps header above the letter.** It's redundant with the opening line.
- The letter now starts cold with *"Tickety boo. I'm Daniel."* That's fine — it works as the opener.

## 8. Daniel's letter — paragraph break at "Forget the labels"

In the current first paragraph, change the structure so that **"Forget the labels."** is deleted, and a new paragraph starts at that point. Final first two paragraphs read:

> Tickety boo. I'm Daniel. I've worked in wine for twenty years — sommelier at the 2-star Raby Hunt, all that. Although it's hard to call yourself a sommelier without coming across like a complete tw\*\*.
>
> All you really need to know is I bloody love wine. Not the poncy, swirl-and-spit, guess-the-vintage kind. The kind where you open something on a Tuesday night and it makes you stop and go "…what is that?" That's the feeling I chase. That's what I text you about.

Everything after that stays the same, *except* the Craig paragraph — see §9.

## 9. Daniel's letter — rewrite the Crush paragraph

Replace the current paragraph:

> ~~Me and Craig opened Crush wine bar in Durham a couple of years ago. Just got the keys to our second place, and it's got a proper cellar underneath. So your wine lives there, climate-controlled, no charge, until you've filled a case. Then we ship it to you for free.~~

With:

> I opened Crush wine bar in Durham a couple of years ago — just got the keys to a second place, and it's got a proper cellar underneath. So your wine lives there, climate-controlled, no charge, until you've filled a case. Then we ship it to you for free.

(Drops Craig, switches to first person singular, uses em-dash between the two clauses, and "a second place" rather than "our second place".)

## 10. FAQ copy size

FAQ questions and answers currently render a touch small. Bump up:

- FAQ question (the `<summary>` or button text): from its current size to **~18–19px**, serif, medium weight if using Cormorant.
- FAQ answer body: from its current size to **~17–18px**, serif, muted colour (`rgba(42,24,16,0.72)`) — same as the letter body.
- Keep the thin dividers between items.
- Keep the `+` / `−` indicator but make sure it scales with the new type size.

---

## Summary checklist for Claude Code

- [ ] Remove the top nav (wordmark + Log in).
- [ ] Delete the background arch from the hero.
- [ ] Build an inline SVG logo (arch + THE/CELLAR/CLUB + door-handle), centred at the top.
- [ ] Add a display font (Fraunces preferred) via `next/font/google`. Use it for logo, headline, and display text only. Body stays on Cormorant Garamond.
- [ ] Slow down the text-message animation (rules in §4).
- [ ] Subheading: upright (non-italic), sentence-per-line.
- [ ] Add "Already a member? Log in" under the hero form in small muted italic. Remove the header log-in link.
- [ ] Use tracked-caps Spectral for the "Your mobile number" label and for both CTA buttons.
- [ ] Remove the "A note from Daniel" label above the letter.
- [ ] Start a new paragraph at what is currently "Forget the labels." — and delete that sentence. See §8.
- [ ] Rewrite the Crush paragraph per §9 (no Craig, first person, "a second place").
- [ ] Bump FAQ question and answer font sizes per §10.

Everything not listed above should stay as it is in the current `localhost:3001` build.
