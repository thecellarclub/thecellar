# Project: The Cellar Club — Session Log

## What we're building
A wine subscription SMS service for Craig's Crush wine bar in Durham. Customers sign up online, receive 1–2 texts/week with a wine offer, reply with a quantity, confirm with YES, get charged automatically. Bottles are held in cellar until they hit 12 (or 6 for Palatine members) — at which point they get free shipping. Three membership tiers (Bailey / Elvet / Palatine) based on rolling 12-month spend.

## Key people
- **Craig Lappin-Smith** — owner, runs Crush and Norse (two wine bars in Durham)
- **Daniel Jonberger** — sommelier, 20 years in wine, time at Raby Hunt (2 Michelin Stars)

## Tech stack
| Layer | Tool |
|---|---|
| Framework | Next.js (App Router) |
| Database | Supabase (PostgreSQL) |
| Payments | Stripe |
| SMS | Twilio |
| Hosting | Vercel |
| Styling | Tailwind CSS |
| Admin auth | NextAuth |
| Transactional email | Resend |
| Session | iron-session (signup) + custom JWT (portal) |

## Live URLs
- **Production:** https://thecellarclub.vercel.app
- **Twilio webhook:** https://thecellarclub.vercel.app/api/webhooks/twilio/inbound
- **Stripe webhook:** https://thecellarclub.vercel.app/api/webhooks/stripe
- **Cron:** https://thecellarclub.vercel.app/api/cron/case-nudges (runs daily 9am UTC via Vercel Cron)

## Compliance
- Company: CD WINES LTD (No. 15796479)
- Premises Licence: DCCC/PLA0856
- Domain: thecellar.club (registering)

---

## Build status

| Item | Status |
|---|---|
| Project scaffold | ✅ Done |
| Database schema | ✅ Done |
| Sign-up flow (5 steps inc. address) | ✅ Done |
| Twilio inbound webhook | ✅ Done |
| Text blast endpoint | ✅ Done |
| Admin UI (all pages) | ✅ Done |
| Security (rate limiting, RLS, tokens, middleware) | ✅ Done |
| Stripe webhook handler | ✅ Done |
| /ship page | ✅ Done |
| Order confirmation flow (YES to confirm, pending → charge) | ✅ Done |
| 3-month case nudge + auto-ship cron | ✅ Done |
| Manual add stock check fix | ✅ Done |
| Phase 2 SMS commands (CELLAR, SHIP fee, PAUSE, REQUEST, QUESTION) | ✅ Done |
| Admin: requests + concierge pages | ✅ Done |
| Admin: refund + manual add | ✅ Done |
| Sign-up address step (/join/address) | ✅ Done |
| SMS-based SHIP confirmation (YES/CHANGE) | ✅ Done |
| Customer portal (/portal) | ✅ Done (was 404 in prod — fixed by pushing code) |
| Tier system (Bailey / Elvet / Palatine) | ✅ Done |
| Homepage tier section (THE LEVELS) | ✅ Done |
| Admin mobile optimisation (hamburger nav, card layouts, chat-bubble threads) | ✅ Done |
| Email notification fix (REQUEST/QUESTION → hello@crushwines.co) | ✅ Done |
| Spectral font swap | ✅ Done |
| `/authenticate` page (3DS) | ✅ Done |
| `/billing` page (card update) | ✅ Done |
| Compliance pages (/privacy, /terms) | ✅ Done |
| Phone number normalisation bug | ✅ Done (migration 011 apply to live DB) |
| Remove "Crush/Norse guests only" restriction text | ✅ Done |
| Landing page v2 (maroon, bottle SVG, pull quote) | ✅ Done (v2 run) |
| Landing page v3 (revert fonts/sections, new hero, refined quote, tier copy) | ✅ Done |
| Login link for existing members (join page + homepage) | ✅ Done |
| +44 prefix on phone inputs (homepage, join, portal) | ⏳ Prompt ready |
| OFFER SMS command | ⏳ Prompt ready |
| Post-charge Scenario 2 ship SMS bug | ⏳ Prompt ready |
| Welcome SMS with "save this number" instruction | ⏳ Prompt ready |
| Admin panel: payment failure hardening | ✅ Done |
| Admin panel: shipment detail page + dispatch button | ✅ Done |
| Admin panel: concierge desktop two-panel inbox | ✅ Done |
| Admin panel: customer detail page restructure (Cellar/Shipped/Payments) | ✅ Done |
| Concierge: close/reopen thread, ordering, filter | ✅ Done |
| Portal: payments tab + shipments tab | ✅ Done |
| Portal: tier spend progress bar | ✅ Done |
| SMS two-step flow (REQUEST/QUESTION with sms_awaiting state) | ✅ Done |
| Admin panel: font contrast fixes | ✅ Done |
| Refund flow: verify Stripe call vs cellar-only removal | ✅ Done |
| 3DS PaymentIntent expiry handling on /authenticate | ✅ Done |
| Null PM guard in cron case-nudges | ✅ Done |
| Shipping address pre-fill on /ship page | ⏳ Backlog |

