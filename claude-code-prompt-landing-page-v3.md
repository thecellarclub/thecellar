# Claude Code Prompt — Landing Page v3

All changes are to `app/page.tsx` and `app/join/page.tsx` unless stated otherwise. Do not touch the admin panel.

---

## 1. Revert all v2 font and layout changes

The previous prompt made several changes that should be undone. Restore these exactly:

**Alternating section backgrounds** — the page should alternate between `bg-maroon` and `bg-maroon-dark` as it did before the v2 prompt. Specifically:
- Section 1 (Hero): `bg-maroon`
- Divider after hero: `bg-maroon-dark`
- Section 2 (How It Works): `bg-maroon-dark`
- Divider: `bg-maroon`
- Section 3 (Benefits): `bg-maroon`
- Divider: `bg-maroon-dark`
- Pull quote: `bg-maroon-dark`
- Divider: `bg-maroon-dark`
- Section 4 (The Story): `bg-maroon-dark`
- Divider: `bg-maroon-dark`
- Section 5 (The Levels): `bg-maroon`
- Footer: `bg-maroon`

**Font sizes — revert to originals:**
- Body copy: back to `text-sm` (not `text-base`)
- Opacity values: back to `/55`, `/60`, `/65` as they were (not `/75`, `/80`)
- Hero subheading lines: back to `text-[1.35rem]`
- Story paragraphs: back to `text-lg text-cream/75` (not `text-xl text-cream/80`)
- Tier benefit list items: back to `text-sm text-cream/65`
- Tier footer labels: back to `text-xs text-gold/50` / `text-cream/30`
- The step descriptions: back to `text-cream/60 text-sm`

**Step numbers (How It Works)** — if the v2 giant faint background number treatment was applied, remove it. Restore the original small gold step label (`font-serif text-gold text-xl tracking-[0.2em]`) above each heading. The step `<div>` wrapper should NOT have `relative` positioning for the background number.

**Marquee ticker** — remove the `<MarqueeTicker />` component and its two placements entirely. Remove the `@keyframes marquee` rule from `globals.css` if it was added.

Do NOT revert:
- The wine bottle SVG (keep the clean Bordeaux profile)
- The tier card content (keep the updated copy — see section 4)
- The login links (keep — see section 5)
- The pull quote section (keep position, but replace its content — see section 3)

---

## 2. Hero subheading — new structure, original sizing

Replace the hero subheading block with this. Note the font sizes match the originals — not the larger v2 sizes:

```tsx
<div className="mb-10 max-w-[600px] mx-auto">
  {/* Primary line — slightly larger than the four below, same as original hero lines */}
  <p className="font-serif text-cream/85 text-[1.35rem] leading-snug text-center mb-5">
    Sommelier selected wines at insider rates.
  </p>

  {/* Four punchy lines — slightly smaller */}
  <div className="space-y-2 text-center">
    {[
      'Two texts a week.',
      'Reply how many bottles.',
      'We store until you fill a case.',
      'Then ship it for free.',
    ].map((line) => (
      <p key={line} className="font-serif text-cream/55 text-[1.1rem] leading-snug">
        {line}
      </p>
    ))}
  </div>
</div>
```

Remove any old `hero-line` CSS classes from `globals.css` if they exist and are no longer used.

---

## 3. Pull quote — replace with properly styled version

Replace the entire pull quote section content. The design: very large, semi-transparent `"` as a decorative backdrop — cream coloured, low opacity — behind a centred quote in large Cormorant Garamond. No image, no card, no background texture. Section background should be `bg-maroon-dark` per the alternating pattern.

