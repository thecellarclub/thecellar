# Spec: Message-match landing pages for the new Google Ads positioning

For: Claude Code session on thecellar.club repo · From: Google Ads audit + rebuild, 23 Jul 2026

Context: Paid search now targets subscription/club intent ("wine subscription", "wine
club uk", "personal sommelier") with drop-first copy: "48 bottles, first come first
served, usually gone within the hour — texted by a real sommelier at trade prices."
Ads currently land on `/` (homepage).

## Where the site stands today (checked live, 23 Jul)

- `/` — signup page. One phone field above the fold, "Free to join. You only pay for
  wines you order.", Daniel's story, FAQ. Good conversion mechanics, but the
  drop/scarcity mechanic is absent above the fold — nothing about 48 bottles, twice a
  week, sell-outs, or trade prices until you read the long note.
- `/club` (club-page-v3) — "How the Club works": ladder, tiers (Bailey/Elvet/Palatine),
  credit-back. This is a retention explainer, not an acquisition page; it has no
  signup field until the bottom.

So: are we message-matching the new ads? Partially. The signup form is right; the
story a paid visitor lands on is still advice-led, not drop-led.

## What to build

### 1. Drop-proof hero on `/` (priority 1)

Rework the hero to lead with the drop mechanic, keeping the one-field phone signup
exactly where it is:

- Headline territory: "48 bottles. Twice a week. Usually gone within the hour."
- Subline: real sommelier (ex-2-Michelin Raby Hunt) texts the drop; reply with how
  many bottles; trade prices because we import direct.
- Sell-out proof strip under the form: live-ish stats, e.g. "7 of our last 22 drops
  sold out — fastest in 13 minutes." Pull from real drop data; do not hard-code stale
  numbers. Falls back gracefully if no recent sell-outs.
- Keep "Free to join. You only pay for wines you order." as the reassurance line
  (it's true and converts); do NOT add discount or free-bottle framing anywhere
  (Google alcohol policy + positioning).
- Keep the phone-mockup showing a real drop text — ideally one that sold out, with a
  "SOLD OUT — 41 minutes" stamp.

### 2. UTM capture → customer record (priority 1, verify end-to-end)

Ads now append `utm_source=google&utm_medium=cpc&utm_campaign={campaignid}&utm_term={keyword}&utm_content={creative}`
via an account-level final URL suffix (plus gclid from auto-tagging).

- Verify the signup flow persists all five utm_* params + gclid onto the customer
  record at phone-submit time (not just card-save), surviving the `/` → verification
  → card-details hops (sessionStorage or server session, not just first-page query
  string).
- These fields are the join key for the activation report below. Test with a
  synthetic click:
  `https://thecellar.club/?utm_source=google&utm_medium=cpc&utm_campaign=test&utm_term=test-kw&utm_content=test-ad&gclid=test123`.

### 3. Activation report by acquisition source (priority 2)

Per Julia's economics (buyer LTV ≈ £890 gross margin; CAC ceiling £100–150 per
activated buyer; sign-up CPA is pacing only):

- A simple internal report (SQL view or admin page): for each `utm_campaign`/`utm_term`,
  count sign-ups → card-saves → first orders within 14 days of sign-up, plus rates.
  Benchmarks to compare against: 79% card-save, 54% of card-savers buy (existing
  members).
- Kill criterion for ad themes: Google-sourced sign-ups activating below ~15%.
- Bonus: send the first-order event back to Google Ads as a Secondary conversion
  (import or gtag) so we can later bid on activation, not sign-up.

### 4. Optional `/drop` acquisition variant (priority 3, only after 1–2 ship)

A dedicated ads landing page ("club-page" is retention; don't reuse it): drop hero +
sell-out wall (last N drops with sold-out times) + phone field + three-line
how-it-works + link to `/club` for the ladder. A/B against `/` before switching ad
final URLs; don't split traffic before the UTM plumbing is verified.

## Don'ts

- No "free wine" / "first recommendation free" copy unless it's a real live offer
  (policy + positioning risk).
- Don't remove or bury the phone field — single-field signup is the highest-performing
  element we have.
- Don't retire `/` in favour of `/club` for paid traffic; `/club`'s job is explaining
  the ladder to members.
- Don't strip query params in any redirect (www ↔ apex, http → https, trailing
  slash) — that's what broke UTM reporting before.

## Deviation from this spec (Craig's direct instruction, same session)

Craig explicitly overrode item 1: **do not change the homepage.** "Make new landing
pages if you're going to do anything." Scope for this pass, confirmed with Craig via
follow-up questions: build `/drop` (item 4) instead of reworking `/`, plus the gclid
half of item 2 (UTM capture already worked end-to-end; gclid was the real gap). Items
3 and the bonus Google Ads secondary-conversion wiring were explicitly deferred.
