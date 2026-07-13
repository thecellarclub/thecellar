# The Cellar Club — Revenue Analysis & Growth Plan

*Based on live Supabase data, 4 May – 22 Jun 2026 (first 7 weeks of real campaigns). All figures are confirmed, paid orders unless stated.*

## The headline numbers

- **£9,044** total confirmed revenue, **369 bottles**, **222 orders**, across **15 real campaigns** (~1 per 3 days).
- **53 people** have ever bought (you guessed 30–40 — it's a bit wider, but the core is ~36 regulars who've ordered 5+ times).
- **Average buyer spend: £171** over the period. Median £134. Top buyer £771.
- **Avg ~4.2 orders per buyer.** This base is *devoted* — they're buying roughly every campaign.
- Per campaign you're netting **~£430 and ~16 bottles** off ~190 recipients.

The business right now is a small, intensely loyal core. The money question isn't "are these people engaged" — they are. It's "why is so much of the list not converting, and how much more would the core spend."

## The single biggest leak: activation

This is the most important finding by far.

| Stage | Count |
|---|---|
| Total subscribers | 241 |
| Active subscribers | 217 |
| Have saved a card | 111 |
| **Have ever bought** | **53** |
| Active subscribers with **no card on file** | 109 |
| **Card on file but never ordered** | **58** |

Two enormous, fixable gaps:

1. **58 people saved a payment card and then never bought a single bottle.** They cleared the hardest hurdle — handing over card details — and stalled. That's not a demand problem, it's a nudge/onboarding problem. Converting even half of them at the average £171 is **~£5,000**, more than half your revenue to date.
2. **109 active subscribers have no card at all.** They opted in but never got to checkout. A focused "save your card, get first-order priority" push could pull a chunk of these into the funnel.

You're spending effort sourcing great wine and texting it to a list that is **78% dormant**. The wine is working. The funnel is leaking.

## Best day, time, and wine type

### Time of day — very clear signal
Orders cluster hard in the **early evening**:

- **19:00–20:00 is the sweet spot: 133 of 222 orders (60%).**
- 18:00–21:00 captures **82%** of all orders.
- Before 16:00: almost nothing.

Your current sends are already mostly 18:00–20:00 — keep that, and standardise on **~19:00**. The two best-known "send at" hours are 19:00 and 20:00; mornings and afternoons are wasted.

### Day of week — real but partly confounded
By order volume: **Thursday is strongest** (58 orders, £2,346), then Wed (46) and Fri (37). Sat is dead (5 orders). But you also *send* more on those days, so this partly reflects send schedule, not pure demand. The cleaner read from per-campaign conversion: midweek evenings (Tue–Thu, ~19:00) reliably hit 6–10% conversion; weekend sends underperform. **Default to Tue–Thu ~19:00. Avoid Saturday entirely.**

### Wine type — what actually sells
Ranked by revenue per recipient (the metric that matters — strips out list-size growth):

| Wine | Country | Price | Conv % | £/recipient |
|---|---|---|---|---|
| Silverhand Blanc de Blancs (sparkling) | UK | £29 | 6.4% | **£3.88** |
| Khakibos | South Africa | £30 | 6.8% | **£3.22** |
| Roter Veltliner | Austria | £16 | 9.6% | £2.87 |
| N.28 Cabernet | China | £26.50 | 6.0% | £2.82 |
| Abstraction #3 (Loire) | France | £27 | 6.9% | £2.78 |
| *(worst)* Bruno Andreu Syrah | France | £19 | 3.0% | £0.81 |
| *(worst)* La Mascara red blend | Uruguay | £23 | 2.8% | £1.06 |

Patterns in the data:

- **Price does not hurt demand.** £28+ wines convert at 6.6% — *better* than £20–24 wines (4.7%). Your buyers are buying the story and the scarcity, not the price tag. **This is your strongest signal that you can charge more.**
- **The top two earners were your two most expensive wines** (£29–30), one of them sparkling.
- **"Novelty + narrative" wins.** China (Ningxia), Austria, the Loire "Abstraction" all over-performed. The flops were the more generic-sounding French/Uruguay reds.
- **Speed = desirability.** Median time-to-order on the best wines was 2–8 minutes. People who want it reply almost instantly, which validates capping quantity for scarcity.