---

## Known bugs / outstanding issues

### 1. Phone number normalisation — ✅ Code fixed, migration 011 pending on live DB
Twilio sends `from` in E.164 (+447xxx). Webhook now normalises before DB lookup. Migration 011 normalises existing records. **Apply migration 011 to live Supabase DB.**

### 2. Payment failure — root cause unknown
Stripe is throwing something other than a card decline (generic catch block hit). Logging improved in `admin-qa` prompt so next failure will log `type/code/message`. Most likely cause: payment method not set up for off-session use, or test/live mode mismatch. Check Vercel logs after next failure.

### 3. Post-charge Scenario 2 ship SMS — ✅ Fix written (not yet applied)
`lib/post-charge.ts` Scenario 2 (exactly 12 bottles) sends "We'll text you a delivery link shortly. Reply SHIP any time to confirm your address." — no link is ever sent. Fix: create pending shipment immediately and send the link in the same message (same as Scenario 3). Included in `claude-code-prompt-sms-ui-fixes.md`.

### 4. Refund flow — needs verification
Current RefundButton may only remove cellar rows without calling `stripe.refunds.create()`. Needs to be checked and fixed if so. Covered in `claude-code-prompt-admin-qa.md`.

### 5. 3DS PaymentIntent expiry (~24 hours)
PaymentIntents in `requires_action` state are cancelled by Stripe after ~24h. The /authenticate page needs to handle `canceled` status gracefully. Covered in `claude-code-prompt-admin-qa.md`.

### 6. Twilio display name — not possible for two-way SMS (UK)
UK regulatory rules: alphanumeric sender IDs are one-way only. Two-way SMS requires a mobile number. The mobile number is correct — customers just need to save it. Welcome SMS "save this number as The Cellar Club" instruction added via `claude-code-prompt-sms-ui-fixes.md`.

---

## Claude Code prompts

### Ready to run

| Prompt file | What it covers |
|---|---|
| `claude-code-prompt-sms-ui-fixes.md` | +44 prefix on phone inputs (homepage, join, portal). OFFER SMS command. Post-charge Scenario 2 ship SMS fix. Welcome SMS with "save this number" instruction. |

### Previously run ✅
- `claude-code-prompt-landing-page-v3.md` — revert v2 bulk changes, new hero, styled pull quote, membership card copy ✅
- `claude-code-prompt-admin-qa.md` — payment hardening, shipment detail, concierge desktop two-panel, contrast fixes ✅
- `claude-code-prompt-portal-progress-bar.md` — tier spend progress bar in portal ✅
- `claude-code-prompt-admin-portal-sms-improvements.md` — customer detail restructure, concierge close/filter, portal tabs, SMS two-step flow ✅
- `claude-code-prompt-fixes-2026-03-19.md` — phone normalisation, restriction text removal, UK-only enforcement ✅
- `claude-code-prompt-landing-page-v2.md` — maroon, bottle SVG, pull quote, tier copy, login links ✅
- `claude-code-prompt-order-confirmation.md` ✅
- `claude-code-prompt-portal-and-tiers-FINAL.md` ✅
- `claude-code-prompt-email-notifications-fix.md` ✅
- `claude-code-prompt-admin-mobile.md` ✅

### Migrations to apply to live Supabase DB
After running prompts, these SQL files need to be run in the Supabase SQL editor:
- **011** — normalise existing phone numbers to E.164 (apply now)
- **012** — add `tracking_provider` to shipments (after admin-qa prompt)
- **013** — add `shipment_id` to cellar (after admin-portal-sms prompt)
- **014** — add `concierge_status` to customers (after admin-portal-sms prompt)
- **015** — add `sms_awaiting` to customers (after admin-portal-sms prompt)

---

## Key decisions & design choices

