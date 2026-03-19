# Claude Code Prompt — Landing Page Visual Overhaul v2

All changes are to `app/page.tsx` only unless stated otherwise. Do not touch the admin panel.

---

## 1. Maroon everywhere — remove alternating backgrounds

Currently sections alternate between `bg-maroon` (#120608) and `bg-maroon-dark`. Remove the alternation. Make `bg-maroon` (#120608) the background for every section, divider, and the footer. The only thing that should use a different background is the benefit cards and tier cards (which use `#1E0B10` as their card background — keep that).

Specifically: every `bg-maroon-dark` class on `<section>` and `<div>` elements in page.tsx should become `bg-maroon`.

Also check `tailwind.config.ts` to confirm `maroon` is defined. If `maroon-dark` is also defined, leave it in the config (it may be used elsewhere) but it should no longer appear in page.tsx.

---

## 2. Increase font sizes and contrast — text is too small and dim

Make the following changes globally across page.tsx:

- All body copy that is currently `text-sm` → change to `text-base` (16px)
- Paragraph/description text at `text-cream/55` or `text-cream/60` → increase to `text-cream/75`
- Body text in the three How It Works steps (currently `text-cream/60 text-sm`) → `text-cream/75 text-base`
- Tier benefit list items (currently `text-sm text-cream/65`) → `text-base text-cream/80`
- The small label text at the bottom of tier boxes (currently `text-xs text-gold/50` and `text-cream/30`) → `text-sm` and `text-gold/80` / `text-cream/60`
- The subheading in the hero (currently `text-[1.35rem]`) → `text-[1.5rem]`
- The "Our Story" body paragraphs are already `text-lg text-cream/75` — bump to `text-xl text-cream/80`

---

## 3. Fix the wine bottle SVG

The current `WineBottleSvg` has a weird angular neck/top. Replace the entire path with this clean Bordeaux-profile bottle outline. Copy this exactly:

```tsx
function WineBottleSvg() {
  return (
    <svg
      viewBox="0 0 100 290"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ height: '320px', width: 'auto', opacity: 0.75 }}
      className="mx-auto"
      aria-hidden="true"
    >
      {/* Bottle outline — clean Bordeaux profile */}
      <path
        d="
          M 44 20
          Q 44 14 50 14
          Q 56 14 56 20
          L 56 36
          Q 58 40 58 48
          L 57 82
          Q 68 96 72 118
          Q 80 138 80 162
          L 80 268
          Q 80 274 50 274
          Q 20 274 20 268
          L 20 162
          Q 20 138 28 118
          Q 32 96 43 82
          L 42 48
          Q 42 40 44 36
          Z
        "
        stroke="#F0E6DC"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Capsule line */}
      <line x1="42" y1="44" x2="58" y2="44" stroke="#F0E6DC" strokeWidth="1" opacity="0.6" />
      {/* Label area top */}
      <line x1="23" y1="168" x2="77" y2="168" stroke="#F0E6DC" strokeWidth="0.5" opacity="0.35" />
      {/* Label area bottom */}
      <line x1="23" y1="232" x2="77" y2="232" stroke="#F0E6DC" strokeWidth="0.5" opacity="0.35" />
    </svg>
  )
}
```

Also make the illustration column more prominent: in the Section 4 (The Story) layout, the bottle should render at 400px height on desktop (change the `style` prop: `height: '400px'`).

---

## 4. Add a scrolling marquee ticker between sections

Between Section 1 (Hero) and the first divider, and between Section 2 (How It Works) and its following divider, add a `<MarqueeTicker />` component. This is a horizontal scrolling strip of repeated text in small gold caps — adds movement and luxury feel.

Create the component above the `SectionDivider` function:

```tsx
function MarqueeTicker() {
  const text = '\u00a0\u00a0\u00a0\u00a0◆\u00a0\u00a0\u00a0\u00a0THE CELLAR CLUB\u00a0\u00a0\u00a0\u00a0◆\u00a0\u00a0\u00a0\u00a0DURHAM\u00a0\u00a0\u00a0\u00a0◆\u00a0\u00a0\u00a0\u00a0SOMMELIER SELECTED\u00a0\u00a0\u00a0\u00a0◆\u00a0\u00a0\u00a0\u00a0FINE WINE BY SMS\u00a0\u00a0\u00a0\u00a0◆\u00a0\u00a0\u00a0\u00a0DIRECT IMPORT'
  return (
    <div
      className="overflow-hidden border-t border-b py-3"
      style={{ borderColor: 'rgba(201,133,29,0.2)' }}
      aria-hidden="true"
    >
      <div
        style={{
          display: 'flex',
          whiteSpace: 'nowrap',
          animation: 'marquee 28s linear infinite',
        }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="font-serif uppercase tracking-[0.25em] pr-8"
            style={{ fontSize: '0.7rem', color: 'rgba(201,133,29,0.65)', flexShrink: 0 }}
          >
            {text}
          </span>
        ))}
      </div>
    </div>
  )
}
```

Add the `marquee` keyframe animation to `globals.css`:

```css
@keyframes marquee {
  from { transform: translateX(0); }
  to   { transform: translateX(-33.333%); }
}
```

Place `<MarqueeTicker />` immediately before the first `{/* ── Divider ── */}` block (after the hero section closes), and again immediately before the third divider block (after Section 2 closes).

---

## 5. Make the How It Works step numbers dramatically larger

The step numbers (01, 02, 03) currently render as small gold text above each heading. Replace this with a large background number that feels textural and dramatic.

Replace the current step number `<span>` with this treatment inside each step's `<div>`:

```tsx
<div className="text-center md:text-left relative">
  {/* Large background number */}
  <span
    className="font-serif absolute -top-2 left-0 select-none pointer-events-none"
    style={{
      fontSize: '7rem',
      lineHeight: 1,
      color: '#C9851D',
      opacity: 0.07,
    }}
    aria-hidden="true"
  >
    {num}
  </span>
  {/* Step label */}
  <span className="font-serif text-gold text-sm tracking-[0.2em] uppercase relative z-10">
    Step {num}
  </span>
  <h3 className="font-serif text-cream text-2xl mt-2 mb-3 relative z-10">{heading}</h3>
  <p
    className="font-sans text-cream/75 text-base leading-relaxed relative z-10"
    style={{ borderLeft: '3px solid #9B1B30', paddingLeft: '1rem' }}
  >
    {body}
  </p>
</div>
```

The `<div>` wrapper (currently `className="text-center md:text-left"`) needs `relative` added to it for the absolute-positioned number to work. Change it to `className="text-center md:text-left relative"`.

---

## 6. Add a full-width typographic pull quote section

Between Section 3 (The Benefits) and its following divider, add a new `<section>` that is a full-width centred quote. This breaks up the wall of cards and adds breathing room.

Insert this after the closing `</section>` of Section 3 and before the `{/* ── Divider ── */}` that follows it:

```tsx
{/* ── Pull quote ── */}
<section className="bg-maroon px-6 py-20 overflow-hidden">
  <FadeUp>
    <blockquote className="max-w-3xl mx-auto text-center">
      <p
        className="font-serif text-cream/90 leading-tight"
        style={{ fontSize: 'clamp(1.75rem, 4vw, 3rem)' }}
      >
        &ldquo;We don&apos;t send you wine. We send you a chance to say yes or no. You&apos;re always in control.&rdquo;
      </p>
      <footer className="mt-6 font-sans text-cream/40 text-sm tracking-[0.2em] uppercase">
        Daniel Jonberger &mdash; Sommelier
      </footer>
    </blockquote>
  </FadeUp>
</section>
```

---

## 7. Fix the membership tier copy — exact content only, no paraphrasing

Replace the entire content of the three tier cards with exactly the following. Do not add, rephrase, or embellish any of this copy.

**Bailey** (entry tier):
- Label line: `Entry · Free to join`
- Benefits list (in this order):
  1. Two weekly drops via SMS
  2. Free delivery at 12 bottles
  3. Unlimited wine request service
  4. Wine concierge (up to 2 requests/month)

**Elvet** (£500, not £501 — fix the label):
- Label line: `Unlocks at £500`
- Threshold label at bottom of card: `Unlocks automatically when you hit £500 in a rolling 12 months.` (fix the "£501" to "£500" everywhere in the file)
- Benefits list:
  1. Everything in Bailey
  2. Up to 5 wine concierge requests/month
  3. 2 × tickets to wine tastings (Durham or London)
  4. 5% discount on all orders

**Palatine** (£1,000):
- Label line: `Unlocks at £1,000`
- Benefits list:
  1. Everything in Elvet
  2. Free delivery at 6 bottles
  3. 10% discount on all orders
  4. 4 × tickets to wine tastings (Durham or London)
  5. First look — 2 hours before everyone else

The tier benefit `<li>` elements should render at `text-base text-cream/80`. The small footer label inside each card (currently `text-xs text-gold/50` etc.) should be `text-sm text-gold/80` for Elvet/Palatine and `text-sm text-cream/60` for Bailey.

---

## 8. Remove "Unlimited access to our request service" duplication in Elvet

Looking at the benefits above, Bailey already has "Unlimited wine request service" — don't repeat this as a separate line in Elvet (it's included in "Everything in Bailey"). Elvet's unique additions are the concierge increase, tastings, and discount.