## Order size & the 24-bottle cap

Bottles per order: **115 orders were 1 bottle, 81 were 2.** Very few buy 3+. Average order is **1.66 bottles**. Capping at 24 for scarcity is fine operationally — almost nobody is bumping the cap, so it costs you nothing and the "limited" framing is doing real work (those 2-minute order times). Keep it.

## Case completion — money sitting idle

- **225 bottles are in cellars unshipped**, across **44 customers**.
- Only **2 of 15 shipments** are marked delivered.

A case is 12 bottles and triggers a shipment. With 44 people accumulating and an average of ~1.66 bottles per order, most are mid-case. The faster someone completes a case, the faster they re-engage for the *next* one. Anything that nudges people from 8→12 bottles accelerates the whole flywheel (and the shipment fee revenue).

---

## What to do about it

### Tier 1 — fix the leak (biggest, fastest money, no new wine needed)

1. **Win back the 58 "card-saved, never-ordered."** They're pre-qualified. A warm, personal text — "We saved you a spot, here's a wine we think is *you*" — on the next strong midweek campaign. Even 40% conversion ≈ **£4,000**.
2. **Card-capture push for the 109 active-but-cardless.** One-tap card save with a hook (priority on the next limited drop, or a small welcome perk). Every card saved historically becomes a buyer ~48% of the time.
3. **Standardise sends to Tue–Thu, 19:00.** Stop sending weekends. This alone lifts conversion on the same wine and effort.

### Tier 2 — deepen the core (price & frequency)

4. **Raise prices / lean into premium.** Demand is price-insensitive in your range and your two top earners were your priciest. Test a £32–38 "cellar reserve" drop to the core 36 regulars. Margin uplift with little volume risk.
5. **Premiumise the mix.** Bias selection toward novelty + narrative + sparkling (the proven winners), and cut the generic mid-priced reds that flopped (3% conversion is wasted send).
6. **Case-completion nudges.** When someone's at 8–10 bottles, text the gap ("3 to go for your case"). Speeds shipments and re-engagement.

### Tier 3 — new revenue streams

7. **Membership / subscription tier.** Your buyers already act like subscribers (4+ orders each). Formalise it: a paid membership (e.g. £15–20/mo or annual) for early access to drops, a guaranteed monthly bottle, members-only wines, or free shipping on case completion. Converts spiky transactional revenue into predictable recurring revenue — and the tier fields already exist in your schema.
8. **The two venues are an untapped asset.** You have Crush (80 wines by the glass) and Norse (the cellar). Run **members-only tasting/collection events at Norse** — ticketed, paired with a drop. Turns the SMS club into a community, deepens loyalty, and is a high-margin revenue line. Collection bookings already exist in the product.
9. **Gifting & referrals.** 53 devoted buyers are your best acquisition channel. A "gift a bottle / gift a case" SKU around occasions, plus a referral perk (both sides get a wine credit), grows the list with *pre-warmed* leads rather than cold ones.
10. **Bundles / "double drops."** Since most orders are 1–2 bottles, occasionally offer a curated pair (e.g. "this week's white + the producer's red") at a slight bundle price to lift AOV from 1.66 toward 2.5+.

### Growth vs. deepen — where to focus
Your data says **deepen before you grow.** A bigger list won't help while 78% of the current one is dormant. Fix activation (Tier 1) and monetise the core harder (Tier 2–3) first; that's ~£9–14k of upside from people *already on the list*. Then turn the loyal core into a referral engine (Tier 3.9) so new growth arrives pre-qualified rather than as more dormant numbers.

---

*Caveats: 7 weeks of data, single seasonal window. Conversion-by-day is partly confounded by send schedule. Re-run after another 4–6 weeks to confirm the price-insensitivity and day-of-week reads before committing to a price rise.*
