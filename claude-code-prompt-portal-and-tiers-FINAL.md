# Claude Code Prompt — Customer Portal + Tier System

Read `winetexts-build-spec.md` in full before starting. Build in the order listed below.

**Tier names (lowest → highest):** Bailey → Elvet → Palatine

---

## 1. Database Migration — 009_portal_and_tiers.sql

**Note:** Migration 008 already added `default_address jsonb` to customers. Do not re-add it.

Create `supabase/migrations/009_portal_and_tiers.sql`:

```sql
alter table customers
  add column if not exists tier text not null default 'none',
  add column if not exists tier_since timestamptz,
  add column if not exists tier_review_at timestamptz,
  add column if not exists backup_payment_method_id text;
```

Run in Supabase SQL editor and confirm before proceeding.

---

## 2. Tier Helper — `lib/tiers.ts`

Create a shared tier logic module. All other parts of the codebase import from here.

**Tier thresholds:**
- `bailey`: first successful order (entry tier, default on first order)
- `elvet`: rolling 12-month spend ≥ £501 (50100 pence)
- `palatine`: rolling 12-month spend ≥ £1,000 (100000 pence)

**Export these functions:**

`getRollingSpend(customerId, supabase): Promise<number>`
— Query `SUM(total_pence)` from `orders` where `customer_id = X AND stripe_charge_status = 'succeeded' AND created_at >= now() - interval '365 days'`. Return 0 if null.

`tierFromSpend(spendPence: number): 'bailey' | 'elvet' | 'palatine'`
— Returns `'palatine'` if ≥ 100000, `'elvet'` if ≥ 50100, else `'bailey'`.

`checkAndApplyTierUpgrade(customerId, supabase, twilio): Promise<string | null>`
— Get rolling spend → derive qualifying tier → if qualifying tier is higher than current tier (or current is 'none'): update customers table (`tier`, `tier_since = now()`, `tier_review_at = now() + interval '12 months'`), send congratulations SMS (copy below), return new tier. Otherwise return null.

**Congratulations SMS copy:**

Upgrading to Elvet:
```
You're now an Elvet member — welcome to the next level.

You've spent £[X] with The Cellar Club this year.

What you now get:
— 5% off every bottle
— Free wine tasting, once a year
— 10 concierge questions a month

[NEXT_PUBLIC_APP_URL]/portal to see your membership.
```

Upgrading to Palatine:
```
You've reached Palatine. That's the top.

You've spent £[X] with The Cellar Club this year.

What that means:
— 10% off every bottle
— Free delivery from 6 bottles
— Quarterly wine tastings
— Unlimited concierge
— A birthday gift from us

[NEXT_PUBLIC_APP_URL]/portal to see your membership.
```

**Delivery threshold helper:**
```ts
export function deliveryThreshold(tier: string): number {
  return tier === 'palatine' ? 6 : 12
}
```

---

## 3. Wire tier logic into payment flows

In `lib/post-charge.ts` (the `handlePostCharge` function):
- After inserting cellar rows, call `checkAndApplyTierUpgrade(customerId, supabase, twilio)`
- Make the case-ready notification threshold tier-aware:
  ```ts
  const threshold = deliveryThreshold(customer.tier)
  // Use threshold instead of hardcoded 12 for Scenario 2 and 3 checks
  ```

In `app/api/webhooks/stripe/route.ts` (for 3DS payment completions):
- Also call `checkAndApplyTierUpgrade` after confirming payment

