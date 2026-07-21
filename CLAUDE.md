# The Cellar Club — CLAUDE.md

## How we work

Julia writes specs in Cowork (the Claude desktop app). Cowork does NOT make code changes — it only writes specs and updates this file. Claude Code implements specs as-is — don't rewrite or second-guess the approach. If something in a spec is ambiguous, ask rather than assume.

Specs live in the project root as `claude-code-prompt-*.md`.

### Keeping the loop closed

Cowork can't see Claude Code work, so it relies on the repo + two docs to know the current state. To prevent drift:

**Claude Code — when you finish implementing a spec, before you're done:**

1. Make the small state edits to this CLAUDE.md: bump the "Latest migration" number, move the completed spec out of the "Active specs" table, and update any table/route list that changed. Keep these edits minimal and structural — CLAUDE.md is high-level and loaded into context every session, so do NOT add narrative or implementation detail here.
2. Prepend a detailed entry to `IMPLEMENTATION-LOG.md` (state changes, deviations/decisions, gotchas/future context, verification — see the template in that file). This is where granular feedback lives.

**Cowork — before writing any new spec:** read `IMPLEMENTATION-LOG.md` first, and verify state against the actual repo (e.g. `ls supabase/migrations/` for the real latest number, grep for tables/routes before assuming they exist) rather than trusting CLAUDE.md prose alone.

## What this is

