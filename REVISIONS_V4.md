# The Cellar Club — Revision Round 4

**For:** Claude Code
**From:** Julia
**Against:** the current build at `http://localhost:3001/`

Overrides V1, V2, V3 where they conflict.

---

## 1. Logo — new file, bigger, left-aligned

A new logo file has been placed at `C:\thecellarclub\new logo.png`.

- **Move it** to `public/new-logo.png` (or rename on the way: `public/logo.png` — overwrite the existing `public/logo.png`). Next.js won't serve files from the project root.
- **Check the background.** The new PNG appears to have a *white* background rather than the cream we used on the previous file. If it's solid white, check whether the page background needs adjusting (see §2) or if the logo should be trimmed / given a matching background. The cleanest fix is to either (a) open the PNG in an image tool and replace the white background with the current page cream, or (b) leave the PNG white and have Claude Code crop to the arch content + add a small `background: [page-bg]` wrapper. Preferred: (a).
- **Displayed size: 20% bigger than the current.** Current is ~130px on mobile / ~160px on desktop (V3 §1). New target: ~**155px mobile / ~192px desktop**.
- **Left-align the logo** so its left edge aligns with the left edge of the hero headline / subheading / phone form block. No longer centred.

```tsx
<Image
  src="/logo.png"
  alt="The Cellar Club"
  width={440}
  height={360}
  priority
  className="h-auto w-[155px] md:w-[192px] self-start"
/>
```

Drop any `mx-auto` on the logo wrapper.

## 2. Page layout — tighten spacing around the logo and all sections

- **Reduce padding between the logo and the hero headline.** Current gap is too big — target ~16–24px between the bottom of the logo and the top of the headline (was ~48–64px). Use a `mb-4 md:mb-6` on the logo wrapper.
- **Reduce the blank space *before* every divider title** (the horizontal-rule + tracked-caps block). In the current build there's a big dead zone above each section title. Shrink the top padding of each section block so the divider sits closer to the content above it. Target: ~32–40px above each divider on desktop, ~24px on mobile (was ~80–120px).
- Keep the equal-top-and-bottom rule from V3 §8: whatever padding you land on above a divider, match it after the section's content so the rhythm stays balanced. The goal is "tighter everywhere," not "squashed top, loose bottom."

## 3. Hero headline — decorative caps treatment

Keep the headline in Cormorant Garamond uppercase per V3 §3. Add a decorative first-letter treatment:

- **The first letter of each word** in the headline should be set slightly **larger** than the rest of the letters in that word.
- The **remaining letters** of each word should be set slightly **smaller**.
- Everything stays uppercase — this is a size variation, not a case change.

Sizing guidance (adjust to eye):
- First letter of each word: `text-4xl` on desktop, `text-3xl` on mobile (slightly larger than the current headline).
- Remaining letters of each word: `text-2xl` on desktop, `text-xl` on mobile (slightly smaller).
- Keep `tracking-[0.06em]` to `tracking-[0.08em]`.
- Same colour (`#1C0E09`), same Cormorant weight (400 or 300).

Implementation: wrap the first letter of each word in a `<span>` with the larger class, and the rest in a `<span>` with the smaller class. For the current headline:

```tsx
// "IMAGINE TEXTING YOUR PERSONAL SOMMELIER."
// Rendered as:
//   I MAGINE   T EXTING   Y OUR   P ERSONAL   S OMMELIER.
// where the leading letter of each word is a touch taller.
```

Build a small helper so it's not repeated inline:

```tsx
function DecoratedHeading({ children }: { children: string }) {
  const words = children.split(' ')
  return (
    <h1 className="font-serif uppercase tracking-[0.06em]" style={{ color: '#1C0E09' }}>
      {words.map((word, wi) => (
        <span key={wi} className={wi > 0 ? 'ml-4' : ''}>
          <span className="text-3xl md:text-4xl">{word.slice(0, 1)}</span>
          <span className="text-xl md:text-2xl">{word.slice(1)}</span>
        </span>
      ))}
    </h1>
  )
}
```

Tweak the sizes if the contrast between the two sizes feels wrong. The effect should be subtle but visible — think elegant drop-cap-lite, not a big cap.

## 4. Divider title headings — slightly larger

