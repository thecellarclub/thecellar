# Spec: Security audit fixes & hardening sweep

**Date:** 2026-07-22
**Author:** Julia (via Cowork security audit)
**Migrations:** new work numbers from **049**

## Context

A full security review of the codebase, the live Supabase project (via the security advisors), and the git repo was done on 2026-07-22. The good news: the fundamentals are sound and were verified, not assumed —

- Stripe webhook verifies signatures (`constructEvent` with `STRIPE_WEBHOOK_SECRET`), raw-body correctly.
- Twilio inbound webhook validates `x-twilio-signature` and rejects failures with 403.
- Every `/api/admin/*` route checks an admin session (via `requireAdminSession()` or bare `getServerSession`), and `proxy.ts` middleware covers `/admin/*` + `/api/admin/*` unconditionally on top.
- All four cron routes check `CRON_SECRET` (one has a fail-open bug — item 3).
- RLS is enabled on every table with zero policies (deny-all to anon/authenticated); the app only touches Supabase via the service-role client server-side, and no anon-key browser client exists anywhere.
- `.env*` is gitignored and no `.env` file was ever committed (checked history).
- Card data never touches our servers — Stripe Elements only; we store PM ids and read last4 from Stripe.
- Age verification, GDPR consent capture, and an erasure endpoint all exist.

What follows are the gaps found, ordered by priority. Items marked **[JULIA]** are operational actions I'll do myself — they're listed so the log is complete, not for Claude Code to implement. Everything else is for Claude Code.

Nothing in this spec changes customer-facing behaviour, and nothing touches the order/charging flow — the single-YES confirmation gate is untouched.

---

## P0 — urgent (do these first, in this order)

### 1. [JULIA] Verify the GitHub repo is private; make it private if not

The whole codebase (admin emails in migration 029, business logic, endpoint map) lives at `github.com/thecellarclub/thecellar`. I'll confirm visibility in GitHub → Settings and flip to private if needed, and enable Dependabot security alerts while I'm there. **Claude Code: no action, but do not proceed past item 2 until Julia confirms this is done.**

### 2. Get `.claude/settings.local.json` out of git — it contains live Twilio credentials locally

