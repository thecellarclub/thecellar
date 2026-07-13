# The Cellar Club — Homepage Redesign Brief

**For:** Claude Code
**From:** Julia
**Scope:** Rebuild `app/page.tsx` (homepage only). All existing routes, auth, Twilio/Stripe flows, admin area and portal remain untouched. The signup form should continue to post a phone number to `/join?phone=...` exactly as it does today.

---

## 1. Goal

The current homepage reads like a menu at a wine bar. It's pretty, but new visitors don't immediately grasp *what the thing is* — that it's a personal sommelier in your texts, with free cellaring. The redesign should:

1. Lead with a headline that makes the proposition obvious in one sentence.
2. Feel personal — like Daniel is actually on the other end of the line, not a brand.
3. Show, don't tell: demonstrate the texting experience with an example exchange.
4. Push the detailed "menu" content (tiers, FAQs) below the fold or into progressive disclosure so the top of the page is clean and persuasive.

Keep the existing palette and typography (see §8). No new colours, no new fonts.

---

## 2. Page structure (top to bottom)

### Section 0 — Header (new, replaces the big arch logo)

- Small logo at the top of the page. Use the existing "theCELLARclub" wordmark treatment but shrink it substantially: the "CELLAR" wordmark should be roughly `text-2xl` / 24–28px, with the tiny "the" and "club" tracked caps above and below as today. Left-aligned or centred — designer's call, but keep it understated.
- The cellar-door arch SVG (`CellarDoorSvg`) should be removed from the header or significantly scaled down and moved to the background of the hero. It's currently dominating the page.
- Right side of the header: a single small "Log in" link to `/portal` (replaces the current "Already a member? Log in here" that lives under the signup form).

### Section 1 — Hero: headline, sub, animated text exchange, CTA

Two-column on desktop, stacked on mobile. Left column (or top on mobile) is text; right column is the animated phone/text demo.

**Headline (exact copy):**
> Imagine texting your personal sommelier.

Serif, large — use Cormorant Garamond in roughly the 48–64px range on desktop, scaling down on mobile. Dark text (`#1C0E09`) on cream background.

**Sub-headline (exact copy):**
> Get direct access to Daniel (formerly of the 2 Michelin star Raby Hunt). Every week he'll send you two exceptional finds. Text him anytime to ask a question, request something rare, or grab his latest pick. We cellar everything for free and ship whenever you fill a case.

Serif, italic, ~18–20px, muted (`rgba(42,24,16,0.72)` — matches the existing italic tagline colour).

**Example text exchange (animated):**
Render as an iPhone-style iMessage thread. This is the showpiece of the hero. It should animate on load (and optionally loop, or replay when scrolled back into view). Use the existing `FadeUp` pattern as a reference for animation style but build a purpose-built component for the messages.

Animation sequence:
1. Incoming bubble (grey, left-aligned) appears with a brief typing-dots indicator first, then the message swaps in:
   > Just found a killer skin-contact white from Slovenia — Movia Rebula, wild ferment, tastes like orchard fruit and sea air. Only 24 bottles.
2. Outgoing bubble (red — use the existing `#9B1B30` or a lighter variant for legibility) appears as a user reply:
   > 2
3. Incoming confirmation bubble:
   > Done — 2 bottles of the Movia put aside for you. You're 7 away from a free case.
4. A short beat (~1.5s), then outgoing bubble:
   > Can you help me with a special 60th birthday present for someone who loves Barolo?
5. Incoming typing-dots, then fade to the start of the loop (or hold).

Styling: rounded message bubbles, timestamps optional, iOS-style. The phone frame itself should be subtle — a simple rounded rectangle in the cream/card colour with a thin border (`rgba(42,24,16,0.18)`, matching the existing card border). No chrome-heavy mockups; this should feel editorial, not techy.

Respect `prefers-reduced-motion`: show the messages statically in that case, same as the existing `FadeUp` component does.

**CTA (primary):**
Same phone-number input as today, but with revised button copy. Keep the `+44` prefix, the `tel` input, and the submit handler that routes to `/join?phone=...`.

Button copy: **"Get your first text →"**

Below the form, do *not* duplicate the "Already a member? Log in here" link — it lives in the header only (see §2 Section 0) to keep the hero clean.

### Section 2 — Daniel's letter

Full-width but text constrained to ~640px max-width, centred. Serif body (Cormorant Garamond), ~18–19px, generous leading (~1.7).

Above the letter: a small header — `"A note from Daniel"` or similar, in the existing tracked-caps style (12px, `tracking-[0.28em]`, muted colour).

**Body copy (exact, with one light edit to remove the accidental duplicate opening line):**

