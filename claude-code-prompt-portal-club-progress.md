# Spec: Portal "Your Club" — progress ladder, bottle counter, membership year

## Context & dependencies

The customer portal dashboard (`app/portal/dashboard/`) currently shows a plain
`TierProgress` cases-bar and a flat `MilestonesList`. Julia wants this upgraded into
a single, delightful "Your Club" view: where am I on the ladder, how many bottles
into my current case, when does my membership year renew, and where do I have
something to choose or redeem.

**Implement AFTER (or together with) `claude-code-prompt-tiers-v3-2-relative-climb.md`**
(tiers-v3-1 is already implemented). This view renders the seven-rung ladder under
v3.2's relative-climb model and must consume `getLadderPosition`,
`cycle_start_rung`/`cycle_year`, and the per-year gift catalogue that spec defines in
`lib/tiers.ts`/`lib/milestones.ts` — do not hardcode a second copy of the ladder
here. All member-facing wording must agree with
`claude-code-prompt-club-page-v3.md` (the `/club` page); where this spec's copy and
that page differ on mechanics, /club's checklist wins.

Tone target: **interesting and fun, but elegant** — think a wine label, not a game.
No gamification chrome (no confetti, badges-with-shine, streaks). CSS-only motion.

---

## 1. Where it lives

Replace the existing `TierProgress` + `MilestonesList` components in the dashboard
overview with one new component, `ClubProgress` (own file in
`app/portal/dashboard/`). It renders as a card in the same position, using the
portal's existing visual language (same card/border/typography treatment as the rest
of the dashboard; accents from the site palette — deep wine red `#9B1B30` works as
the "filled" colour). No new route; no extra client JS libraries.

## 2. Data (extend `page.tsx`'s server fetch)

Already fetched: `tier`, `tier_since`, `credit_balance_pence`, cellar rows/bottle
count, `casesThisCycle` (via `getRollingCases`), `milestone_awards` rows. Add:

