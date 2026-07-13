# Spec: /club page rewrite — explain the v3 ladder (tiers + milestones)

## Context

`app/club/page.tsx` still describes the **old spend-based tier system** (£500/£1,000
rolling spend, Elvet as the entry tier, "Discount 5%/10%", tasting tickets as recurring
perks). All of that is wrong under tiers-v3 (implemented 2026-07-13 — see
`IMPLEMENTATION-LOG.md` and `claude-code-prompt-tiers-v3.md`). This spec is a
**full content rewrite** of the page.

**Keep the existing visual language** — it's good and matches the rest of the site:

- Palette constants as-is: `PAGE_BG #E6D9CA`, `CARD_BG #F2EAE0`, `TEXT_DARK #1C0E09`,
  `BORDER rgba(42,24,16,0.18)`, accent `#9B1B30`.
- Serif headings, sans eyebrows/labels, the dotted-leader `PerkEntry` row pattern,
  single centred card on parchment, max-w-2xl, back-link + bottom CTA to `/join`.
- Static server component, no client JS, no data fetching. Update the `metadata.title`
  (suggestion: `How the Club works — The Cellar Club`).

**Accuracy is the point of this page.** The copy below is drafted to match what's
actually implemented; don't "improve" mechanics wording without checking
`lib/tiers.ts` / `lib/milestones.ts`. Julia will polish tone afterwards — flag copy
changes in the log, don't silently reword mechanics.

### Things this page must get right (checklist)

- Rebate is **credit back**, not a discount at checkout: Bailey 5%, Elvet 10%,
  Palatine 10%.
- Delivery under a full case: £10 standard / £7 Bailey / £5 Elvet & Palatine. Free
  shipping at 12 bottles (a full case); Palatine ships free at 6.
- Tiers are earned at 2 / 4 / 6 **cases** (1 case = 12 bottles) counted over the
  **membership year** — an anniversary-reset window, NOT a continuously sliding
  12-month window (this was a deliberate implementation decision; don't say
  "rolling spend" or imply the window slides daily).
- At each anniversary the case count starts fresh and members drop **one tier at
  most** (soft landing; Bailey is never taken away once earned).
- Milestones are **lifetime and one-time-ever**; never clawed back, unaffected by the
  yearly reset. Credit never expires and survives the reset too.
- Members check credit by texting **BALANCE**; credit is offered automatically at the
  next order.

---

## Page structure & copy

Eight sections inside the card, top to bottom. Copy in quotes is the draft — keep
meaning exact, tone tweaks welcome.

### 1. Header

- Eyebrow (existing style): `THE CLUB`
- H1: **Every case earns something**
- Italic subline: "Free to join. Buy wine by text, build cases of twelve — and every
  case you complete unlocks a reward."

### 2. How it works (short intro, 3 lines)

Three numbered lines (serif, generous spacing — a simplified version of the PerkEntry
look works well):

1. "Daniel texts you wines. You reply to buy — bottles wait in the cellar."
2. "Twelve bottles make a case. Cases ship free; fewer bottles ship from £5."
3. "Every case you complete earns you something. Here's the ladder."

### 3. The ladder (hero section)

A vertical case-by-case list, cases 1–6. Each row: a large serif case number (accent
colour), a dotted leader (existing pattern), and the reward. Tier rows get their tier
name as a small-caps eyebrow above the reward. Suggested rendering — one component,
six entries:

| Case | Eyebrow | Reward text |
|---|---|---|
| 1 | — | "A free-shipping voucher — your next shipment goes free at just 6 bottles." |
| 2 | BAILEY | "You're Bailey. 5% of every order back as credit, delivery drops to £7." |
| 3 | — | "Six Riedel glasses, or two tasting tickets — your pick." |
| 4 | ELVET | "You're Elvet. Credit back doubles to 10%, delivery drops to £5." |
| 5 | — | "A free bottle chosen by Daniel, or two tasting tickets." |
| 6 | PALATINE | "You're Palatine. Wine texts two hours before everyone else, free shipping at 6 bottles — and a Coravin." |