> Tickety boo. I'm Daniel. I've worked in wine for twenty years — sommelier at the 2-star Raby Hunt, all that. Although it's hard to call yourself a sommelier without coming across like a complete tw\*\*. Forget the labels. All you really need to know is I bloody love wine. Not the poncy, swirl-and-spit, guess-the-vintage kind. The kind where you open something on a Tuesday night and it makes you stop and go "…what is that?" That's the feeling I chase. That's what I text you about.
>
> Twice a week, you'll get a message from me. Not a newsletter — an actual text, from my actual phone. Two wines I'm genuinely excited about. Could be a Georgian amber wine that smells like your nan's garden. Could be something from a tiny producer in the Jura who only makes 200 cases a year. Could be a Texas red that has no business being as good as it is. I import a lot of this stuff directly, so you're getting prices most people can't.
>
> Here's the thing that makes this different: you can text me back. Got a question? Ask. Want a recommendation for a dinner party? I'll sort it. Looking for a specific bottle? Tell me and I'll find it — and if enough of you want the same thing, we'll do a group buy and get it at a price that'd make a merchant weep.
>
> Me and Craig opened Crush wine bar in Durham a couple of years ago. Just got the keys to our second place, and it's got a proper cellar underneath. So your wine lives there, climate-controlled, no charge, until you've filled a case. Then we ship it to you for free.
>
> This kind of access — a direct line to someone who knows every winemaker worth knowing, free storage, direct import prices — it's usually reserved for people with land, lineage and names like Tarquin. We wanted to change that.
>
> So welcome. Your cellar's ready. Text me anytime.
>
> — Daniel

Note: Julia's original draft had "All you need to know is I bloody love wine." *and* "All you really need to know is I bloody love wine." back-to-back. I've kept the second, longer version in the brief above since it flows better. Flag if you disagree.

Signature: "— Daniel" as the last line, in italic, slightly muted. Optional nice-to-have: a handwritten-style signature image, but only if we can find one that doesn't feel naff. Default to typeset if unsure.

Note on the letter copy: Julia's original draft had two near-identical sentences back-to-back ("All you need to know is I bloody love wine." followed by "All you really need to know is I bloody love wine."). The longer, second version has been kept in the canonical copy above — this is final, not a question.

Wrap the letter in a light-toned card using the existing `CARD_BG` (`#F2EAE0`) with the existing 1px border — same feel as the current menu card, so it ties visually to what returning visitors know.

### Section 3 — Practical details / FAQs (expandable)

Header: `"Good to know"` or `"Common questions"` in the same tracked-caps style used elsewhere.

Use native `<details>`/`<summary>` for accessibility and zero-JS expandability, or build a small React accordion if you want a cleaner animation. Only one open at a time is fine but not required.

Exact questions and answers to include (pulled and rewritten from the current page content):

1. **How much does it cost to join?**
   Nothing. The Cellar Club is free to join — you just need to have bought at least one bottle through us to unlock the benefits. Tier perks (more concierge access, tasting tickets, discounts) scale with your rolling twelve-month spend. [See tiers] → link or inline expand to tier detail (see §4).

2. **How does delivery work?**
   Free once you fill a case (12 bottles). If you want something sooner, you can ship early for a flat £15.

3. **Why use The Cellar Club instead of a normal wine shop?**
   Better prices and better wines. We buy in volume across both our wine bars and pass the direct-import rates on to you. Most of what we stock isn't on supermarket shelves — it's sourced directly from small producers Daniel knows personally.

4. **Can you help me source a specific bottle?**
   Yes. Text Daniel with what you're after. If we can find it, we'll run an offer to the whole club — if enough members are in, everyone gets it at the group-buy price.

5. **How is this different from a wine club?**
   Normal wine clubs send you a box of whatever they've decided on that month. We send you individual offers by text, you choose which (if any) you want, and your bottles are stored for free until you've got enough for a case. You're also texting a real person, not a subscription form.

6. **What does Daniel actually send?**
   Two wines a week, chosen by him. Range varies wildly — could be a £12 everyday drinker, could be a £60 one-off from a producer who only makes a few hundred cases. All of them are wines Daniel would happily pour for himself.

Style: compact. Question in serif ~18px (dark), answer in serif ~16px (muted `rgba(42,24,16,0.72)`). Thin divider line between items (`rgba(42,24,16,0.18)`, same as existing dotted/solid rules on the current page).

### Section 4 — The Club (tiers) — move to a dedicated page

The current page gives tiers a lot of real estate. Don't do that on the new homepage.

Move the tier table to a dedicated page at `/club` (new file: `app/club/page.tsx`). On the homepage, link to it from the pricing FAQ ("See tiers") and optionally from a one-line mention near the end of Daniel's letter area if it reads naturally.

The new `/club` page should reuse the existing tier markup structure (Elvet / Bailey / Palatine with their `PerkEntry` rows from `app/page.tsx` lines ~346–373) in the same visual style as the current card. Header: "Membership tiers". Same cream background, same card treatment, same border tokens. Add a small "← Back to home" link at the top.

Key things the tier display must communicate:
- Free to join, but perks require purchases.
- Concierge requests are not unlimited at every tier — Elvet gets 2/month, Bailey gets 5/month, Palatine is unlimited. This is important expectation-setting.

### Section 5 — Repeat CTA

Same phone-input form as the hero, centred, with fresh copy so it doesn't feel like a duplicate.

Copy above the form:
> Ready when you are.

