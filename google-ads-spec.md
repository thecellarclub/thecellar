# Spec: Google Ads Campaign — The Cellar Club (NE England Launch Test)

**For:** Claude Code
**Owner:** Julia (julia@thebothy.club)
**Last updated:** 2026-04-29
**Status:** Ready to implement

---

## 1. Background

The Cellar Club (https://thecellar.club) is a **curated wine club delivered over text**. Daniel — the sommelier behind Norse and Crush — texts members the wines he's actually drinking and recommending right now. Members reply with a number to order. Bottles accumulate in the cellar at Norse until a case (12) is full, then ship free (or get collected at the bar).

**Core value props:**
1. **Trade prices.** Daniel buys in bulk for the bars, so members get bottles at trade — significantly under retail.
2. **Curated, not algorithmic.** A real sommelier's actual picks, not a recommendation engine.
3. **Frictionless ordering.** Text in, reply with a number, done. No app, no checkout flow.
4. **A direct line to Daniel.** Ask questions, request specific wines, get advice — same thread.
5. **Free storage and shipping.** Bottles sit in the cellar until you've got a case; shipping is on us.

This spec defines the first paid acquisition test on Google Ads. The goal is to learn cheaply: what kinds of searches actually convert into sign-ups, before scaling spend.

**IMPORTANT — earlier drafts of this spec mis-framed the product as an SMS advice service.** The advice / sommelier-on-text element is real, but it's the *texture* of the experience, not the core offer. The core offer is **curated, trade-priced wine delivered through a text-based ordering channel.** All ad copy, keywords, and landing pages should lead with the wine + price + curation, with the text-based mechanic as supporting detail.

## 2. Objective

Drive SMS sign-ups at https://thecellar.club from a focused North East England audience. Treat this as a **learning campaign**, not a scale campaign — the win condition is identifying which keyword themes convert, not maximising clicks.

**Primary KPI:** Cost per sign-up (CPA)
**Secondary KPIs:** CTR, landing-page conversion rate, search-term quality (manual review weekly)
**Target CPA for the test:** under £15 per sign-up. Above £25, pause and reassess.

## 3. Constraints

| Constraint | Value |
|---|---|
| Monthly budget | £400 (≈ $500) |
| Daily cap | £13 |
| Geography | North East England — specifically: Newcastle upon Tyne, Gateshead, Sunderland, Durham, Middlesbrough, Stockton-on-Tees, Darlington, Hexham, Berwick-upon-Tweed |
| Network | Google Search only — no Display, no Search Partners, no YouTube |
| Languages | English |
| Devices | All — but bid-adjust mobile +15% (SMS service, mobile-first audience) |
| Audience | Aspiring wine enthusiasts + general wine lovers. NOT collectors, NOT trade buyers |

## 4. Strategy: why we are NOT bidding on "expensive wine" keywords

Julia's initial instinct was to cover keywords like "best Barolo", "expensive red wine", "top rated Bordeaux". **Don't build the campaign around these.** Reasons:

1. **Buyer intent, not advice intent.** Someone searching "best Barolo 2018" wants to *buy a bottle*. The Cellar Club doesn't sell wine. We give advice. That's a fundamental intent mismatch — they bounce.
2. **CPC is brutal.** Retailers (Majestic, Laithwaites, Vivino, Wine Society) bid £2–£5+ on premium varietal terms. With £13/day, 3–4 clicks burns the budget with near-zero conversion.
3. **Audience is wrong.** People searching specific premium varietals already know what they want. Our target is people who *don't* know and want help.

Instead, build around **decision-help and advice-seeking searches**. These are cheaper, less crowded, and intent-aligned with a sommelier service.

## 5. Campaign Structure

One campaign. Four ad groups, each with a tight thematic keyword set so we can read the data per theme.

Match-type convention used below: `"phrase match"` in double quotes; `[exact match]` in square brackets; broad match unmarked. Avoid pure broad match unless paired with Smart Bidding (we're not).

---

### Ad Group 1: Pairing Help
*"What wine goes with X?" — meal-driven decisions. Highest expected intent for a sommelier service.*

**Keywords (15):**
- "wine to pair with steak"
- "what wine goes with pasta"
- "best wine for pizza night"
- "wine pairing for roast dinner"
- "wine to drink with curry"
- "wine for cheese board"
- "what wine with salmon"
- "wine to go with chinese food"
- "what wine pairs with lamb"
- "wine pairing for sunday roast"
- "best wine with bbq"
- [wine pairing help]
- [wine pairing advice]
- [help choosing wine for dinner]
- [wine pairing guide]

**Headlines (12, ≤30 chars — char count in brackets):**
1. Pairing Help, Sent by Text (26)
2. What Wine With Dinner? (22)
3. Tonight's Pairing, Sorted (25)
4. Steak Tonight? Try This Wine (28)
5. The Right Wine for the Meal (27)
6. Sommelier Pairings, by SMS (26)
7. Wine That Actually Pairs (24)
8. Pasta, Roast, Curry — Sorted (28)
9. Text Us What You're Cooking (27)
10. A Pairing in Under a Minute (27)
11. Real Pairings, Real People (26)
12. The Cellar Club (15)

**Long headlines (4, ≤90 chars):**
1. Text us your dinner — we'll text back the wine that actually goes with it (74)
2. Cooking steak, curry, pasta or a Sunday roast? Get the right wine in one text (76)
3. Stop guessing the pairing. A real sommelier replies in under a minute. (70)
4. Pairing help by text, from people who do this for a living, not a guess engine (78)

**Descriptions (4, ≤90 chars):**
1. Text us what's on the menu tonight. We'll text back the wine that goes with it. (80)
2. Real sommelier pairings — no app, no jargon, no scrolling endless wine blogs. (77)
3. From Sunday roasts to Friday curries, get a pairing that actually works. (72)
4. First pairing free. Try it once before dinner and see how much better it lands. (80)

---

### Ad Group 2: Gift & Occasion
*Wine as a gift, dinner party, host situations. High urgency around birthdays, anniversaries, holidays.*

**Keywords (12):**
- "wine to bring to dinner party"
- "good bottle of wine as a gift"
- "wine gift ideas under 30"
- "what wine to take to a host"
- "anniversary wine"
- "wine for parents in law"
- "wine present ideas"
- "wine to impress at dinner"
- "host gift wine"
- [best wine to gift]
- [wine recommendations for a gift]
- [wine to bring as a present]

**Headlines (12, ≤30 chars):**
1. A Wine Gift That Lands Well (27)
2. Impress the Host, First Try (27)
3. The Right Bottle, Every Time (28)
4. Don't Show Up Empty-Handed (26)
5. Dinner Party Wine, Sorted (25)
6. Anniversary? Ask Us. (20)
7. Gift Wine Without the Guess (27)
8. Hosts Will Actually Like It (27)
9. Sommelier-Picked Gift Wine (26)
10. Text Us, We'll Pick (19)
11. Better Than a Bottle of Plonk (29)
12. The Cellar Club (15)

**Long headlines (4, ≤90 chars):**
1. Tell us the occasion and budget — we'll text back a bottle worth bringing (74)
2. Anniversary, dinner party, new neighbours — get a wine the host will love (74)
3. Stop bringing the same supermarket bottle. One text, one great pick. (68)
4. Real sommeliers pick the gift wine for you, sized to your budget (64)

**Descriptions (4, ≤90 chars):**
1. Text us the occasion and your budget. We'll text back a bottle that lands. (75)
2. From dinner parties to anniversaries, the right wine in one text. (65)
3. No more wandering the supermarket aisle hoping. We've done this thousands of times. (84)
4. First gift recommendation free. Skip the guesswork, impress the host. (69)

---

### Ad Group 3: Discovery — "I Like X, What Should I Try?"
*People expanding their taste. Strongest fit for aspiring enthusiasts. Highest long-term LTV.*

**Keywords (15):**
- "wine similar to malbec"
- "if i like merlot what should i try"
- "wines like prosecco"
- "alternative to pinot grigio"
- "wines for someone who likes cabernet"
- "wines like rioja"
- "if you like sauvignon blanc try"
- "what to drink instead of prosecco"
- "wine similar to chardonnay"
- "wines for malbec lovers"
- [wine recommendations like]
- [learn about wine]
- [how to choose wine]
- [wine for beginners]
- [next wine to try]

**Headlines (12, ≤30 chars):**
1. Like Malbec? Try This. (22)
2. Find Your Next Favourite (24)
3. Wine, Without the Snobbery (26)
4. Beyond Your Usual Bottle (24)
5. Step Up From Prosecco (21)
6. New Wine, Same Vibe (19)
7. We Pick. You Try. (17)
8. A Sommelier Knows Better (24)
9. Discover, One Text Away (23)
10. Trade Up From Pinot Grigio (26)
11. The Wine You'll Actually Love (29)
12. The Cellar Club (15)

**Long headlines (4, ≤90 chars):**
1. Tell us what you already love. We'll text you the next bottle worth trying. (75)
2. Like Malbec, Rioja or Sauvignon Blanc? We know exactly what to send you next (76)
3. A sommelier picks your next wine — based on what's already in your fridge (74)
4. Learn wine the easy way. One text at a time, from real experts. (62)

**Descriptions (4, ≤90 chars):**
1. Tell us what you already drink. We'll text the next bottle you'll actually love. (81)
2. No grape diploma needed. Just text — get a curated step beyond your usual. (74)
3. Real sommeliers, plain English, picks based on what you actually like. (70)
4. First recommendation free. Start widening what you drink, one text at a time. (78)

---

### Ad Group 4: In-the-Moment Help (restaurant / shop)
*People stuck in front of a wine list or shop shelf right now. Highest urgency, smallest audience.*

**Keywords (12):**
- "how to pick wine at restaurant"
- "wine list help"
- "how to choose wine in supermarket"
- "stuck choosing wine"
- "what wine to order at restaurant"
- "best wine in tesco"
- "supermarket wine recommendations"
- [wine recommendation app]
- [ask sommelier]
- [personal sommelier]
- [wine advice text service]
- [help me pick a wine]

**Headlines (12, ≤30 chars):**
1. Frozen at the Wine List? (24)
2. Help, Right When You Need It (28)
3. Wine List SOS (13)
4. Stuck in the Wine Aisle? (24)
5. Text Us. We'll Pick. (20)
6. Sommelier in Your Pocket (24)
7. Skip the Wine Aisle Panic (25)
8. Don't Pick Second-Cheapest (26)
9. We've Got You. One Text. (24)
10. Restaurant Wine, Solved (23)
11. Aisle Help in 60 Seconds (24)
12. The Cellar Club (15)

**Long headlines (4, ≤90 chars):**
1. Standing in the wine aisle? Text us the situation, we'll pick the bottle (72)
2. Wine list anxiety, solved — text the menu, get the order in seconds (67)
3. Real sommelier, ready when you need them. No app to download, just text. (72)
4. Stop ordering the second-cheapest by default. We've got you, one text away (74)

**Descriptions (4, ≤90 chars):**
1. Text us the wine list or aisle. We'll text back what to order, in seconds. (74)
2. Built for the moment you're stuck — restaurant, shop, dinner party. (67)
3. No app, no sign-in, no scrolling. Just text and a sommelier replies. (68)
4. First pick free. Try us next time the wine list shows up at the table. (71)

---

### Negative Keywords (campaign-level, applied to all ad groups)

Add these to prevent wasted spend on wrong intent:

```
free
cheap
buy
delivery
near me
shop
case of
wholesale
trade
job
career
course
diploma
WSET
sommelier course
how to become
recipe
cocktail
sangria
mulled
non-alcoholic
alcohol-free
investment
cellar storage
wine fridge
wine rack
glass
opener
corkscrew
```

Review search terms report weekly and add new negatives — this list will grow.

### Campaign type and "search themes"

This is a **Search** campaign — not Performance Max, not Display, not Demand Gen. Google's UI defaults new campaigns to Performance Max and it's easy to land in the wrong type by accident.

When creating each ad group, Google may also show a "Search themes" field (a newer beta on Search campaigns; native to Performance Max). **Leave it blank.** Reasons:
- We have a deliberately tight, intent-matched keyword list — that's the control surface for this learning test.
- Search themes give Google's matching algorithm extra licence to expand reach, which is the opposite of what a £400 learning budget needs.
- If we layered them on at launch and CPA went sideways, we wouldn't know whether to blame keywords or themes.

If we ever revisit this: only add search themes once we have a clear winning ad group with stable CPA, as an expansion lever — never at launch.

## 6. Bidding & Budget

- **Bid strategy:** Manual CPC for the first 4 weeks. We don't have conversion volume yet for Smart Bidding to work properly. After 30+ conversions, switch to Maximize Conversions with a target CPA.
- **Starting max CPC:** £0.80 across all ad groups. Adjust per ad group after week 1 based on Search Impression Share and average position.
- **Daily budget:** £13/day, even pacing (not accelerated).

## 7. Ad Copy: building the RSAs

For each of the four ad groups, build **one Responsive Search Ad** using the headlines, long headlines, and descriptions specified per-ad-group in section 5. RSA assembly rules:

- Use **all 12 headlines** for that ad group (Google allows up to 15; 12 gives the algorithm enough variety to lift Ad Strength to "Good" or "Excellent" without thinning each one)
- Use **all 4 long headlines** for that ad group
- Use **all 4 descriptions** for that ad group (Google allows up to 4)
- **Path 1:** `/text` — **Path 2:** `/sommelier` (these appear in the display URL: `thecellar.club/text/sommelier`)
- Pin only one headline (the brand: "The Cellar Club") to **Headline Position 3**. Don't pin anything else — pinning kills Ad Strength fast
- Final URL: per-ad-group landing page (see section 9). Phase 1 fallback: homepage with UTM tagging

### Why ad strength has been poor

If the current ads are scoring "Poor" or "Average" on Ad Strength, almost certainly because: (a) too few unique headlines, (b) headlines repeat the same words, (c) no long headlines populated, (d) over-pinning. The per-ad-group specs above fix all four.

### Final URL fallback (Phase 1, before per-ad-group landing pages exist)
`https://thecellar.club/?utm_source=google&utm_medium=cpc&utm_campaign=ne_england_launch&utm_content={adgroup}&utm_term={keyword}`

Use ValueTrack parameters `{adgroup}` and `{keyword}` so we can read which terms convert.

### Sitelinks (4)

We only have two real pages right now (`/` and `/tiers`), so three sitelinks point to home and one points to tiers. Each one frames the offer through a different angle so the user gets four distinct reasons to click — Google allows multiple sitelinks to share a destination URL as long as the visible text is different. Char counts in brackets (Google limits: title ≤25, descriptions ≤35 each).

**1. How It Works**
- Title: How It Works (12)
- Description 1: Text a question. Get a wine. (28)
- Description 2: No app, no jargon, no faff. (27)
- URL: `https://thecellar.club/?utm_source=google&utm_medium=cpc&utm_campaign=ne_england_launch&utm_content=sitelink_how`

**2. Try Your First Pick**
- Title: Try Your First Pick (19)
- Description 1: First recommendation is free. (30)
- Description 2: Sign up in under a minute. (26)
- URL: `https://thecellar.club/?utm_source=google&utm_medium=cpc&utm_campaign=ne_england_launch&utm_content=sitelink_trial`

**3. Membership Tiers**
- Title: Membership Tiers (16)
- Description 1: Three tiers to suit how you drink. (33)
- Description 2: Earn perks the more you sip. (28)
- URL: `https://thecellar.club/tiers?utm_source=google&utm_medium=cpc&utm_campaign=ne_england_launch&utm_content=sitelink_tiers`

**4. Wine, Without the Snobbery**
- Title: Wine Without Snobbery (21)
- Description 1: For curious drinkers, not snobs. (32)
- Description 2: Real sommeliers, plain English. (31)
- URL: `https://thecellar.club/?utm_source=google&utm_medium=cpc&utm_campaign=ne_england_launch&utm_content=sitelink_approachable`

When `/about`, `/how-it-works`, or `/faq` pages exist, repoint sitelinks 1 and 4 to the more specific URLs — same text can stay.

## 8. Conversion Tracking (BLOCKING — do this first)

The campaign is meaningless without conversion tracking. Implement before launch:

1. **Primary conversion:** SMS sign-up completion. Fire on the page/event that confirms a phone number was submitted and verified.
2. **Secondary (micro) conversion:** Click on the SMS sign-up CTA from the landing page. Useful as a leading indicator while sign-up volume is low.
3. **Set up via Google Tag Manager** if not already in place. Avoid hardcoding gtag snippets — Julia will want to swap providers later.
4. **Verify with Google Tag Assistant** before going live. A campaign running blind for even 3 days at £13/day wastes £40 of a £400 budget.

## 9. Per-Ad-Group Landing Pages

### Why this matters more than ad strength

Ad Strength is a Google scoring metric. **Message match** — the alignment between the ad someone clicked and the page they land on — is what actually moves conversion rate. A user clicking "Pairing Help, Sent by Text" who then lands on a generic homepage about a "personal sommelier service" experiences a small cognitive dissonance that costs sign-ups. Per-ad-group landing pages remove that gap.

### Approach: phased rollout, not all four upfront

Building four bespoke pages before any conversion data is over-engineering. Build in two phases:

- **Phase 1 (weeks 1–2):** Run all four ad groups against the existing `https://thecellar.club` homepage with UTM tagging, so we read which theme converts best.
- **Phase 2 (weeks 3+):** Build dedicated landing pages **only for the top 1–2 ad groups by CPA**. Re-test those ad groups with the new pages and measure conversion lift vs. the homepage baseline.

This way we only spend build effort on themes that actually convert.

### Pages to build in Phase 2 (spec for Claude Code when triggered)

Each landing page is a **variant of the homepage**, not a new page from scratch. Same layout, same trust elements, same SMS sign-up flow. Only the hero section copy and one supporting paragraph change.

**Routes:**
- `/lp/pairing` — for Ad Group 1
- `/lp/gift` — for Ad Group 2
- `/lp/discover` — for Ad Group 3
- `/lp/help` — for Ad Group 4

**Implementation note for Claude Code:** create a `[slug]` route under `app/lp/[slug]/page.tsx` that renders the homepage with a slug-keyed copy override. Keep the variants in a single `lib/lp-variants.ts` module (not separate files) so they're easy to A/B and the divergence stays minimal. Don't fork the homepage component.

**Per-page copy:**

#### `/lp/pairing` — Ad Group 1
- **H1:** Wine pairings, sent by text.
- **Sub:** Tell us what you're cooking. We'll text back the bottle that goes with it. From Sunday roasts to Friday curries — first pairing is on us.
- **CTA:** Get tonight's pairing
- **Social proof line:** "Daniel saved my anniversary dinner — perfect bottle, ten minutes before guests." — *Sarah, Newcastle* (use real testimonial when available; placeholder until then)

#### `/lp/gift` — Ad Group 2
- **H1:** The wine gift that actually lands.
- **Sub:** Anniversary, dinner party, host gift, new neighbours. Tell us the occasion and budget — we'll text back a bottle worth bringing. Real sommeliers, no guessing.
- **CTA:** Pick the gift wine
- **Social proof line:** Use a "host impressed" testimonial.

#### `/lp/discover` — Ad Group 3
- **H1:** You like Malbec. We know what's next.
- **Sub:** Tell us what you already drink and we'll text the next bottle worth trying. Real sommeliers picking based on what's already in your fridge — no grape diploma required.
- **CTA:** Find your next bottle
- **Social proof line:** Use a "discovery / new favourite" testimonial.

#### `/lp/help` — Ad Group 4
- **H1:** Frozen at the wine list? We've got you.
- **Sub:** Stood in the wine aisle or staring at a 60-bottle restaurant list? Text us — a real sommelier replies in seconds with what to order. No app, no sign-in.
- **CTA:** Text us now
- **Social proof line:** Use a "saved me at the restaurant" testimonial.

### Shared elements (do NOT change between variants)

- SMS sign-up CTA position (must stay above the fold on mobile)
- Three-tier explanation
- FAQ section
- Footer
- Trust signals (sommelier credentials, member count, location)

### Landing page conversion checklist (applies to all variants)

- [ ] SMS sign-up CTA above the fold on mobile (test on iPhone SE viewport)
- [ ] Hero H1 visible without scrolling on a 360px wide screen
- [ ] Page loads under 2 seconds on simulated 4G (Lighthouse score > 80 on mobile)
- [ ] UTM parameters propagate from URL to the sign-up event for attribution
- [ ] Conversion event fires on phone-number-verified, not on page load

### Pre-Phase-2 sanity check on the homepage

Before Phase 1 launches, sanity-check the existing `https://thecellar.club`:
- SMS sign-up CTA above the fold on mobile?
- Value prop ("text us, get wine advice") clear in the first 5 seconds?
- Page loads in under 2 seconds on 4G?

If any are no, fix the homepage first — the ads are not the bottleneck.

## 10. Reporting & Review Cadence

- **Daily (first 7 days):** Quick check on spend, CTR, search terms. Add obvious negatives. Pause keywords with >50 impressions and 0 clicks after day 4.
- **Weekly:** Full review — CPA per ad group, ad copy performance (RSA asset reporting), search term mining for new negatives and new keyword ideas.
- **Day 30:** Decision point. Either: (a) double down on the winning ad group and cut the others, (b) restructure if no clear winner, or (c) kill the test if CPA is consistently above £25 with no improvement curve.

## 11. What success looks like at day 30

- 25+ SMS sign-ups attributable to Google Ads
- CPA under £15 on at least one ad group
- A clear-enough signal on which theme (pairing / gift / discovery / in-the-moment) is the strongest converter to inform the next £400

If we hit those, the next step is scaling spend on the winner and expanding geo (probably Edinburgh + Yorkshire next, similar profile, similar CPCs).

## 12. Open questions for Julia before Claude Code starts building

1. Is conversion tracking already wired up on `thecellar.club`? If not, that's the first build task before the campaign goes live.
2. Do we have a Google Ads account already, or does one need to be created under the bothy.club domain?
3. Is there a brand-name campaign already running (people searching "the cellar club" directly)? If yes, exclude that traffic from this campaign so we don't double-attribute.