The tracked-caps section titles (`A NOTE FROM DANIEL`, `GOOD TO KNOW`, etc.) are currently a bit too small. Bump them up.

- Change from `text-xs` (12px) to `text-sm` (14px).
- Keep `uppercase tracking-[0.28em]`, keep Spectral (`font-sans`), keep the muted colour (`rgba(42,24,16,0.65)`).
- The flanking horizontal rules stay the narrow width from V3 §9 — don't widen them, just make the title text bigger.

## 5. Daniel's letter — replace "— Daniel" with the sign-off image

A new image has been placed at `C:\thecellarclub\sign off.png`. It contains both a circular photo of Daniel and his handwritten signature in one composition.

- **Move it** to `public/sign-off.png`.
- **Delete the final `— Daniel` text line** from the bottom of the letter.
- **Insert the image** in its place, **left-aligned** inside the letter card, rendered at roughly **40% of the card's content width** (i.e. `max-w-[40%]` or a fixed pixel width around `w-[260px]` on desktop, `w-[200px]` on mobile).

```tsx
<div className="mt-8">
  <Image
    src="/sign-off.png"
    alt="Daniel Jonberger"
    width={860}
    height={220}   // adjust to the actual aspect ratio of the file
    className="w-[200px] md:w-[260px] h-auto"
  />
</div>
```

Measure the actual PNG dimensions and set `width` / `height` accordingly so Next.js doesn't layout-shift. The image has some white background around the signature — same instruction as the logo: either (a) repaint the white to the page cream in an image tool, or (b) it'll appear as a small white card against the cream letter background. Preferred: (a). If left as-is, it'll look a bit off.

## 6. Final CTA — drop the sub-line

Remove the `Ready when you are.` line above the final CTA form. The section now goes straight from the divider (`JOIN THE CLUB` or see §7) into the phone form + button.

## 7. Final CTA — new button copy

The footer CTA text needs to feel more tangible — like the user gets something in exchange for signing up. Julia's framing: when a new member signs up, we welcome them and text them the most recent wine offer that went out to members. The button should hint at that.

Options, in order of Julia's preference (pick the first that fits the button comfortably; they're listed shortest-first):

1. **`GET THIS WEEK'S WINE →`** — short, tangible, implies immediacy.
2. **`TEXT ME THIS WEEK'S PICK →`** — ties back to Daniel texting you.
3. **`START WITH THIS WEEK'S WINE →`** — gentler onramp.
4. **`GET THE LATEST DROP →`** — uses wine-world language.

Go with option 1 (`GET THIS WEEK'S WINE →`) as the default. If it looks cramped next to the input on mobile, fall back to option 4.

The hero button stays `JOIN THE CLUB →` (V3 §7).

Consider: if option 1 is used, the final divider title could also change to something more inviting. Suggestion — change the final section's divider title from `JOIN THE CLUB` to **`THIS WEEK'S WINE`** so the section reads as a coherent promise (title "THIS WEEK'S WINE" → form → button "GET THIS WEEK'S WINE →"). Apply this change.

---

## Summary checklist

- [ ] Move `new logo.png` to `public/logo.png` (overwrite). Handle its white background so it blends with the page (repaint in image tool preferred).
- [ ] Logo: 20% larger (~155px mobile / ~192px desktop), left-aligned (no `mx-auto`, aligned with the hero content's left edge).
- [ ] Reduce padding between logo and headline to ~16–24px.
- [ ] Reduce the vertical space before every divider title — target ~32–40px above each divider, equal amount after the section content.
- [ ] Hero headline: first letter of each word sized slightly larger than the rest (all caps throughout). Implement with a `DecoratedHeading` component.
- [ ] Section divider titles: bump from `text-xs` to `text-sm`. All other styling stays.
- [ ] Move `sign off.png` to `public/sign-off.png`. Handle its white background.
- [ ] Delete the `— Daniel` line. Insert the sign-off image left-aligned in the letter card, ~40% of the card's content width.
- [ ] Remove the `Ready when you are.` line above the final CTA.
- [ ] Final CTA button: `GET THIS WEEK'S WINE →`. Final section divider title: `THIS WEEK'S WINE`.
- [ ] Hero button stays `JOIN THE CLUB →`.

Anything not listed above stays as it is in the current build.