Button text: **"Text me anytime →"** (pairs with Daniel's sign-off "Text me anytime" immediately above in the letter).

Same `+44` prefix, same routing to `/join?phone=...`.

### Section 6 — Footer

Keep the existing footer content (company number, licensing, age statement, Privacy / Terms links). No changes needed.

---

## 3. Visual & interaction notes

- **Layout:** Move off the rigid "one narrow card contains everything" pattern. The homepage should breathe more — hero takes full page width (with a sensible max-width around 1100–1200px for the two-column layout), Daniel's letter sits in a centred column, FAQs are full-width at ~720px max. The card-with-border treatment is still fine for the letter and the tiers, but shouldn't wrap the entire page anymore.
- **Whitespace:** Generous vertical rhythm between sections — ~96–120px on desktop, ~64px on mobile.
- **Animations:** Reuse the existing `FadeUp` helper for section reveals. The text-message animation is the one place to invest in something more bespoke.
- **Mobile first:** Hero should stack cleanly — headline, sub, text-demo (scaled down), CTA. The text-demo can be a little smaller on mobile but shouldn't be cut.
- **Accessibility:** All interactive elements keyboard-reachable. Animations respect `prefers-reduced-motion`. FAQs should be real `<details>` or properly ARIA-tagged.

---

## 4. What to leave alone

- The signup flow (`/join`, `/join/verify`, `/join/details`, `/join/address`, `/join/card`, `/join/confirmed`).
- The member portal (`/portal`, `/portal/verify`, `/portal/dashboard`).
- All admin pages and API routes.
- The Twilio/Stripe integrations.
- The metadata (`app/layout.tsx` — title, description).
- The fonts loaded in `layout.tsx` (Cormorant Garamond + Spectral).

One small `layout.tsx` tweak may be needed: the body currently has `bg-maroon text-cream` classes which set a dark background. The current homepage overrides this with its own cream `PAGE_BG` inline. If the new homepage continues to set its own background inline, `layout.tsx` can stay as-is. If you refactor to use CSS variables at the body level, make sure the `/join`, `/portal`, etc. routes still render correctly — some of them may rely on the dark body background.

---

## 5. Technical notes

- Stack: Next.js App Router, TypeScript, Tailwind v4 (via `@import "tailwindcss"` in `globals.css`), Tailwind's custom theme tokens defined in `globals.css` (`--color-maroon`, `--color-rio`, `--color-cream`, `--color-gold`).
- Existing homepage is a client component (`'use client'`). The redesign will likely also be a client component because of the message animation and form handling — that's fine.
- Keep the file at `app/page.tsx`. If the animated text-message component gets long, extract it to `app/_components/TextDemo.tsx` (new folder mirroring the existing `app/admin/_components/` pattern).
- No new dependencies unless needed for the animation. Framer Motion would be ideal if you want polish, but plain React state + CSS transitions is acceptable and keeps the bundle small.
- Reuse the existing `FadeUp` component — extract it to `app/_components/FadeUp.tsx` so both `page.tsx` and any new `/club` page can import it.

---

## 6. Copy Julia has signed off

The following strings are final and should be used verbatim (modulo the one duplicate-sentence note above):

- Headline: *Imagine texting your personal sommelier.*
- Sub: *Get direct access to Daniel (formerly of the 2 Michelin star Raby Hunt). Every week he'll send you two exceptional finds. Text him anytime to ask a question, request something rare, or grab his latest pick. We cellar everything for free and ship whenever you fill a case.*
- Daniel's letter (as quoted in §2, section 2).
- The six FAQ questions and answers (as listed in §2, section 3).

---

## 7. Palette & type reference

Take all values from `app/globals.css` and the existing `app/page.tsx`. For convenience:

| Token | Value | Use |
|---|---|---|
| Page background | `#E6D9CA` | Default page bg |
| Card background | `#F2EAE0` | Letter card, tier card |
| Text dark | `#1C0E09` | Headlines, primary copy |
| Text muted | `rgba(42,24,16,0.72)` | Body copy |
| Text faint | `rgba(42,24,16,0.38–0.45)` | Captions, tracked caps |
| Accent red | `#9B1B30` | CTAs, prices, outgoing text bubbles |
| Border | `rgba(42,24,16,0.18)` | Card borders, dividers |
| Serif | Cormorant Garamond (`--font-cormorant`) | Headlines, body |
| Sans | Spectral (`--font-spectral`) | CTAs, small caps, form inputs |

Julia has said she likes the current colour scheme — don't introduce anything new.

---

## 8. Definition of done

- Homepage reflects the new section order (header → hero with animated demo → Daniel's letter → FAQs → repeat CTA → footer).
- Logo is visibly smaller and lives at the top of the page, not inside a dominant arch graphic.
- Hero CTA button reads "Get your first text →". Footer CTA button reads "Text me anytime →".
- Both CTAs route to `/join?phone=...` exactly as the current form does.
- The animated text exchange runs on load, respects reduced-motion, and looks good on mobile.
- Tiers have been moved to a new `/club` page and linked from the pricing FAQ.
- All existing routes still work; no backend changes.
- Lighthouse mobile score doesn't regress.