- **Bottles this cycle** — the same confirmed-order bottle sum `getRollingCases`
  floors, un-floored (expose a `getRollingBottles` from `lib/tiers.ts` or return
  both from one call — implementer's choice). Needed for the "X of 12" counter:
  `bottlesIntoCurrentCase = bottlesThisCycle % 12`.
- **`cycle_start_rung` and the member's current cycle year** (tiers-v3-2) —
  drive ladder position and which year's `milestone_awards` rows / gift catalogue
  entries apply. Filter milestone rows to the current `cycle_year`.
- **Renewal date** — `tier_review_at` if set; else `tier_since + 1 year`; else
  first confirmed order date + 1 year; else null (brand-new member, no orders — hide
  the renewal line entirely). Note: migration 044 hasn't run yet, so many customers
  currently have null `tier`/`tier_since` — the fallback chain must handle that
  gracefully, not render "renews Invalid Date".

## 3. The view, top to bottom

### 3a. Header stats row

Three compact stats (label over value, side by side; stack on narrow screens):

- **This case** — "7 of 12 bottles"
- **This year** — "3 cases" (cycle cases)
- **Credit** — "£23.40" (omit if 0 — matches current behaviour)

### 3b. The bottle counter (the fun bit)

Under the stats: **twelve small bottle glyphs** in a row representing the current
case. Filled (wine-red) for bottles bought, empty (outline) for the rest. Inline SVG,
one simple bottle shape reused; on first render the filled ones fill in sequence with
a short staggered CSS transition (~0.4s total, `prefers-reduced-motion` respected).
Caption: "5 more bottles complete case 4."

If the customer has 0 bottles this cycle: all twelve empty, caption "Your first case
of the year starts with your next order." — same component, no special empty-state
layout.

### 3c. The ladder (vertical timeline, cases 1–7)

A vertical line with seven nodes, mirroring the `/club` page ladder — same rewards,
same order, sourced from the centralised constants. Each node: case number, one-line
reward label (shortened from /club copy is fine — e.g. "Free bottle or tasting
tickets"), and a status. Node states:

| State | When | Visual | Copy under the node |
|---|---|---|---|
| **Done** | Gift rungs: `milestone_awards` row exists AND fulfilled. Tier rungs: current tier rank ≥ that rung's tier | Filled node, quiet tick | — (the reward label alone; optionally "yours" in small caps) |
| **Choose!** | Milestone row exists, `reward_choice` null | Filled node with accent ring, gently pulsing (CSS, subtle) | "Ready to claim — text Daniel to choose." |
| **On its way** | Milestone row exists, choice recorded, not fulfilled | Filled node, hollow tick | "Chosen — Daniel's arranging it." (for tasting tickets: "Text Daniel to book your tastings.") |
| **You are here** | The rung after the member's furthest progress | Marker node (e.g. small wine-drop), the 3b bottle counter visually connects to it | — |
| **Ahead** | Everything beyond | Faded node + label | — |

Status resolution notes (relative-climb model — see tiers-v3-2):

- The ladder always shows **this membership year's climb**.
  `position = cycle_start_rung + casesThisCycle`. Rungs at or below
  `cycle_start_rung` render as **held** (filled, quiet — the member starts the year
  standing on them); rungs in `(cycle_start_rung, position]` resolve per this
  year's `milestone_awards` rows (current `cycle_year`) and tier; rungs above
  `position` are Ahead/deselected — **including gift rungs earned in previous
  years**, because a re-passed rung carries a NEW gift for the new year. Never mark
  a rung Done from a prior year's award.
- Gift rung labels come from the per-year catalogue in `lib/milestones.ts` for the
  member's current `cycle_year`. If the catalogue has no entry yet for that year
  (year-2 names are TBD), label the rung "A new reward — to be revealed" rather
  than showing last year's gift.
- "You are here" marker sits at `position + 1`, capped at 7.
- Position at/past 7: no marker; single line under the ladder — "Top of the ladder.
  We'll have to build a taller one." (Julia may reword.)
- The "text Daniel" copy should be a tappable `sms:` link to the club number (source
  it from the existing Twilio number env/constant — verify the name in the repo)
  so on mobile it opens their thread. Plain text fallback is fine on desktop.

### 3d. Membership year footer

One quiet line under the ladder:

> "Your membership year renews on {14 March 2027}. [How the year works →](/club)"

No soft-drop explanation here — /club owns that. Hide entirely when renewal date is
null (§2).

## 4. Copy rules

- All mechanics wording must match the /club page checklist (rebates as credit,
  Elvet 7%, Palatine free shipping any amount, membership year = 12 months from
  first order). Shortened labels fine; contradictions not.
- "Text Daniel to choose / redeem" is the ONLY call to action for claims — there is
  no in-portal selection UI in this version (a self-select flow is a known
  fast-follow; don't build it now).
- No exclamation-mark pile-ups; one per screen max.

## 5. Out of scope

- No in-portal gift selection or redemption flow (text Daniel only).
- No changes to /club, admin pages, SMS flows, or tier/milestone logic.
- No push/email nudges about unclaimed gifts (possible future spec).
- No historical order timeline — this is the ladder, not an order history.

## Files (anticipated — verify)

- `app/portal/dashboard/ClubProgress.tsx` — new; replaces `TierProgress` +
  `MilestonesList` usage in `DashboardClient.tsx` (delete those components if
  nothing else uses them)
- `app/portal/dashboard/page.tsx` — extended fetch (§2)
- `lib/tiers.ts` — expose rolling bottles (§2)
- `lib/milestones.ts` — consume (and if needed extend) the per-year ladder
  catalogue from tiers-v3-2; portal-facing short labels can live there too

## Verification

- A member with 3 cycle cases + 7 loose bottles sees: "7 of 12 bottles", 7 filled
  glyphs, marker on rung 4, rungs 1–3 resolved per their milestone/tier state.
- A member with an unchosen milestone sees the pulsing "text Daniel to choose" state
  with a working `sms:` link; chosen-but-unfulfilled shows "Daniel's arranging it".
- Null `tier`/`tier_since` (pre-044 reality) renders without errors: sensible
  renewal fallback or hidden line, ladder all-ahead for a no-order member.
- Year two: a member with `cycle_start_rung 4` and 1 case this year shows rungs 1–4
  held, rung 5 resolved from this year's award (new gift label or "to be
  revealed"), marker on rung 6, rung 7 deselected — regardless of what they earned
  last year.
- `prefers-reduced-motion` disables the fill/pulse animations.
- Mobile (375px): stats stack, ladder remains readable, bottle glyphs don't wrap
  oddly.
- Wording spot-check against /club: no "10%" for Elvet, no Palatine
  free-shipping-at-6, renewal framed as membership year from first order.
