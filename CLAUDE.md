# The Cellar Club — CLAUDE.md

## How we work

Julia writes specs in Cowork (the Claude desktop app). Cowork does NOT make code changes — it only writes specs and updates this file. Claude Code implements specs as-is — don't rewrite or second-guess the approach. If something in a spec is ambiguous, ask rather than assume.

Specs live in the project root as `claude-code-prompt-*.md`.

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
| `customers` | Club members. Key fields: `phone`, `status` (`'active'` \| `'dormant'` \| `'deactivated'`), `concierge_status`, `inbox_assigned_to`, `inbox_assigned_at`, `inbox_follow_up_date`, `inbox_follow_up_note`, `inbox_follow_up_set_by` |
| `admin_users` | Admin team. Fields: `id`, `email`, `name`, `password_hash`. Passwords set via `scripts/seed-admin-users.ts`. |
| `concierge_messages` | Inbound/outbound SMS in the inbox. `direction`: `inbound`/`outbound`. |
| `special_requests` | Customer requests surfaced in the inbox. `status`: `open`/`resolved`. |
| `inbox_notes` | Internal notes about a customer (customer-level, persist across threads). `author_id` → `admin_users`. |
| `inbox_activity` | Lightweight audit log. `action` values: `replied`, `assigned`, `note_added`, `follow_up_set`, `follow_up_cleared`, `closed`, `reopened`, `request_resolved`. |
| `wines` | Wine catalogue. |
| `orders` | Customer wine orders. |
| `cellar` | Bottles accumulated but not yet shipped. `shipment_id` links to a shipment when reserved; `shipped_at` is set when actually shipped/collected. |
| `shipments` | Case shipments. `type`: `'delivery'` (posted to customer) or `'collection'` (picked up at bar). See shipments section below. |
| `sms_messages` | All inbound/outbound SMS log. |
| `texts` | Wine offer campaigns. |

## Auth model

- **Admin**: Database-backed multi-user auth via `admin_users` table. Auth goes through NextAuth CredentialsProvider (`lib/auth.ts`). JWT stores `id`, `name`, `email`. Fallback to `ADMIN_EMAIL` / `ADMIN_PASSWORD_HASH` env vars if `admin_users` table is empty or seed script hasn't run — logs a warning when fallback fires.
- **Customer portal**: OTP via SMS (iron-session, `lib/portal-auth.ts`).

## Migrations

Latest migration: `038_customer_status.sql`. New work numbers from **039**.

Migration files live in `supabase/migrations/`. Apply them manually via Supabase Studio or CLI.

## Cron jobs

| Path | Schedule | Purpose |
|------|----------|---------|
| `/api/cron/case-nudges` | 09:00 UTC | Prompt customers to confirm/schedule shipment |
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
- **Daily digest**: `inbox-digest` cron emails each admin their due follow-ups and unanswered threads every morning at 08:00 UTC.

### Not yet implemented (see specs)

- `@mention` tagging in notes with email notification and bold blue rendering
- Default filter set to "Mine" instead of "All"
- Deep link support (`/admin/inbox?customer={id}`)
- Conversation column scroll fix (middle column grows unbounded — should scroll independently so customer panel stays visible)

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