On first successful order where `customer.tier === 'none'`:
- `checkAndApplyTierUpgrade` will set tier to `'bailey'` — no congratulations SMS for Bailey (it's automatic on signup)
- Exception: only send congrats SMS for Elvet and Palatine upgrades, not Bailey

---

## 4. STATUS command

In `app/api/webhooks/twilio/inbound/route.ts`, add `status` to the command parser:

Reply:
```
You're a [Bailey/Elvet/Palatine] member.

Spent this year: £[X]
[If Bailey: Next tier (Elvet) at £501 — £[gap] to go.]
[If Elvet: Next tier (Palatine) at £1,000 — £[gap] to go.]
[If Palatine: You're at the top. Thank you.]

[NEXT_PUBLIC_APP_URL]/portal for your membership.
```

---

## 5. ACCOUNT command

In `app/api/webhooks/twilio/inbound/route.ts`, add `account` to the command parser:

Reply:
```
Manage your address, payment method and membership here:
[NEXT_PUBLIC_APP_URL]/portal
```

---

## 6. Update menu reply

In the unrecognised message handler, update the menu to include both new commands:
```
Hey! Here's what you can do:

CELLAR — see what's in your cellar
SHIP — send your bottles (free at 12, £15 before that)
STATUS — see your membership tier
ACCOUNT — manage your address, payment and membership
REQUEST — suggest a wine for us to feature
QUESTION — ask us anything
STOP — unsubscribe

Just reply with one of the above.
```

---

## 7. Tier review in daily cron

In `app/api/cron/case-nudges/route.ts`, add tier review logic after the existing case nudge logic:

For each active customer where `tier_review_at <= now()`:
1. Get rolling 12m spend
2. Derive qualifying tier using `tierFromSpend()`
3. Compare to current tier. If qualifying tier < current tier, drop one tier at a time: palatine → elvet, elvet → bailey
4. Update: `tier = newTier`, `tier_since = now()`, `tier_review_at = now() + interval '12 months'`
5. If downgraded, send SMS:
   ```
   Your Cellar Club membership has moved to [new tier].
   Keep ordering to work your way back up.
   [url]/portal for your membership.
   ```
6. If tier unchanged: just update `tier_review_at = now() + interval '12 months'`

---

## 8. Customer Portal — `/portal`

### New env var
Add `PORTAL_JWT_SECRET` to `.env.local` and Vercel. Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

### `lib/portal-auth.ts`
- `signPortalToken(customerId, phone)` — sign JWT with `PORTAL_JWT_SECRET`, 30-day expiry
- `verifyPortalToken(token)` — verify + return payload or throw
- `getPortalSession(request)` — read `portal_session` httpOnly cookie, verify, return customerId

### Login pages

**`app/portal/page.tsx`** — phone input
- Same visual style as `/join` pages (dark maroon, cream, Rio Red CTA)
- "Welcome back" heading — this is for existing members only
- Submit → POST `/api/portal/send-otp`

**`app/portal/verify/page.tsx`** — 6-digit OTP input
- Same style as `/join/verify`
- Submit → POST `/api/portal/verify-otp` → redirect to `/portal/dashboard`

### API routes

**`POST /api/portal/send-otp`**:
1. Normalise phone to E.164
2. Check customer exists + `active = true`. If not: return error "We don't recognise that number."
3. Generate 6-digit code, insert into `verification_codes` (expires 10 min)
4. Send via Twilio, return 200

**`POST /api/portal/verify-otp`**:
1. Check code valid (exists, matches, unused, unexpired, attempt_count < 3)
2. If valid: mark used, sign portal JWT, set httpOnly cookie `portal_session` (30 days), return redirect to `/portal/dashboard`
3. If invalid: increment attempt_count, return error

**`POST /api/portal/logout`**: Clear `portal_session` cookie

### Dashboard — `app/portal/dashboard/page.tsx`

Auth-gated (redirect to `/portal` if no valid session). Fetch all data in one call to `GET /api/portal/me`.

**`GET /api/portal/me`** returns:
```ts
{
  customer: { id, first_name, phone, tier, tier_since, default_address },
  cellar: [{ wine_name, quantity, price_pence, added_at }],
  cellarTotal: number,
  caseDeadline: string | null,      // case_started_at + 90 days, formatted "15 June"
  rollingSpend: number,             // pence
  primaryCard: { last4, brand, exp_month, exp_year } | null,
  backupCard: { last4, brand, exp_month, exp_year } | null,
}
```
Fetch card details from Stripe using `stripe.paymentMethods.retrieve()`.

**Dashboard layout (top to bottom, mobile-first, matches site design system — dark background, cream text, Rio Red accents):**

### Section 1 — Tier card (full width, most prominent)

- Tier name: large Cormorant Garamond all-caps (BAILEY / ELVET / PALATINE)
- "Member since [Month Year]"
- "£[X] spent this year"
- Progress bar: Rio Red fill, cream track
  - Bailey → Elvet: `rollingSpend / 50100 * 100%`
  - Elvet → Palatine: `rollingSpend / 100000 * 100%`
  - Palatine: full bar, gold colour, "You're at the top"
- "£[gap] until [next tier]" or "Palatine — the highest level"
- Mini perks summary (2 lines: most notable current perks)
- Card background: `#1E0B10`, border-top:
  - Bailey: `3px solid #9B1B30` (Rio Red)
  - Elvet: `3px solid #C9851D` (Gold)
  - Palatine: `3px solid #C9851D` with subtle glow

### Section 2 — Cellar

- "YOUR CELLAR" label (small caps, gold, tracked)
- If empty: "Your cellar is empty — watch out for our next text."
- If bottles: wine list with quantities
- "[n] bottles in your cellar"
- If `case_started_at` set: "Fill your case by [deadline] for free shipping"
- Palatine: threshold is 6 bottles, not 12

### Section 3 — Payment

- "PAYMENT" label
- Primary card: "[Brand] •••• [last4], exp [MM/YY]" — "Update" button
- Backup card: same or "No backup card" — "Add backup" or "Update" button
- If backup exists: "Make this my primary" button
- Updating a card: inline Stripe Elements card input. On success:
  - `POST /api/portal/update-card` with `{ type: 'primary' | 'backup', paymentMethodId }`
  - Route: detach old PM from Stripe, attach new PM, update `customers` table

**`POST /api/portal/swap-cards`**: swap `stripe_payment_method_id` ↔ `backup_payment_method_id` in Supabase + update default PM in Stripe customer

### Section 4 — Delivery address

- "DELIVERY ADDRESS" label
- Show `default_address` if set, else "No address saved"
- Edit form: line1, line2 (optional), city, postcode
- Save → `POST /api/portal/update-address` → update `customers.default_address`

---

## 9. Homepage — Tier section (Section 5)

Add to `app/page.tsx` between The Story section and the footer.

Background: `#120608`. Section label: `THE LEVELS` (small caps, tracked, gold, centred).

Intro line (centred, Spectral, cream, max-width 560px):
> *Spend more, get more. Here's what membership looks like.*

Three tier cards side-by-side on desktop, stacked on mobile:

**Bailey** (Rio Red 2px top border):
```
BAILEY
Entry level
— Free delivery (per 12 bottles)
— Free storage (up to 3 months)
— Build your own case
— Unlimited special requests
— Wine concierge (5 questions/month)
```

**Elvet** (Gold 2px top border):
```
ELVET
FROM £501 / YEAR
— Free delivery (per 12 bottles)
— Free storage (up to 3 months)
— Build your own case
— Unlimited special requests
— Wine concierge (10 questions/month)
— 5% off every bottle
— Free wine tasting (once a year)
```

**Palatine** (Gold 3px top border, slightly elevated — `translateY(-8px)` on desktop):
```
PALATINE
FROM £1,000 / YEAR
— Free delivery (per 6 bottles)
— Free storage (up to 6 months)
— Build your own case
— Unlimited special requests
— Unlimited wine concierge
— 10% off every bottle
— Free wine tasting (quarterly)
— Birthday gift
— Wine texts two hours early
```

Each card: background `#1E0B10`, faint cream border `rgba(240,230,220,0.12)`, tier name in large Cormorant Garamond all-caps, threshold in gold small tracked caps, benefits in Spectral with `—` prefix. No icons, no ticks.

Below the cards (centred, small Spectral, muted cream):
> *Your tier updates automatically based on your spend over the past 12 months.*

---

## 10. Portal links in existing SMS flows

Wherever `[url]/billing` appears in SMS copy, add a portal mention:
- Failed payment SMS: "Update your card at [url]/portal or [url]/billing"
- Post-shipment confirmation: append "View your membership at [url]/portal"

---

## New files to create

- `supabase/migrations/009_portal_and_tiers.sql`
- `lib/tiers.ts`
- `lib/portal-auth.ts`
- `app/portal/page.tsx`
- `app/portal/verify/page.tsx`
- `app/portal/dashboard/page.tsx`
- `app/api/portal/send-otp/route.ts`
- `app/api/portal/verify-otp/route.ts`
- `app/api/portal/logout/route.ts`
- `app/api/portal/me/route.ts`
- `app/api/portal/update-address/route.ts`
- `app/api/portal/update-card/route.ts`
- `app/api/portal/swap-cards/route.ts`

## Files to modify

- `lib/post-charge.ts` — tier upgrade check + tier-aware delivery threshold
- `app/api/webhooks/twilio/inbound/route.ts` — STATUS, ACCOUNT, updated menu
- `app/api/webhooks/stripe/route.ts` — tier upgrade check after 3DS
- `app/api/cron/case-nudges/route.ts` — tier review logic
- `app/page.tsx` — add Section 5 (tier cards)

## New env vars

- `PORTAL_JWT_SECRET` — add to `.env.local` and Vercel

Build with `npm run build` and deploy with `npx vercel --prod` when done.

---

*Ref: winetexts-build-spec.md Sections 2, 4, 6, 7 | thecellarclub-design-brief.md Section 5*