```tsx
{/* ── Pull quote ── */}
<section className="bg-maroon-dark px-6 py-28 overflow-hidden">
  <FadeUp>
    <div className="max-w-3xl mx-auto text-center relative">

      {/* Giant decorative opening quote mark — behind everything */}
      <span
        className="font-serif select-none pointer-events-none absolute"
        aria-hidden="true"
        style={{
          fontSize: '28rem',
          lineHeight: 0.8,
          color: '#F0E6DC',
          opacity: 0.045,
          top: '-3rem',
          left: '50%',
          transform: 'translateX(-52%)',
          fontStyle: 'normal',
          zIndex: 0,
        }}
      >
        &ldquo;
      </span>

      <blockquote className="relative" style={{ zIndex: 1 }}>
        <p
          className="font-serif text-cream/90 leading-[1.25]"
          style={{ fontSize: 'clamp(1.6rem, 3.5vw, 2.5rem)' }}
        >
          Wines you won&apos;t find on any shelf, at prices that feel like a secret.
        </p>
        <footer className="mt-10 space-y-1.5">
          <p className="font-sans text-cream/35 text-[0.7rem] tracking-[0.25em] uppercase">
            The Cellar Club
          </p>
          <p className="font-serif text-cream/30 text-sm italic">
            Not recommended for anyone who was happy with their wine spend.
          </p>
        </footer>
      </blockquote>

    </div>
  </FadeUp>
</section>
```

---

## 4. Membership section — targeted copy fixes

In the six benefit cards (Section 3):

- Change `heading: 'Wines you won\'t find anywhere else'` → `heading: 'Off the beaten path'`
- In the "Sommelier selected" card body, replace `"He doesn't pick anything he wouldn't open himself."` with `"You're basically getting what he's drinking himself (or wishing he was)."`
- Remove all em-dashes (`—`, `&mdash;`, `\u2014`) from within the benefit cards and the tier cards. Replace with a comma or colon where needed, or just remove if the sentence works without it.

---

## 5. Tier cards — confirm correct content

The tier cards should contain exactly this. Re-apply if reverted in step 1:

**Bailey** (entry):
- Subheading label: `Entry · Free to join`
- Benefits list: Two weekly drops via SMS / Free delivery at 12 bottles / Unlimited wine request service / Wine concierge (up to 2 requests/month)
- Footer note: `Free to join.`

**Elvet** (£500 — fix £501 → £500 everywhere it appears):
- Subheading label: `Unlocks at £500`
- Benefits list: Everything in Bailey / Up to 5 wine concierge requests/month / 2 × tickets to wine tastings (Durham or London) / 5% discount on all orders
- Footer note: `Unlocks automatically when you hit £500 in a rolling 12 months.`

**Palatine** (£1,000):
- Subheading label: `Unlocks at £1,000`
- Benefits list: Everything in Elvet / Free delivery at 6 bottles / 10% discount on all orders / 4 × tickets to wine tastings (Durham or London) / First look — 2 hours before everyone else
- Footer note: `Unlocks at £1,000. Free shipping drops to 6 bottles.`

---

## 6. Login links — confirm or add

**A — `app/join/page.tsx`:** When the `looks_like_already_signed_up` error fires, the message should read: `Looks like you're already signed up.` followed inline by `<Link href="/portal">Log in here →</Link>`.

**B — `app/page.tsx` hero:** Below the "You're only ever charged when you confirm an order." line, add:

```tsx
<p className="font-sans text-cream/35 text-xs mt-2">
  Already a member?{' '}
  <Link href="/portal" className="underline underline-offset-2 text-cream/45 hover:text-cream/70 transition-colors">
    Log in here
  </Link>
</p>
```

---

## 7. Commit and deploy

Run `npm run build` to confirm no TypeScript errors.

Then run:
```
git add -A
git commit -m "Landing page v3: hero subheading, pull quote, tier copy, login links, font revert"
git push
```

This is critical — most recent features (portal, tier system, admin mobile, phone normalisation) have never been committed or deployed. The portal is showing a 404 in production because the code has never been pushed. This commit will also pick up all those uncommitted changes. After pushing, confirm on Vercel that the deployment completes successfully.