Visually distinguish the two kinds of rung subtly (e.g. tier rows slightly bolder /
milestone rows with a small gift glyph or italic) — but keep it one ladder; the whole
point is "every case = something".

### 4. Tier detail (three blocks, existing PerkEntry pattern)

Reuse the existing tier blocks + dividers, in ladder order (Bailey, Elvet, Palatine —
note the old page had Elvet first; that ordering is now wrong). Right-hand slot after
the tier name (where "from £500 / year" used to be): **"2 cases" / "4 cases" /
"6 cases"**.

Bailey:
- Credit back — "5% of every order"
- Delivery (under a case) — "£7"
- Wine texts — "2 / week"
- Concierge requests — "2 / month"

Elvet:
- Credit back — "10% of every order"
- Delivery (under a case) — "£5"
- Wine texts — "2 / week"
- Concierge requests — "5 / month"

Palatine:
- Credit back — "10% of every order"
- Delivery (under a case) — "£5"
- Free shipping — "at 6 bottles"
- Wine texts — "2 / week, 2 hrs early"
- Concierge requests — "unlimited"

(Concierge/text counts are display-only, matching the portal — no metering exists;
that's fine, they're descriptions not promises of enforcement.)

### 5. Credit, plainly (short section)

Heading: **Credit, not coupons.**

"Your rebate lands as credit on your account — real money against your next order.
When you order and have credit, we'll offer it automatically: reply BALANCE and it
covers as much of the order as it can, with any remainder going to your card. Text
BALANCE any time to check what you've got. Credit never expires."

### 6. Gifts are forever (short section)

Heading: **Earn it once, keep it.**

"The gifts on the ladder — the glasses, the bottle, the Coravin — are lifetime
milestones. You earn each one once, it's yours, and it's never taken back. The gift
shelf changes from year to year, so there's always something new ahead of you."

> Note for implementer: the last sentence is Julia's framing ("gifts change the
> following year"). It's forward-looking copy, not a mechanic in the code — nothing to
> build, just don't promise any *specific* future gift.

### 7. Your membership year (the reset, explained gently)

Heading: **How the year works.**

"Your case count runs over your membership year — twelve months from your first case.
When your anniversary comes round, the count starts fresh for the new year, and your
tier eases down a single step at most: Palatine begins the new year as Elvet, Elvet as
Bailey. Bailey is yours for good. Your credit and your gifts are untouched — only the
climb resets. Order like you did last year and you'll be back where you were (and
collecting anything on the ladder you haven't earned yet)."

### 8. Footnote + CTA

Replace the old italic footnote ("rolling twelve-month spend") with:

"Tiers update automatically as you order — you'll get a text when you move up. One
case = 12 bottles."

Keep the existing `/join` CTA button exactly as-is.

---

## Out of scope

- No changes to any other page, component, or route (the FAQ delivery-fee copy on
  `app/page.tsx` was already updated in the tiers-v3 work).
- No data fetching / personalisation — this is a static marketing page.
- Don't touch portal tier/milestone displays.

## Timing note

This page describes the v3 system, which is fully built but whose recompute
(migration 044) and milestone backfill have **not been applied yet** (awaiting
Julia's go-ahead — see IMPLEMENTATION-LOG). Coordinate with Julia: this page should go
live with (or after) that switch-on, not before. If asked to ship it now, ask her
first.

## Files

- `app/club/page.tsx` — full rewrite of content, preserving visual constants/patterns
  and the `PerkEntry` component (extend or add a ladder-row component as needed).

## Verification

- Every number on the page cross-checks against `lib/tiers.ts` (`rebatePctForTier`,
  `deliveryFeePence`, `tierFromCases`, `deliveryThreshold`) and
  `lib/milestones.ts` (milestone set {1,3,5,6} and reward options).
- No occurrence of: "spend", "£500", "£1,000", "discount", "rolling twelve-month
  spend" — grep the file.
- Tier order on the page is Bailey → Elvet → Palatine.
- Page builds statically (`npx next build`), renders correctly at mobile width
  (single column, ladder rows don't wrap awkwardly), and the `/join` CTA + back link
  still work.