---

## 9. Login route for existing members

Two places need a login link pointing to `/portal`.

**A — The "already signed up" error on `/join`**

In `app/join/page.tsx`, find where the `looks_like_already_signed_up` error is handled and the message is set. Currently it sets something like: `"Looks like you're already signed up. Check your texts!"`

Replace the error display with a message that includes a portal link. The error `<p>` element should render:

```
Looks like you're already signed up.{' '}
<Link href="/portal" className="underline underline-offset-2 text-cream/80 hover:text-cream transition-colors">
  Log in here →
</Link>
```

Make sure `Link` is imported from `next/link` (it likely already is).

**B — Small member login link on the homepage**

In `app/page.tsx`, inside the hero section, add a subtle "Already a member?" line below the reassurance text (the `<p>` that says "You're only ever charged when you confirm an order."). Add this immediately after it:

```tsx
<p className="font-sans text-cream/35 text-xs mt-2">
  Already a member?{' '}
  <Link href="/portal" className="underline underline-offset-2 text-cream/45 hover:text-cream/70 transition-colors">
    Log in here
  </Link>
</p>
```

Small, unobtrusive — it's there for people who land on the homepage but are already signed up. Not a prominent CTA.

---

## 10. Final checks

Run `npm run build` and confirm no TypeScript or compilation errors before finishing.