`.claude/settings.local.json` is **tracked in git** (so is `.claude/launch.json`). The local working copy of settings.local.json currently contains the live Twilio Account SID, Auth Token, and phone number as `Bash(export TWILIO_...)` permission entries. These lines have **not** been committed or pushed (verified: `git log -S "TWILIO_AUTH_TOKEN"` finds nothing, HEAD's copy is clean) — but the file is tracked and `git add *` is in the same allowlist, so one habitual commit away from leaking them.

Claude Code:

1. Remove the three `Bash(export TWILIO_...)` entries (and the `Bash(export OUT_PATH)` one) from `.claude/settings.local.json`. The values already live in `.env.local`; nothing should need them as permission entries.
2. `git rm --cached .claude/settings.local.json` (keep the local file). Leave `launch.json` tracked or untrack it too — your call; it contains nothing sensitive.
3. Add to `.gitignore`:
   ```
   .claude/settings.local.json
   ```
4. Commit. Do NOT commit the version of the file that contains the tokens (check `git diff --cached` before committing).

### 3. [JULIA] Rotate the Twilio Auth Token

Even though it never reached the remote, the token has been sitting in a plaintext config file outside `.env.local`. I'll rotate it in the Twilio console and update: Vercel env vars (`TWILIO_AUTH_TOKEN`), local `.env.local`. Note the inbound webhook validates signatures with this token, so rotate and deploy promptly together.

### 4. Fix fail-open cron auth in inbox-digest

`app/api/cron/inbox-digest/route.ts` checks:

```ts
if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
```

If `CRON_SECRET` were ever unset in an environment, this endpoint runs unauthenticated (it emails customer names/phones to admin addresses and reads the whole customer table). The other three crons compare strictly. Make it identical to them:

```ts
if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
  return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
}
```

---

## P1 — hardening (code, this spec's main body)

### 5. Cryptographically secure OTP generation

Both OTP mints use `Math.random()`, which is not a CSPRNG:

- `app/api/signup/send-code/route.ts` (line ~80)
- `app/api/portal/send-otp/route.ts`

Replace with `crypto.randomInt`:

```ts
import { randomInt } from 'crypto'
const code = String(randomInt(100000, 1000000))
```

The existing attempt caps (3 for signup, 5 for portal) and 10-minute expiry stay as they are.

### 6. Rate-limit parity on the portal OTP endpoints

`app/api/signup/send-code` has an IP limit (10/hour) **plus** the DB-backed per-phone limit (3/hour). The portal equivalents only have the per-phone limit:

- `app/api/portal/send-otp/route.ts`: add the same IP check at the top (`isAllowed(\`ip:${ip}\`, 10, ONE_HOUR_MS)` from `lib/rateLimit.ts`, 429 on failure), before any DB work.
- `app/api/portal/verify-otp/route.ts`: add an IP limit too (e.g. 20/hour) — the per-code attempt cap is the real guard, but an IP limit stops someone cycling phone numbers.

Keep the existing "pretend success for unknown numbers" behaviour in send-otp — don't leak which phones are members.

### 7. Brute-force protection + shorter sessions for admin login

There is currently no rate limiting anywhere on the NextAuth credentials flow, and the admin JWT lives for NextAuth's default 30 days.

In `lib/auth.ts`:

1. At the top of `authorize()`, rate-limit by IP-independent key since we can't easily get the IP there — instead limit per **email**: `isAllowed(\`admin-login:${credentials.email.toLowerCase()}\`, 10, 15 * 60 * 1000)`; return `null` when limited. (In-memory is imperfect on serverless but this is belt-and-braces on top of bcrypt cost 12; note the limitation in a comment.)
2. Set `session: { strategy: 'jwt', maxAge: 7 * 24 * 60 * 60 }` (7 days instead of 30). Admins log in from their own devices regularly; a week is plenty.

### 8. Standardise the four stray admin routes on `requireAdminSession()`

These four check `getServerSession` directly instead of `requireAdminSession()`:

- `app/api/admin/customers/[id]/refund/route.ts`
- `app/api/admin/customers/[id]/cancel-order/route.ts`
- `app/api/admin/customers/[id]/add-bottles/route.ts`
- `app/api/admin/broadcast/route.ts`

They're still protected (session check + middleware), but they bypass the stale-session UUID re-resolution in `lib/adminAuth.ts` and break the "every admin route calls requireAdminSession()" convention in CLAUDE.md. Swap each to the standard pattern:

```ts
const auth = await requireAdminSession()
if (!auth.ok) return auth.response
```

No behaviour change beyond that.

### 9. Pin the Twilio signature-validation URL in production

`app/api/webhooks/twilio/inbound/route.ts` reconstructs the signed URL from the request's `host` and `x-forwarded-proto` headers. That's needed for ngrok in dev, but in production the canonical URL is known. Use it:

```ts
const url = process.env.NODE_ENV === 'production'
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/twilio/inbound`
  : `${proto}://${host}/api/webhooks/twilio/inbound`
```

(Confirm `NEXT_PUBLIC_APP_URL` has no trailing slash; adjust if needed.)

### 10. Security response headers

`next.config.ts` is empty. Add:

```ts
const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ],
    }]
  },
}
```

Do NOT add a Content-Security-Policy in this pass — Stripe Elements + Next inline scripts need a properly built one and a broken CSP takes down the payment forms. Leave it for a future spec.

### 11. Migration 049 — fix the two remaining Supabase security-advisor findings

`get_advisors` currently reports (beyond the harmless `rls_enabled_no_policy` INFOs, which are our intended deny-all design):

- **ERROR — `security_definer_view` on `public.customer_cellar_totals`.** Recreate it as security invoker:
  ```sql
  drop view if exists customer_cellar_totals;
  create view customer_cellar_totals
    with (security_invoker = true) as
  select customer_id, sum(quantity) as total_bottles
  from cellar
  where shipment_id is null
  group by customer_id;
  ```
  Note migration 039_fix_cellar_unshipped_view.sql previously touched this view — check its definition first and recreate **that** (current) definition with `security_invoker = true`, not the schema.sql original, if they differ.
- **WARN — mutable `search_path`** on `public.increment_offers_received` and `public.apply_credit`:
  ```sql
  alter function public.increment_offers_received(uuid) set search_path = public, pg_temp;
  alter function public.apply_credit(...) set search_path = public, pg_temp;
  ```
  Look up the exact signatures with `\df` / `pg_proc` before writing the migration — apply_credit takes several args.

Apply via the Supabase MCP as usual and re-run `get_advisors(type: 'security')` to confirm both findings clear.

---

## P2 — personal-data tidy-up (GDPR)

### 12. Extend the erasure route to actually erase everything

`app/api/admin/customers/[id]/erase/route.ts` deletes the Stripe customer and anonymises `phone`, `email`, `first_name` — but leaves personal data behind:

On the `customers` row, also null/anonymise: `last_name`, `dob`, `default_address`, `backup_payment_method_id`, `billing_token` + `billing_token_expires_at`, and any UTM fields.

And clean up the side tables keyed by this customer or their phone (fetch the real phone **before** overwriting it):

- `concierge_messages` for this customer_id → **delete** rows (message bodies are personal data).
- `sms_parse_log` where `customer_id` matches **or** `inbound_phone` equals their phone → delete (stores raw inbound SMS + phone).
- `verification_codes` for their phone → delete.
- `inbox_notes` for this customer → delete (free-text notes about a person).
- Keep `orders`, `cellar`, `shipments`, `refunds`, `credit_ledger`, `milestone_awards` rows — accounting integrity — but null `shipments.shipping_address` for their shipments.

Log a summary line of what was removed (counts only, no PII).

### 13. Data-retention purge (fold into an existing cron — Hobby plan, no new crons)

Nothing ever deletes expired short-lived secrets or message logs. Add a purge step at the end of `app/api/cron/case-nudges/route.ts` (it already runs daily):

- `verification_codes` older than 24 hours → delete.
- `sms_parse_log` rows older than 90 days → delete.

Include the counts in the cron's JSON response. Nothing else — inbox/activity history is operationally useful and stays.

### 14. Trim PII returned by the ship-token endpoint

`app/api/ship/[token]/route.ts` returns the customer's `first_name`, `email`, **and** `phone` to whoever holds the link. Check what `app/ship/ShipForm.tsx` actually renders and return only that (almost certainly just `first_name`). The token is 48-bit with a 7-day validity — fine odds-wise, but SMS links get forwarded; don't hand out email+phone for free.

### 15. Bind 3DS confirm to the token, not a bare orderId

`app/api/authenticate/confirm/route.ts` accepts any `orderId`. It's low-risk (order ids are UUIDs, the route verifies the PI with Stripe and is idempotent), but the page already has the auth token — make the route take `{ token }` instead, look the order up by `auth_token`, and re-check `isAuthTokenExpired` there too. Update `app/authenticate/AuthenticateForm.tsx` to send the token it already has.

---

## P3 — housekeeping (do if quick, fine to defer)

### 16. Remove the env-var admin fallback

`lib/auth.ts` still falls back to `ADMIN_EMAIL`/`ADMIN_PASSWORD_HASH` if the `admin_users` lookup fails or returns a placeholder hash. First verify all three admin rows have real bcrypt hashes (`select email, password_hash not like '$placeholder%' from admin_users`). If yes: delete the fallback block, and Julia will remove the two env vars from Vercel afterwards. If any placeholder remains, stop and flag instead.

### 17. Separate secret for the signup cookie

`lib/session.ts` (iron-session) reuses `NEXTAUTH_SECRET` as its password. Add a dedicated `SIGNUP_SESSION_SECRET` env var, fall back to `NEXTAUTH_SECRET` if unset so nothing breaks before Julia adds the var in Vercel:

```ts
password: process.env.SIGNUP_SESSION_SECRET ?? (process.env.NEXTAUTH_SECRET as string),
```

### 18. Note only — in-memory rate limiter

`lib/rateLimit.ts` is per-instance (already documented in the file). At current traffic that's acceptable; the DB-backed per-phone limits are the real guards on SMS spend. If traffic grows, move to `@upstash/ratelimit` + Vercel KV per the existing comment. No action now.

---

## Explicit non-goals

- No CSP in this pass (see item 10).
- No changes to the order flow, the YES confirmation gate, charging, or any SMS copy.
- No RLS policies — the deny-all + service-role-only pattern is the design, and the `rls_enabled_no_policy` INFO lints are expected.
- No changes to `verification_codes` storing codes in plaintext — 10-minute expiry plus attempt caps makes hashing them low-value; skip.

## Verification checklist (Claude Code, before closing out)

1. `npx tsc --noEmit` and `npx eslint` clean.
2. `git ls-files | grep .claude` shows settings.local.json no longer tracked; `git log -S "TWILIO_AUTH_TOKEN" --all` still finds nothing.
3. Each cron route returns 401 without the bearer header (curl all four).
4. Portal + signup OTP flows still work end-to-end (request code, verify, session cookie set).
5. Admin login works for a seeded user; a wrong password 10× in a row gets rate-limited.
6. Stripe + Twilio webhooks still accept genuine events after the URL-pinning change (send a Twilio test SMS in production after deploy).
7. `get_advisors(type: 'security')` shows no ERROR or WARN findings.
8. Erase a test customer and confirm the side tables are cleaned (counts in response/log).
9. Update CLAUDE.md (latest migration → 049, remove this spec from Active specs when done) and prepend the IMPLEMENTATION-LOG.md entry per the template — include which [JULIA] items were pending at time of implementation.
