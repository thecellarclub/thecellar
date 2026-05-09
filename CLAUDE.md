# The Cellar Club — CLAUDE.md

## What this is

An SMS-first wine club platform. Customers sign up, receive wine offers by text, reply to order, and accumulate bottles until they hit 12 (a case), which triggers a shipment. There's an admin portal for the team (Daniel, Julia, Craig/Donna) to manage wine inventory, customers, orders, shipments, and a shared SMS inbox ("concierge").

## Tech stack

- **Next.js** (App Router, TypeScript) — frontend + API routes
- **Supabase** — PostgreSQL database, accessed via service-role client in API routes
- **Twilio** — two-way SMS (send wine offers + receive replies)
- **Stripe** — payment processing (setup intents, payment intents, 3DS)
- **Resend** — transactional email
- **NextAuth** (JWT strategy) — admin authentication
- **bcryptjs** — password hashing

## Key conventions

- All admin API routes live under `app/api/admin/` and call `requireAdminSession()` from `lib/adminAuth.ts` at the top. This now returns `{ ok: true; session }` — the session includes `user.id`, `user.name`, `user.email`.
- Supabase is always accessed via `createServiceClient()` from `lib/supabase.ts` in API routes (service-role key, bypasses RLS).
- SMS sending goes through `lib/twilio.ts` → `sendSms()` or `twilioClient.messages.create()` with `sanitiseGsm7()` on the body.
- Email notifications use `notifyAdmin()` from `lib/resend.ts`. For per-user emails, call `resend.emails.send()` directly.
- The inbox is customer-keyed: one concierge thread per customer. Thread status (`open`/`closed`) lives on `customers.concierge_status`.

## Key tables

| Table | Purpose |
|-------|---------|
| `customers` | Club members. Key fields: `phone`, `concierge_status`, `inbox_assigned_to`, `inbox_assigned_at`, `inbox_follow_up_date`, `inbox_follow_up_note`, `inbox_follow_up_set_by` |
| `admin_users` | Admin team (Daniel, Julia, Craig). Fields: `id`, `email`, `name`, `password_hash`. Passwords set via `scripts/seed-admin-users.ts`. |
| `concierge_messages` | Inbound/outbound SMS in the inbox. `direction`: `inbound`/`outbound`. |
| `special_requests` | Customer requests surfaced in the inbox. `status`: `open`/`resolved`. |
| `inbox_notes` | Internal notes about a customer. Keyed to `customer_id` (persist across threads). `author_id` → `admin_users`. |
| `inbox_activity` | Lightweight audit log of actions on inbox threads. `action` values: `replied`, `assigned`, `note_added`, `follow_up_set`, `follow_up_cleared`, `closed`, `reopened`, `request_resolved`. |
| `wines` | Wine catalogue. |
| `orders` | Customer wine orders. |
| `cellar` | Bottles accumulated but not yet shipped. |
| `shipments` | Case shipments (12 bottles). |
| `sms_messages` | All inbound/outbound SMS log. |
| `texts` | Wine offer campaigns. |

## Auth model

- **Admin**: Database-backed multi-user auth via `admin_users` table. Three users: Daniel, Julia, Craig (Craig and Donna share the Craig login). Auth goes through NextAuth CredentialsProvider (`lib/auth.ts`). JWT stores `id`, `name`, `email`. Fallback to `ADMIN_EMAIL` / `ADMIN_PASSWORD_HASH` env vars if `admin_users` table is empty or seed script hasn't run — logs a warning when fallback fires.
- **Customer portal**: OTP via SMS (iron-session, `lib/portal-auth.ts`).

## Migrations

Latest migration: `033_inbox_activity_log.sql`. New work numbers from **034**.

Migration files live in `supabase/migrations/`. Apply them manually via Supabase Studio or CLI.

## Cron jobs

| Path | Schedule | Purpose |
|------|----------|---------|
| `/api/cron/case-nudges` | 09:00 UTC | Prompt customers to confirm/schedule shipment |
| `/api/cron/welcome-and-card-prompt` | 10:00 UTC | Welcome new members, prompt for card |
| `/api/cron/payment-retry` | 11:00 UTC | Retry failed Stripe charges |
| `/api/cron/inbox-digest` | 08:00 UTC | Daily email per admin: due follow-ups + unanswered threads |

All cron routes are protected with `Authorization: Bearer <CRON_SECRET>`.

## Inbox feature summary

The admin inbox (`/admin/inbox`) is a shared inbox for the three-person team. As of migration 029–033:

- **Three-column desktop layout**: thread list (left) | SMS conversation (middle) | customer panel (right).
- **Thread assignment**: each thread can be claimed or assigned to an admin user. Assignment badge + dropdown in the customer panel, avatar indicator in thread list.
- **Follow-up dates**: schedule a date to revisit a thread. Overdue = red, within 2 days = amber. Threads with overdue follow-ups sort to the top.
- **Internal notes**: customer-level notes (not tied to a conversation) in the customer panel. Persist when a thread closes and a new one opens.
- **Activity log**: lightweight audit trail (who replied, assigned, added notes, set follow-ups, etc.) in the customer panel.
- **Filters**: assignee filter (All / Mine / Unassigned / per-user) + Active / Scheduled view toggle.
- **Daily digest**: `inbox-digest` cron emails each admin their due follow-ups and unanswered threads every morning at 08:00 UTC.

## Seed script

Run once after deploying migration 029:

```bash
npx tsx scripts/seed-admin-users.ts
```

Reads passwords from `ADMIN_PW_DANIEL`, `ADMIN_PW_JULIA`, `ADMIN_PW_CRAIG` env vars, or prompts interactively.
