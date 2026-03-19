# Claude Code Prompt — Customer Portal + Tier System

Reference `winetexts-build-spec.md` throughout. This is a large feature — build in order.

---

## Part 1 — Database Migration (migration_009)

**Note:** Migration 008 (`008_customer_default_address.sql`) has already been run — it added `default_address jsonb` to customers. Do not re-add that column.

Create `/supabase/migrations/009_portal_and_tiers.sql`:

```sql
-- Tier and portal fields on customers
-- Note: default_address was added in migration 008 — do not add again
alter table customers
  add column if not exists tier text not null default 'none',
  add column if not exists tier_since timestamptz,
  add column if not exists tier_review_at timestamptz,
  add column if not exists backup_payment_method_id text;
```

Run in Supabase and confirm before proceeding.

---

## Part 2 — Tier Helper (`lib/tiers.ts`)

Create a shared module with all tier logic. Other parts of the codebase import from here.

```ts
export type Tier = 'none' | 'elvet' | 'bailey' | 'palatine'

export const TIER_THRESHOLDS = {
  elvet: 0,         // assigned on first order
  bailey: 50100,    // £501 in pence
  palatine: 100000, // £1,000 in pence
}

// Calculate rolling 12-month spend for a customer (pence)
export async function getRollingSpend(customerId: string, supabase): Promise<number>

// Derive what tier a spend amount qualifies for
export function tierFromSpend(spendPence: number): Tier

// Check and apply tier upgrade after a successful payment
// Call this after every successful Stripe charge
// Returns the new tier if upgraded, null if unchanged
export async function checkAndApplyTierUpgrade(customerId: string, supabase, twilio): Promise<Tier | null>
```

`getRollingSpend`: query `orders` where `customer_id = X AND stripe_charge_status = 'succeeded' AND created_at >= now() - interval '365 days'`, return `SUM(total_pence)` or 0.

`checkAndApplyTierUpgrade`:
1. Get rolling spend
2. Derive qualifying tier from spend
3. If qualifying tier is higher than current tier:
   - Update customers: `tier`, `tier_since = now()`, `tier_review_at = now() + interval '12 months'`
   - Send congratulations SMS (see spec Section 7 for copy)
   - Return new tier
4. If first order and tier is 'none': set to 'elvet', same timestamps

---

## Part 3 — Wire tier logic into existing payment flow

In `lib/post-charge.ts` (or wherever `handlePostCharge` lives):
- After inserting cellar rows, call `checkAndApplyTierUpgrade(customerId, supabase, twilio)`

In `app/api/webhooks/stripe/route.ts` (for 3DS completions):
- Same: call `checkAndApplyTierUpgrade` after confirming payment

---

## Part 4 — Palatine 6-bottle delivery threshold

In `handlePostCharge`, the threshold for triggering the "case ready" notification is currently hardcoded at 12. Make it tier-aware:

```ts
const deliveryThreshold = customer.tier === 'palatine' ? 6 : 12
```

Palatine members get the same "your case is ready to ship, free" notification at 6 bottles that everyone else gets at 12.

---

## Part 5 — ACCOUNT command

In `app/api/webhooks/twilio/inbound/route.ts`, add `account` to the command parser:

```
ACCOUNT → send portal link
```

Reply:
```
Manage your address, payment method and membership here:
[NEXT_PUBLIC_APP_URL]/portal
```

Add ACCOUNT to the menu reply alongside STATUS.

---

## Part 6 — STATUS command

In `app/api/webhooks/twilio/inbound/route.ts`, add `status` to the command parser (alongside CELLAR, SHIP, etc.):

```
STATUS → reply with tier, rolling spend, gap to next tier
```

Copy (see spec Section 7):
```
You're an [Elvet/Bailey/Palatine] member.

Spent this year: £[X]
[If not Palatine: Next tier ([Bailey/Palatine]) at £[threshold] — £[gap] to go.]
[If Palatine: You're at the top. Thank you.]

[NEXT_PUBLIC_APP_URL]/portal for your membership.
```

