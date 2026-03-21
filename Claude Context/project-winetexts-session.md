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
- **Production:** https://thecellar.club
- **Twilio webhook:** https://thecellar.club/api/webhooks/twilio/inbound
- **Stripe webhook:** https://thecellar.club/api/webhooks/stripe
- **Cron:** https://thecellar.club/api/cron/case-nudges (runs daily 9am UTC via Vercel Cron)

## Compliance
- Company: CD WINES LTD (No. 15796479)
- Premises Licence: DCCC/PLA0856
- Domain: thecellar.club ✅ live

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
| Customer portal (/portal) | ✅ Done |
| Tier system (Bailey / Elvet / Palatine) | ✅ Done |
| Homepage tier section (THE LEVELS) | ✅ Done |
| Admin mobile optimisation | ✅ Done |
| Email notification fix (REQUEST/QUESTION → hello@crushwines.co) | ✅ Done |
| Spectral font swap | ✅ Done |
| `/authenticate` page (3DS) | ✅ Done |
| `/billing` page (card update) | ✅ Done |
| Compliance pages (/privacy, /terms) | ✅ Done |
| Phone number normalisation bug | ✅ Done |
| Landing page v3 (maroon, door SVG, pull quote, tier copy) | ✅ Done |
| Login link for existing members | ✅ Done |
| +44 prefix on phone inputs | ✅ Done |
| OFFER SMS command | ✅ Done |
| Welcome SMS (save this number) | ✅ Done |
| Cellar door SVG simplified (double outline + handle only) | ✅ Done |
| Homepage: remove reassurance line from hero | ✅ Done |
| Sign-up: skip phone re-entry if entered on homepage | ✅ Done |
| Sign-up: first name + last name at step 3 | ✅ Done |
| Admin payments: refund marks order as 'refunded' in DB | ✅ Done |
| Portal: payments tab shows refunded status | ✅ Done |
| Shipping address pre-fill on /ship page (from default_address) | ✅ Done |
| Welcome SMS awaited in try/catch (was fire-and-forget, never sent on Vercel) | ✅ Done |
| Welcome SMS content updated (shorter, GSM-7 safe, no em-dash) | ✅ Done |
| Sign-up UX: autofill contrast fix (webkit-autofill override) | ✅ Done |
| Sign-up UX: age/residency checkbox reworded (two checkboxes, helper text) | ✅ Done |
| Sign-up UX: arch hidden on mobile | ✅ Done |
| Sign-up UX: duplicate email error + portal login link | ✅ Done |
| Concierge reopen on new message to closed thread | ✅ Done |
| Offer reply capture via sms_awaiting = 'offer' | ✅ Done |
| Admin concierge: purchase_query badge + context display | ✅ Done |
| /ship confirm: save address back to customers.default_address | ✅ Done |
| Homepage redesign: cream wine-menu layout (MenuEntry dot-leaders, card border) | ✅ Done |
| Homepage: cellar door SVG shown on mobile | ✅ Done |
| Homepage: section padding/spacing fixes | ✅ Done |
| Homepage: hero phone input gold border, stacked layout | ✅ Done |
| Homepage: favicon — cellar door SVG (app/icon.svg) | ✅ Done |
| From-email updated to cheers@thecellar.club (Resend) | ✅ Done |
| Custom domain: thecellar.club (Vercel env vars updated) | ✅ Done |
| SHIP CONFIRM bug fix: cellar query used created_at (wrong — column is added_at) | ✅ Done |
| SHIP CONFIRM bug fix: stripe_payment_intent_id + stripe_charge_status missing from shipments table — migration 018 | ✅ Done |

---

## Known bugs / outstanding issues

None currently known.

---

## Claude Code prompts

### Ready to run

Nothing outstanding. All prompts run.

### Previously run ✅
- `claude-code-prompt-new-domain.md` — update from-email to cheers@thecellar.club, note Vercel env var updates ✅
- `claude-code-prompt-homepage-redesign-v3.md` — cream wine-menu layout ✅
- `claude-code-prompt-signup-ux-corrections.md` — two checkboxes (age+delivery combined), portal login link on duplicate email error ✅
- `claude-code-prompt-2026-03-20.md` — concierge reopen, offer reply via sms_awaiting, purchase_query badge, ship confirm saves address ✅
- `claude-code-prompt-signup-ux-fixes.md` — autofill contrast, arch hidden mobile, checkbox reword ✅
- `claude-code-prompt-ux-fixes-2026-03-19.md` — door SVG, reassurance line, phone skip, last name, refund status, ship pre-fill ✅
- `claude-code-prompt-fixes-2026-03-19.md` — phone normalisation, restriction text, UK-only enforcement ✅
- `claude-code-prompt-admin-qa.md` — payment hardening, shipment detail, concierge desktop two-panel, contrast fixes ✅
- `claude-code-prompt-portal-progress-bar.md` ✅
- `claude-code-prompt-admin-portal-sms-improvements.md` — customer detail restructure, concierge close/filter, portal tabs, SMS two-step flow ✅
- `claude-code-prompt-landing-page-v3.md` ✅
- `claude-code-prompt-sms-ui-fixes.md` ✅
- `claude-code-prompt-door-refund-fixes.md` ✅
- `claude-code-prompt-landing-page-v2.md` ✅
- `claude-code-prompt-order-confirmation.md` ✅
- `claude-code-prompt-portal-and-tiers-FINAL.md` ✅
- `claude-code-prompt-email-notifications-fix.md` ✅
- `claude-code-prompt-admin-mobile.md` ✅