An SMS-first wine club platform (https://thecellar.club). Customers sign up, receive wine offers by text, reply to order, and accumulate bottles until they hit 12 (a case), which triggers a shipment. There's an admin portal for the team to manage wine inventory, customers, orders, shipments, and a shared SMS inbox.

## The team

Three admin users, all with equal permissions (no roles):

| Name | Email | Notes |
|------|-------|-------|
| Daniel | daniel@thecellar.club | Sommelier. Handles most customer-facing texting. |
| Julia | julia@thebothy.club | Admin/triage. Writes specs, manages operations. |
| Craig | craig@thecellar.club | Admin. Craig and Donna share this login. |

## Venues

| Name | What it is |
|------|-----------|
| **Crush** | Existing wine bar in Durham (crushwines.co). 80 wines by the glass. |
| **Norse** | New wine bar with the cellar — this is where cases are stored and shipped from. |

These appear in the codebase as venue/location options (e.g. `'crush'` / `'norse'`) for shipment collection bookings and bar pickups.

## Tech stack

- **Next.js** (App Router, TypeScript) — frontend + API routes
- **Supabase** — PostgreSQL database, accessed via service-role client in API routes
- **Twilio** — two-way SMS (send wine offers + receive replies)
- **Stripe** — payment processing (setup intents, payment intents, 3DS)
- **Resend** — transactional email
- **NextAuth** (JWT strategy) — admin authentication
- **bcryptjs** — password hashing

## Key conventions

- All admin API routes live under `app/api/admin/` and call `requireAdminSession()` from `lib/adminAuth.ts` at the top. Returns `{ ok: true; session }` — session includes `user.id`, `user.name`, `user.email`.
- Supabase is always accessed via `createServiceClient()` from `lib/supabase.ts` in API routes (service-role key, bypasses RLS).
- SMS sending goes through `lib/twilio.ts` → `sendSms()` or `twilioClient.messages.create()` with `sanitiseGsm7()` on the body.
- Email notifications use `notifyAdmin()` from `lib/resend.ts`. For per-user emails, call `resend.emails.send()` directly.
- The inbox is customer-keyed: one concierge thread per customer. Thread status (`open`/`closed`) lives on `customers.concierge_status`.

## Key tables

| Table | Purpose |
|-------|---------|
| `customers` | Club members. Key fields: `phone`, `status` (`'active'` \| `'dormant'` \| `'deactivated'`), `concierge_status`, `inbox_assigned_to`, `inbox_assigned_at`, `inbox_follow_up_date`, `inbox_follow_up_note`, `inbox_follow_up_set_by`, `free_shipping_at_6` (one-shot admin grant, see `lib/tiers.ts`/`lib/post-charge.ts`), `credit_balance_pence` (see `credit_ledger`), `tier`/`tier_since`/`tier_review_at` (tiers-v3 case ladder — `tier_since` anchors the current case-counting cycle, not just "last changed") |
| `admin_users` | Admin team. Fields: `id`, `email`, `name`, `password_hash`. Passwords set via `scripts/seed-admin-users.ts`. |
| `concierge_messages` | Inbound/outbound SMS in the inbox. `direction`: `inbound`/`outbound`. |
| `special_requests` | Customer requests surfaced in the inbox. `status`: `open`/`resolved`. |
| `inbox_notes` | Internal notes about a customer (customer-level, persist across threads). `author_id` → `admin_users`. |
| `inbox_activity` | Lightweight audit log. `actor_id` nullable (system/auto-consume entries). `action` values: `replied`, `assigned`, `note_added`, `follow_up_set`, `follow_up_cleared`, `closed`, `reopened`, `request_resolved`, `free_shipping_at_6_set`, `free_shipping_at_6_cleared`. |
| `wines` | Wine catalogue. |
| `orders` | Customer wine orders. `credit_used_pence` records store credit applied at redemption. |
| `credit_ledger` | Append-only store-credit ledger. `reason`: `rebate` \| `redemption` \| `admin_grant`. Written only via the `apply_credit()` SQL function — see `lib/credit.ts`. |
| `milestone_awards` | Lifetime one-time-ever rewards at cases 1/3/5/6 (tiers-v3). `unique(customer_id, milestone)` is the one-time guarantee; never deleted. Admin fulfilment queue at `/admin/milestones`. |
| `cellar` | Bottles accumulated but not yet shipped. `shipment_id` links to a shipment when reserved; `shipped_at` is set when actually shipped/collected. |
| `shipments` | Case shipments. `type`: `'delivery'` (posted to customer) or `'collection'` (picked up at bar). See shipments section below. |
| `sms_messages` | All inbound/outbound SMS log. **Being deprecated** — see `claude-code-prompt-inbox-twilio-history.md` (table dropped once inbox reads live from Twilio). |
| `texts` | Wine offer campaigns. `broadcast_at`/`broadcast_sent_at` (tiers-v3): Palatine members get sent immediately; the rest go out via a manual "Send to everyone else" second wave once `broadcast_at` has passed. |

## Auth model

- **Admin**: Database-backed multi-user auth via `admin_users` table. Auth goes through NextAuth CredentialsProvider (`lib/auth.ts`). JWT stores `id`, `name`, `email`. Fallback to `ADMIN_EMAIL` / `ADMIN_PASSWORD_HASH` env vars if `admin_users` table is empty or seed script hasn't run — logs a warning when fallback fires.
- **Customer portal**: OTP via SMS (iron-session, `lib/portal-auth.ts`).

## Migrations

Latest migration: `047_remove_case_deadline.sql` (note: there are multiple `039_*` migrations). New work numbers from **048**.

Migration files live in `supabase/migrations/`. Apply them manually via Supabase Studio or CLI.

## Cron jobs

| Path | Schedule | Purpose |
|------|----------|---------|
| `/api/cron/case-nudges` | 09:00 UTC | One-time gentle reminder at 90 days filling a case (no deadline, no auto-ship/charge) |
| `/api/cron/welcome-and-card-prompt` | 10:00 UTC | Welcome new members, prompt for card |
| `/api/cron/payment-retry` | 11:00 UTC | Retry failed Stripe charges |
| `/api/cron/inbox-digest` | 08:00 UTC | Daily email per admin: due follow-ups + unanswered threads |

All cron routes are protected with `Authorization: Bearer <CRON_SECRET>`.

## Inbox

The admin inbox (`/admin/inbox`) is a shared inbox for the three-person team. Implemented in migrations 029–033.

- **Three-column desktop layout**: thread list (left) | SMS conversation (middle) | customer panel (right). On mobile, the customer panel is a collapsible section above the conversation.
- **Thread assignment**: claim or assign threads to an admin user. Assignment badge + dropdown in the customer panel, avatar indicator in thread list.
- **Follow-up dates**: schedule a date to revisit a thread. Overdue = red, within 2 days = amber. Threads with overdue follow-ups sort to the top.
- **Internal notes**: customer-level timestamped notes in the customer panel. Persist when a thread closes and a new one opens. Notes are never sent as SMS.
- **Activity log**: lightweight audit trail (who replied, assigned, added notes, set follow-ups, etc.) in the customer panel, collapsed by default.
- **Filters**: assignee filter (All / Mine / Unassigned / per-user) + Active / Scheduled view toggle.
- **Daily digest**: `inbox-digest` cron emails each admin their due follow-ups, unanswered threads, and slow-filling cellars (≥120 days, unassigned) every morning at 08:00 UTC.

### Not yet implemented (see specs)

- `@mention` tagging in notes with email notification and bold blue rendering
- Default filter set to "Mine" instead of "All"
- Deep link support (`/admin/inbox?customer={id}`)
- Conversation column scroll fix (middle column grows unbounded — should scroll independently so customer panel stays visible)
- Live Twilio conversation history (`claude-code-prompt-inbox-twilio-history.md`): conversation column reads the full two-way SMS history live from the Twilio Messages API (incl. automated messages) instead of `concierge_messages`, with pagination. Thread list, notes, activity, digest stay on the existing tables.

## Shipments

Shipments have a `type` field (added in migration 028):

- `'delivery'` (default) — posted to customer. Current statuses: `pending` → `confirmed` → `dispatched` → `delivered`.
- `'collection'` — customer picks up at bar. Currently creates the shipment as instantly `delivered` with `dispatched_at` and `delivered_at` set immediately.

### Not yet implemented (see specs)

- **Collection workflow** (`claude-code-prompt-collection-workflow.md`): scheduled bar pickups with venue (Crush/Norse), date/time, and a proper pending → collected lifecycle.
- **Courier booking** (`claude-code-prompt-courier-booking.md`): adds a `collection_booked` status to delivery shipments for when the courier collection from the bar is booked, before the case is actually dispatched.

## Seed script

Run once after deploying migration 029:

```bash
npx tsx scripts/seed-admin-users.ts
```

Reads passwords from `ADMIN_PW_DANIEL`, `ADMIN_PW_JULIA`, `ADMIN_PW_CRAIG` env vars, or prompts interactively.

## Active specs

Specs live in the project root as `claude-code-prompt-*.md`. Current active (unimplemented) specs:

| File | What it covers |
|------|---------------|
| `claude-code-prompt-shared-inbox.md` | Remaining inbox work: @mentions in notes, default "Mine" filter, deep links |
| `claude-code-prompt-collection-workflow.md` | Bar pickup scheduling (venue, date/time, pending → collected) |
| `claude-code-prompt-courier-booking.md` | Courier booking stage for delivery shipments |
| `claude-code-prompt-shipments-and-wine-upload.md` | Shipments page overhaul (sortable columns, contents, collection dates) + wine image upload via Supabase Storage |
| `claude-code-prompt-shipments-tweaks.md` | Shipments table fixes: drop tracking column, full address, contents line breaks, fix action buttons per type/status |
| ~~`claude-code-prompt-tiers-v2.md`~~ | **SUPERSEDED by tiers-v3** (was 1/3/6 tiers + choose-your-gift). Do not implement. |
| ~~`claude-code-prompt-tiers-update.md`~~ | **SUPERSEDED by tiers-v2** (was spend-based £1k/£2.5k). Do not implement. |
| ~~`claude-code-prompt-tier-benefits.md`~~ | **SUPERSEDED by tiers-v2** (was choose-and-stack spend design). Do not implement. |
| `claude-code-prompt-inbox-add-wine.md` | Quick-add wine to cellar from inbox right panel: search existing wines + quick-create unlisted wines |
| `claude-code-prompt-inbox-twilio-history.md` | Inbox conversation column reads full SMS history live from Twilio Messages API (incl. automated messages), paginated; replaces `concierge_messages`/`smsContext` rendering in the middle column. Also fully deprecates `sms_messages` (stop writes, delete `/admin/sms-log` page, drop table via migration 041) |