Add STATUS to the menu reply as well:
```
STATUS — see your membership tier and annual spend
```

---

## Part 7 — Tier review in daily cron

In `app/api/cron/case-nudges/route.ts`, add tier review logic:

For each active customer where `tier_review_at <= now()`:
1. Get rolling 12m spend
2. Derive qualifying tier
3. If qualifying tier < current tier: drop **one tier at a time** (palatine → bailey, bailey → elvet)
4. Set new `tier_since = now()`, `tier_review_at = now() + interval '12 months'`
5. If downgraded, send SMS:
   ```
   Your Cellar Club membership has moved to [new tier].
   Keep ordering to work your way back up.
   [url]/portal for your full membership.
   ```
6. If tier unchanged: just update `tier_review_at = now() + interval '12 months'`

---

## Part 8 — Customer Portal (`/portal`)

### Environment variable
Add `PORTAL_JWT_SECRET` to `.env.local` and Vercel. Use `crypto.randomBytes(32).toString('hex')` to generate it.

### Portal session middleware
Create `lib/portal-auth.ts`:
- `signPortalToken(customerId, phone)` → signs a JWT with `PORTAL_JWT_SECRET`, 30 day expiry
- `verifyPortalToken(token)` → verifies and returns payload or throws
- `getPortalSession(request)` → reads `portal_session` cookie, verifies it, returns customer ID

### Portal login pages

**`app/portal/page.tsx`** — phone number input
- Same styling as /join pages (dark background, cream text, Rio Red CTA)
- Form: UK mobile input → POST `/api/portal/send-otp`
- Show "Welcome back" — this is for existing members only

**`app/portal/verify/page.tsx`** — OTP input
- Same as /join/verify
- POST `/api/portal/verify-otp` → on success, redirect to `/portal/dashboard`

**API routes:**

`POST /api/portal/send-otp`:
1. Normalise phone to E.164
2. Check customer exists and is active — if not, reply: "We don't recognise that number. Sign up at [url]/join"
3. Generate 6-digit OTP, insert into `verification_codes` (expires 10 minutes)
4. Send via Twilio
5. Return 200

`POST /api/portal/verify-otp`:
1. Check code: exists, matches, not used, not expired, attempt_count < 3
2. If valid: mark used, sign portal JWT, set httpOnly cookie `portal_session`, redirect to `/portal/dashboard`
3. If invalid: increment attempt_count, return error

`POST /api/portal/logout`:
- Clear `portal_session` cookie

### Portal dashboard

**`app/portal/dashboard/page.tsx`** — server component, auth-gated

On load: call `GET /api/portal/me` to fetch all dashboard data in one request.

`GET /api/portal/me` returns:
```ts
{
  customer: { id, first_name, phone, tier, tier_since, tier_review_at, default_address },
  cellar: [{ wine_name, quantity, price_pence, added_at }],
  cellarTotal: number,
  caseDeadline: string | null,     // case_started_at + 90 days, formatted
  rollingSpend: number,            // in pence
  primaryCard: { last4: string, brand: string, exp_month: number, exp_year: number } | null,
  backupCard: { last4: string, brand: string, exp_month: number, exp_year: number } | null,
}
```

Fetch primary/backup card details from Stripe using `stripe.paymentMethods.retrieve(id)`.

**Dashboard layout (top to bottom, mobile-first):**

---

### Tier card (full width)

Large, visually dominant. Display:
- Tier name: large Cormorant Garamond all-caps (ELVET / BAILEY / PALATINE)
- "Member since [month year]"
- Annual spend: "£[X] this year"
- Progress bar: Rio Red fill, cream track. Width = `(spend / nextThreshold) * 100%`
  - Elvet → Bailey: spend / 501
  - Bailey → Palatine: spend / 1000
  - Palatine: bar is full, gold colour, "You're at the top"