### Migrations applied to live Supabase DB
- **001–010** ✅ — initial schema, tokens, RLS, phase 2 tables, billing token, case timer, default_address, tiers
- **011** ✅ — normalise phone numbers to E.164
- **012** ✅ — add `tracking_provider` to shipments
- **013** ✅ — add `shipment_id` to cellar
- **014** ✅ — add `concierge_status` to customers
- **015** ✅ — add `sms_awaiting` to customers
- **016** ✅ — add `last_name` to customers
- **017** ✅ — add `category` + `context` to concierge_messages
- **018** ✅ — add `stripe_payment_intent_id` + `stripe_charge_status` to shipments

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
- /ship confirm page now saves address back to `customers.default_address`
- **Early ship (< 12 bottles)**: SHIP → "5 bottles, costs £15, reply SHIP CONFIRM" → SHIP CONFIRM charges £15 via Stripe then creates shipment + sends /ship?token link

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
- Admin notifications: REQUEST + QUESTION + purchase queries → hello@crushwines.co
- From address: cheers@thecellar.club (Resend)

### SMS commands (full list)
NUMBER, YES, CHANGE, ACCOUNT, STOP/UNSUBSCRIBE, CELLAR, SHIP, SHIP CONFIRM, PAUSE, STATUS, REQUEST, QUESTION, OFFER

### SMS sms_awaiting state machine
Trigger word sets state, next message is treated as content. EXIT returns to main menu.
- `sms_awaiting = 'request'` — set by REQUEST command
- `sms_awaiting = 'question'` — set by QUESTION command
- `sms_awaiting = 'offer'` — set when blast goes out OR customer uses OFFER command. Non-numeric reply captured as purchase_query in concierge tab with offer context. Numbers still trigger order flow as normal.

### Welcome SMS
- Fires at end of sign-up (complete/route.ts), **awaited** in try/catch so Vercel doesn't kill it before it fires
- Content: hearty welcome, save this number, how it works (offers → reply → cellar → case = free ship)
- GSM-7 safe — no em-dashes or non-standard characters (forces Unicode encoding if present)

### Portal (/portal)
- No-password login via SMS OTP
- Dashboard: tier card (spend + progress bar) → cellar → payment (primary + backup card) → delivery address
- Custom JWT session (PORTAL_JWT_SECRET), 30 days, httpOnly cookie
- Backup payment method stored in `backup_payment_method_id` on customers

### Homepage
- Cream wine-menu aesthetic: card with brown border on warmer cream background
- MenuEntry components: name + dotted leader + price (right), italic description below
- MenuSection: flanking gold rules with label
- Sections: How It Works, Why Bother, The Club (tiers), Our Story
- Cellar door SVG shown on all breakpoints (was hidden on mobile)
- Favicon: cellar door SVG (app/icon.svg)
- Domain: thecellar.club (no www)

### Design system
- Homepage: cream card (#F2EAE0) on warm sand (#E6D9CA), dark brown text (#1C0E09), rio red (#9B1B30) accents
- Admin/portal/join: dark maroon (#120608), rio red (#9B1B30), cream (#F0E6DC), gold (#C9851D)
- Fonts: Cormorant Garamond (headings), Spectral (body)
- Cellar door SVG: double outline + handle only (simplified)

### SMS / geography
- UK-only at launch
- Twilio sends `From` in E.164 (+447xxx) — all stored numbers must match this format
- `normaliseUKPhone()` in `lib/phone.ts` handles 07xxx → +447xxx conversion

### Domain
- Custom domain: thecellar.club (no www)
- Vercel env vars: NEXT_PUBLIC_APP_URL=https://thecellar.club, NEXTAUTH_URL=https://thecellar.club
- All SMS links use NEXT_PUBLIC_APP_URL env var — no hardcoded URLs in codebase

---

## Database migrations applied
- 001: tokens (order auth_token, shipment token)
- 002: RLS policies
- 003: active offer flag
- 004: phase 2 tables (special_requests, concierge_messages, refunds)
- 005: billing token, shipping_fee_pence on shipments, texts_snoozed_until on customers
- 006: order confirmation (order_status, confirmation_expires_at, case timer fields)
- 007: order confirmation + case timer
- 008: default_address on customers
- 009: tier fields + backup_payment_method_id on customers
- 010: (legacy — superseded by 011)
- 011: normalise phone numbers to E.164
- 012: tracking_provider on shipments
- 013: shipment_id on cellar
- 014: concierge_status on customers
- 015: sms_awaiting on customers
- 016: last_name on customers
- 017: category + context on concierge_messages
- 018: stripe_payment_intent_id + stripe_charge_status on shipments

---

## Backlog (not building yet)
- **Trigger payment for manually-added bottles** — "Charge" button alongside Refund in customer detail
- **SNOOZE command** — parked, don't want to encourage opt-outs at launch
- **Discount enforcement** — 5% (Elvet) / 10% (Palatine) auto-applied at charge time
- **Question limit enforcement** — 5/month (Bailey), 10/month (Elvet), unlimited (Palatine)
- **Early texts for Palatine** — 2 hours earlier than other tiers
- **Birthday gift (Palatine)** — manual for now

## Last updated
2026-03-21 (session 5 end) — Custom domain live, homepage cream wine-menu design, SHIP CONFIRM early-pay bug fixed (wrong column name + missing DB columns), welcome SMS fix (was never sending on Vercel due to unawaited promise). Migration 018 applied. All known bugs resolved.
