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
| Customer portal (/portal) | ✅ Done |
| Tier system (Bailey / Elvet / Palatine) | ✅ Done |
| Homepage tier section (THE LEVELS) | ✅ Done |
| Admin mobile optimisation (hamburger nav, card layouts, chat-bubble threads) | ✅ Done |
| Email notification fix (REQUEST/QUESTION → hello@crushwines.co) | ✅ Done |
| Spectral font swap | ✅ Done |
| `/authenticate` page (3DS) | ✅ Done |
| `/billing` page (card update) | ✅ Done |
| Compliance pages (/privacy, /terms) | ✅ Done |
| Phone number normalisation bug | ✅ Done (migration 011 ready to apply) |
| Remove "Crush/Norse guests only" restriction text | ✅ Done |
| Landing page visual overhaul | ⏳ To do (prompt ready: claude-code-prompt-landing-page-v2.md) |
| Login link for existing members (join page + homepage) | ⏳ To do |
| Refund SMS confirmation | ⏳ To verify in prod |
| Shipping address pre-fill on /ship page | ⏳ To do |

---

## Known bugs

### 1. Phone number normalisation / Twilio lookup mismatch
**Symptom:** Registering with `07826665548` correctly errors with "already signed up". But texting the Cellar Club number returns "sorry, we don't recognise this number."

**Root cause (likely):** Numbers may be stored inconsistently in the DB (some as `07xxx`, some as `+447xxx`) depending on when they were registered. The signup `send-code` route normalises to E.164 before the duplicate check, but if the stored number is in a different format the Twilio webhook's raw `.eq('phone', from)` lookup fails. Twilio always sends `from` in E.164 (`+447xxx`).

**Fix needed:**
- Add `normaliseUKPhone` call inside the Twilio inbound webhook on the `from` field before DB lookup (defensive, even though Twilio sends E.164)
- Write and run a one-off Supabase migration to normalise all existing `phone` values to E.164
- Lock down signup to UK-only (see below)

### 2. "Crush/Norse guests only" restriction text — not true, remove it
Two places in the codebase say the club is for guests who've visited Crush/Norse/Coarse/Isla. This is wrong — the club is open to anyone.

- `app/join/layout.tsx` line ~23: `For guests who've visited Coarse, Isla, or Crush.`
- `app/join/page.tsx` line ~53: `The Cellar Club is for guests who've visited Crush or Norse.`

Just delete both lines. Nothing needs replacing.

### 3. International SMS / UK-only decision
**Decision: UK-only at launch.** It's a Durham wine bar, we ship UK-only anyway, and international Twilio SMS is expensive ($0.05–0.20+ per message vs ~$0.04 for UK→UK). No reason to complicate it.

**Implementation:**
- Update `normaliseUKPhone` to explicitly reject non-UK numbers with a clear error message
- Update the phone input UI on `/join` to clarify UK numbers only
- Both `07xxx` and `+447xxx` formats should be accepted and normalised to E.164 — handle the edge case where someone enters `+447` but WITHOUT the leading zero correctly (currently handled)
- The error message if non-UK: "We currently only accept UK numbers — give us your 07 number."

---

## Claude Code prompts ready to run

Saved in project root:

| Prompt file | What it does | Status |
|---|---|---|
| `claude-code-prompt-fixes-2026-03-19.md` | Phone normalisation bug, remove restriction text, UK-only enforcement | ⏳ Ready |
| `claude-code-prompt-landing-page-update.md` | Full visual overhaul — sections, cards, dividers, story copy, bottle SVG | ⏳ Ready |
| `claude-code-prompt-refund-fix.md` | Refund hang fix, SMS after refund, /ship address pre-fill | ⏳ To verify |

Previously run (archived):
- `claude-code-prompt-order-confirmation.md` — ✅ Done
- `claude-code-prompt-portal-and-tiers-FINAL.md` — ✅ Done
- `claude-code-prompt-email-notifications-fix.md` — ✅ Done
- `claude-code-prompt-admin-mobile.md` — ✅ Done

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
NUMBER, YES, CHANGE, ACCOUNT, STOP/UNSUBSCRIBE, CELLAR, SHIP, SHIP CONFIRM, PAUSE, STATUS, REQUEST, QUESTION

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
2026-03-19 — Bug: phone normalisation mismatch. Remove restriction text. UK-only decision. Landing page overhaul still pending.