- Gap text: "£[gap] until [next tier]" or "Palatine member — the highest level"
- Mini benefits summary (2 lines only — key perks, not the full list)

Style: dark `#1E0B10` background, tier-specific top border:
- Elvet: `3px solid #9B1B30` (Rio Red)
- Bailey: `3px solid #C9851D` (Gold)
- Palatine: `3px solid #C9851D` with a subtle glow

---

### Cellar section

- "YOUR CELLAR" label (small caps, gold, tracked)
- If empty: "Your cellar is empty — watch out for our next text."
- If bottles: list of wines with quantities
- Cellar total: "[n] bottles"
- If case_started_at set: "Fill your case by [deadline] for free shipping."
- If Palatine: threshold is 6, not 12

---

### Payment section

- "PAYMENT" label
- Primary card: "[Brand] ending ••••[last4], expires [month]/[year]" — with "Update" link
- Backup card: same format or "No backup card" — with "Add" or "Update" link
- If backup exists: "Make this my primary" button (calls swap endpoint)
- Updating either card: inline Stripe Elements card input (same as /billing page). On success, update `stripe_payment_method_id` or `backup_payment_method_id` in Supabase + update in Stripe customer.

---

### Delivery address section

- "DELIVERY ADDRESS" label
- If `default_address` set: show address lines with "Edit" button
- If not set: "No address saved — add one for faster checkout." with "Add address" button
- Edit form: line1, line2, city, postcode (line2 optional)
- Save → POST `/api/portal/update-address` → update `customers.default_address`

---

## Part 9 — Homepage tier section (Section 5)

Add a new section to `app/page.tsx` between The Story (Section 4) and the footer.

**Spec:** See `thecellarclub-design-brief.md` Section 5 — "THE LEVELS".

Three tier cards, side by side desktop / stacked mobile:
- Each card: tier name (large Cormorant Garamond all-caps), spend threshold (gold, small tracked caps), benefits list (Spectral, `—` prefix, no bullets)
- Elvet + Bailey: 2px Rio Red top border
- Palatine: 3px gold top border, slightly elevated (subtle `translateY(-8px)` on desktop, additional padding)
- Benefits: as listed in the design brief

**CTA below the tier cards:**
> *Your tier is calculated automatically based on your spend over the past 12 months.*

Small Spectral text, centred, muted cream. Not a CTA button — just a reassurance line.

---

## Part 10 — Portal link in existing SMS flows

Wherever we currently reference `[url]/billing`, also add a mention of `[url]/portal` where appropriate. Specifically:
- Failed payment SMS: "Update your card at [url]/portal or [url]/billing"
- Post-shipment SMS: "View your membership at [url]/portal"

---

## Summary of new files

- `supabase/migrations/009_portal_and_tiers.sql`
- `lib/tiers.ts` — tier logic helper
- `lib/portal-auth.ts` — JWT sign/verify/middleware
- `app/portal/page.tsx` — login
- `app/portal/verify/page.tsx` — OTP entry
- `app/portal/dashboard/page.tsx` — main dashboard
- `app/api/portal/send-otp/route.ts`
- `app/api/portal/verify-otp/route.ts`
- `app/api/portal/logout/route.ts`
- `app/api/portal/me/route.ts`
- `app/api/portal/update-address/route.ts`
- `app/api/portal/update-card/route.ts`
- `app/api/portal/swap-cards/route.ts`

## Modified files

- `lib/post-charge.ts` — call `checkAndApplyTierUpgrade`, tier-aware delivery threshold
- `app/api/webhooks/twilio/inbound/route.ts` — add STATUS command
- `app/api/webhooks/stripe/route.ts` — call tier upgrade check
- `app/api/cron/case-nudges/route.ts` — add tier review logic
- `app/page.tsx` — add Section 5 (tier cards)

## New env vars

- `PORTAL_JWT_SECRET` — add to `.env.local` and Vercel

---

*Ref: winetexts-build-spec.md Sections 2, 4, 6, 7 | thecellarclub-design-brief.md Section 5*