### Ordering flow
- Number reply → creates **pending order** (reserves stock, no charge)
- YES → confirms + charges
- Pending orders expire after 10 minutes — stock released on expiry
- Only one pending order per customer at a time (new one cancels previous)

### SHIP flow
- If `default_address` saved: sends SMS with address for YES/CHANGE confirmation — no link needed
- If no saved address: sends /ship?token link as before
- YES handler checks for pending shipment BEFORE pending order

### 3-month case rule
- Timer (`case_started_at`) starts when first bottle lands in a new case
- Resets after each shipment
- Day 75: nudge 1 (heads up, case closes soon)
- Day 90: nudge 2 (2 weeks left or £15 to ship now)
- Day 104: auto-charge £15 + ship

### Tier system (Bailey → Elvet → Palatine)
- **Bailey**: entry, assigned on first order
- **Elvet**: ≥ £501 rolling 12-month spend
- **Palatine**: ≥ £1,000 rolling 12-month spend
- Status **locked for 12 months** from date earned — no mid-period drop
- Upgrades: immediate on threshold cross
- Downgrades: one tier at a time at annual review date
- All perks marketing-only at launch (discounts, question limits not enforced in code yet)
- Palatine: 6-bottle free delivery threshold (vs 12 for others) — IS code-enforced

### Email
- No order receipt emails — everything via SMS
- Only customer-facing email: shipment dispatch (tracking number)
- Admin notifications: REQUEST + QUESTION → hello@crushwines.co

### SMS commands (full list)
NUMBER, YES, CHANGE, ACCOUNT, STOP/UNSUBSCRIBE, CELLAR, SHIP, SHIP CONFIRM, PAUSE, STATUS, REQUEST, QUESTION, OFFER (adding — see sms-ui-fixes prompt)

### SMS two-step flow (sms_awaiting state) — pending
Currently REQUEST/QUESTION require the trigger word to be repeated in the reply (e.g. "REQUEST Chateau Musar"). This is clunky. New flow: bare trigger word sets `sms_awaiting = 'request'|'question'` on customer. Next inbound message (whatever it says) is processed as the content. EXIT returns to main menu. Backward compat: "REQUEST something" (with content in same message) still works.

### Portal (/portal)
- No-password login via SMS OTP
- Dashboard: tier card (spend + progress bar) → cellar → payment (primary + backup card) → delivery address
- Custom JWT session (PORTAL_JWT_SECRET), 30 days, httpOnly cookie
- Backup payment method stored in `backup_payment_method_id` on customers

### Design system
- Background: #120608 (Deep Maroon)
- Accent: #9B1B30 (Rio Red)
- Text: #F0E6DC (Cream)
- Gold: #C9851D (sparingly — section labels, tier accents)
- Fonts: Cormorant Garamond (headings), Spectral (body — replaced Inter)
- Reference: Rochambeau Club aesthetic

### SMS / geography
- UK-only at launch
- Twilio sends `From` in E.164 (+447xxx) — all stored numbers must match this format
- `normaliseUKPhone()` in `lib/phone.ts` handles 07xxx → +447xxx conversion

---

## Database migrations applied
- 001: tokens
- 002: RLS policies
- 003: active offer flag
- 004: phase 2 tables (special_requests, concierge_messages, refunds)
- 005: billing token
- 006: order confirmation (order_status, confirmation_expires_at, case timer fields)
- 007: (numbered by Claude Code — order confirmation + case timer)
- 008: default_address on customers
- 009: tier fields + backup_payment_method_id on customers
- 010: (pending) normalise existing phone numbers to E.164

---

## Backlog (not building yet)
- **Trigger payment for manually-added bottles** — "Charge" button alongside Refund in customer detail. Charges saved card off-session for comped/corrected bottles.
- **SNOOZE command** — parked intentionally, don't want to encourage opt-outs at launch
- **Discount enforcement** — 5% (Elvet) / 10% (Palatine) to be auto-applied at charge time once subscriber base warrants
- **Question limit enforcement** — 5/month (Bailey), 10/month (Elvet), unlimited (Palatine) — manual for now
- **Early texts for Palatine** — tiered blast timing, 2 hours earlier — requires blast system changes, backlog
- **Birthday gift (Palatine)** — manual for now

## Last updated
2026-03-19 (session 2) — Prompts 1–4 run (landing-page-v3, admin-qa, portal-progress-bar, admin-portal-sms-improvements). One remaining: claude-code-prompt-sms-ui-fixes.md. Migrations 012–015 need applying to live DB. Payment failure root cause still unknown — Vercel logs needed.
