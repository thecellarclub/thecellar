# Claude Code Prompt — Shared Inbox & Workflow

The admin inbox is currently single-user (one shared login, no way to know who did what). Three people use it: Daniel (sommelier — sends the SMS replies), Julia and Craig/Donna (triage, admin, sourcing). This spec turns it into a proper shared-inbox workflow with individual logins, assignment, internal notes, follow-up dates, and a daily reminder digest.

Six areas. Do them in order.

---

## 1. Multi-user admin auth

Replace the single-user env-var auth with a database-backed admin user table. All three users get equal permissions — no role enforcement.

### A — Migration `029_admin_users.sql`

```sql
CREATE TABLE admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Seed the three users. Passwords will be set via a one-time script (see below).
-- Do NOT put plaintext passwords in the migration.
```

### B — Seed script `scripts/seed-admin-users.ts`

A one-time Node script (run with `npx tsx scripts/seed-admin-users.ts`) that:

1. Prompts for each user's password (or reads from env vars `ADMIN_PW_DANIEL`, `ADMIN_PW_JULIA`, `ADMIN_PW_CRAIG`).
2. Hashes with `bcryptjs` (cost 12).
3. Upserts into `admin_users` by email.

Seed data:

| Name | Email |
|------|-------|
| Daniel | daniel@thecellar.club |
| Julia | julia@thebothy.club |
| Craig | craig@thecellar.club |

Craig and Donna share the Craig login for now. They can split later if needed.

### C — Update `lib/auth.ts`

Change the NextAuth `CredentialsProvider` `authorize` function:

1. Query `admin_users` by email (case-insensitive).
2. Compare password with `bcrypt.compare`.
3. Return `{ id: row.id, email: row.email, name: row.name }`.

Remove the old `ADMIN_EMAIL` / `ADMIN_PASSWORD_HASH` env-var logic entirely.

### D — Update JWT / session shape

The NextAuth JWT callback should store `id`, `email`, and `name` from the user object. The session callback should expose all three on `session.user`. Add a TypeScript module augmentation in `lib/auth.ts` (or `types/next-auth.d.ts`) so `session.user.id` and `session.user.name` are typed.

### E — Update `lib/adminAuth.ts`

`requireAdminSession()` should still work as before (just checks for a valid session). No role checks needed. But it should now return the full session (including `user.id` and `user.name`) so API routes can use them.

### F — Update the login page

`app/admin/login/page.tsx` — no functional changes needed, it already has email + password fields. Just make sure the form posts to the NextAuth credentials endpoint correctly.

### G — Keep old env vars working as fallback (temporary)

During the transition, if the `admin_users` table is empty or the query fails, fall back to the existing `ADMIN_EMAIL` / `ADMIN_PASSWORD_HASH` env-var check. This way the site doesn't break before the seed script runs. Log a warning to console when the fallback fires.

---

## 2. Thread assignment

Every inbox thread can be assigned to an admin user. Assignment is manual — click to claim, or assign to someone else.

### A — Migration `030_inbox_assignment.sql`

```sql
ALTER TABLE customers
  ADD COLUMN inbox_assigned_to uuid REFERENCES admin_users(id),
  ADD COLUMN inbox_assigned_at timestamptz;
```

We put assignment on `customers` because there's one thread per customer (the inbox is customer-keyed). If a thread is closed and reopened, the assignment persists — that's fine, the new handler can reassign if needed.

### B — API route `app/api/admin/inbox/[customerId]/assign/route.ts`

`PATCH` body: `{ assignedTo: uuid | null }`

- Sets `inbox_assigned_to` and `inbox_assigned_at` on the customer row.
- `assignedTo: null` unassigns.
- Returns 200 with the updated assignment.
- Requires admin session. Use `requireAdminSession()` and log who made the change.

### C — UI: assignment controls

Assignment controls live in the **customer panel** (see section 3 — the CRM-style right panel). See section 3C for the full layout, but the assignment-specific elements are:

1. **Assignment badge** — at the top of the customer panel, show who the thread is assigned to. If unassigned, show "Unassigned" in grey. If assigned, show the assignee's name in a coloured pill (use a deterministic colour per user — e.g. hash the user ID to pick from a small palette of 4 soft colours).

2. **Assign dropdown** — clicking the badge opens a small dropdown listing all admin users (fetched once on page load from a new endpoint, see below) plus an "Unassign" option. Selecting a user calls the PATCH endpoint and updates locally.

3. **Quick-claim button** — if the thread is unassigned, show a small "Claim" button next to the badge. Clicking it assigns to the currently logged-in user (no dropdown needed).

### D — API route `app/api/admin/users/route.ts`

`GET` — returns all rows from `admin_users` (id, name, email). No password hashes. Used by the assignment dropdown and other UI that needs the user list.

### E — Thread list indicators

In the left-hand thread list, show the assignee as a small avatar circle (first letter of their name, coloured by user) to the right of each thread row. If unassigned, show nothing (or a faint grey circle with "?").

### F — Filter by assignee

Add a filter row above the thread list (next to the existing "Show closed" checkbox):

- "All" — shows everything
- "Mine" **(default)** — threads assigned to the logged-in user
- "Unassigned" — threads with no assignee
- Individual user names — one option per admin user

This is a client-side filter on the already-loaded threads (no new API call).

---

## 3. Customer panel & notes (CRM sidebar)

The inbox layout changes from two columns (thread list | thread detail) to three columns on desktop: **thread list | conversation | customer panel**. The customer panel is a persistent right-hand sidebar that shows everything an admin needs to know about this customer at a glance — notes, assignment, follow-up, and activity — without scrolling through the chat history. Think of it as a lightweight CRM card pinned next to the conversation.

### A — Layout change: three-column desktop

Update `InboxClientView` to render three columns on desktop (≥1024px):

1. **Left column** (~280px, fixed) — thread list. No change from current.
2. **Middle column** (flex, fills remaining space) — the SMS conversation. This is the existing thread detail view but now only contains: SMS context strip, message timeline (SMS only — no notes here), and the reply textarea at the bottom. The customer name/phone header stays at the top of this column.
3. **Right column** (~320px, fixed) — the **customer panel**. New. Contains (in this order from top to bottom):
   - Assignment controls (from section 2C)
   - Follow-up controls (from section 4C)
   - Notes log (new — see below)
   - Activity log (from section 5C)

When no thread is selected, the middle and right columns show an empty state ("Select a thread").

### B — Layout: mobile

On mobile, the thread detail is already a full-screen view. Add a **collapsible customer panel** above the message timeline:

- A tappable header row: customer name + a chevron toggle. Default: collapsed.
- When expanded, shows the same content as the desktop right column (assignment, follow-up, notes, activity) stacked vertically.
- The panel scrolls independently if its content is long; the message timeline below is not pushed off-screen.

### C — Customer panel sections (desktop right column / mobile collapsible)

From top to bottom:

1. **Assignment** — the badge + dropdown + claim button from section 2C. Compact: one row.

2. **Follow-up** — the date pill + note + set/edit controls from section 4C. Compact: one or two rows when a follow-up is set, a small "Set follow-up" link when not.

3. **Notes** — a timestamped log of internal notes about this customer. This is the primary use of the panel. Notes are customer-level, not tied to a specific conversation thread — they persist even if the thread is closed and a new one opens later. Notes support **@mentions** to tag other admins and notify them by email (see section 3I).

   Display: a scrollable list (max-height ~50% of the panel, scroll if longer), newest at the bottom so the flow reads chronologically. Each note shows:
   - Author name in bold + relative timestamp ("Julia · 2h ago")
   - Note body below. Any `@Name` mentions in the body render in **bold blue text** (`text-blue-600 font-semibold`) so they're immediately visible when scanning the panel.

   At the bottom of the notes section: a compact textarea + "Add note" button. Amber accent styling to distinguish from the SMS reply box in the middle column. The textarea supports @mention autocomplete (see section 3I).

4. **Activity** — the collapsible activity feed from section 5C. Default collapsed to save space.

### D — Migration `031_inbox_notes.sql`

```sql
CREATE TABLE inbox_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id),
  author_id uuid NOT NULL REFERENCES admin_users(id),
  body text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_inbox_notes_customer ON inbox_notes(customer_id);
```

### E — API routes

`GET /api/admin/inbox/[customerId]/notes` — returns all notes for this customer, ordered by `created_at asc`. Join to `admin_users` to include `author.name`.

`POST /api/admin/inbox/[customerId]/notes` — body: `{ body: string, mentions: string[] }`. `mentions` is an array of `admin_users.id` values extracted by the client from the @mention tokens in the note body. The endpoint:

1. Inserts the note with `author_id` from the session.
2. For each mentioned user ID, sends a notification email immediately (see section 3I).
3. Returns the new note with `author_name` populated.

Both require admin session.

### F — Types

```ts
export type InboxNote = {
  id: string
  customer_id: string
  author_id: string
  author_name: string
  body: string
  created_at: string
}
```

Add `notes: InboxNote[]` to `InboxThread`.

### G — Server data

In `app/admin/(protected)/inbox/page.tsx`, fetch `inbox_notes` for all customers that have threads and include them in the thread data passed to `InboxClientView`.

### H — Notes are customer-level, not thread-level

This is important: notes belong to the customer, not to a specific concierge thread. When a thread is closed and a new inbound message opens a fresh thread for the same customer, all previous notes are still visible in the customer panel. This is the whole point — the panel is persistent context about the customer, not ephemeral per-conversation state.

Notes must never appear in the SMS reply flow or be sent via Twilio. The data paths are completely separate.

### I — @mention tagging in notes

Notes support @mentions to tag other admins. When someone types `@` in the note textarea, a small autocomplete popup appears listing all admin users. Selecting a user inserts their name as a token.

**Input behaviour:**

1. When the user types `@` in the note textarea, show a small dropdown anchored to the cursor position listing all admin users (fetched from `GET /api/admin/users`). Filter the list as the user keeps typing (e.g. `@Da` narrows to "Daniel").
2. Selecting a user (click or Enter) inserts a mention token into the text. Store the mention as `@[Name](userId)` in the raw body text — this is a simple markdown-like convention that's easy to parse.
3. Multiple mentions per note are allowed.
4. The client extracts all mention user IDs from the body and sends them in the `mentions` array alongside the `body` in the POST request.

**Display behaviour:**

When rendering a saved note, parse `@[Name](userId)` tokens and render them as **bold blue text** (`text-blue-600 font-semibold`). The rest of the note text renders normally. This makes tagged names jump out visually in the customer panel.

**Email notification:**

When a note with mentions is saved, the API sends an email immediately to each mentioned user. Use Resend (`resend.emails.send()` directly). From: `cheers@thecellar.club`. The email should be short and actionable:

- Subject: `"{Customer name}" — {Author name} mentioned you`
- Body (plain text):

```
{Author name} left a note on {Customer first name} {Customer last initial}'s thread:

"{Note body, up to 200 chars}"

→ Open thread: https://thecellar.club/admin/inbox?customer={customerId}
```

Do not email the note author if they @mention themselves (edge case but handle it).

**Inbox deep link:**

The email links to `/admin/inbox?customer={customerId}`. Update the inbox page to check for this query param on load and auto-select the matching thread if present.

---

## 4. Follow-up dates

Any thread can have a follow-up date — "come back to this on Tuesday" or "wine arriving next week, check in then". Follow-ups surface in the inbox UI and drive the daily digest email.

### A — Migration `032_inbox_follow_ups.sql`

```sql
ALTER TABLE customers
  ADD COLUMN inbox_follow_up_date date,
  ADD COLUMN inbox_follow_up_note text,
  ADD COLUMN inbox_follow_up_set_by uuid REFERENCES admin_users(id);
```

Using `date` not `timestamptz` — we only need day-level granularity. The note is a short free-text reason (e.g. "Barolo arriving, message Sarah about custom box").

### B — API route `app/api/admin/inbox/[customerId]/follow-up/route.ts`

`PATCH` body: `{ date: string | null, note: string | null }`

- `date` is an ISO date string (`2026-05-15`) or `null` to clear.
- `note` is optional context. Can be set/updated independently of the date.
- Sets `inbox_follow_up_set_by` from the session.
- If `date` is `null`, clears all three fields.

### C — UI: follow-up controls in the customer panel

In the customer panel (section 3C), below the assignment badge:

1. **Follow-up badge** — if a follow-up date is set, show it as a pill: "Follow up: Tue 13 May" with the note underneath in smaller text. Colour the pill:
   - Red if the date is today or past (overdue)
   - Amber if the date is tomorrow or within 2 days
   - Grey/neutral otherwise

2. **Set/edit follow-up** — clicking the badge (or a small calendar icon if no follow-up is set) opens an inline form with:
   - A date picker (HTML `<input type="date">` is fine — keep it simple)
   - Quick-pick buttons: "Tomorrow", "Next week" (Monday), "In 2 weeks", "Later" (30 days from now)
   - A short text input for the note
   - Save / Clear buttons

3. **Clear follow-up** — the "Clear" button sets date to null, removing the follow-up.

### D — Thread list indicators

In the left-hand thread list, if a thread has a follow-up date:

- Show a small clock icon (or dot) next to the timestamp.
- If the follow-up date is today or overdue, show the icon in red.
- If it's upcoming (within 3 days), show it in amber.

### E — Inbox sorting update

Update the thread sort order to factor in follow-ups. New priority (highest first):

1. Overdue follow-ups (oldest overdue first) — regardless of open/closed status
2. Today's follow-ups
3. Unanswered open threads (existing behaviour — last message is inbound)
4. Answered open threads
5. Closed threads

This ensures that when Daniel opens the inbox in the morning, overdue and due-today items are at the top.

### F — "Needs attention" / "Later" view

Add a toggle above the thread list (alongside the assignee filter and show-closed checkbox):

- **Active** (default) — shows all threads in the normal sort order, excluding threads whose follow-up date is more than 3 days in the future AND that are closed.
- **Scheduled** — shows only threads that have a follow-up date set, sorted by follow-up date ascending. This is the "snoozed" / "later" view where you can see everything that's been deferred.

This replaces the need for a separate "Later" tab — it's a filter toggle.

---

## 5. Activity log

Every action on a thread should be logged so the team can see who did what. This is lightweight — not a full audit trail, just enough to answer "who replied to this?" and "who assigned it?".

### A — Migration `033_inbox_activity_log.sql`

```sql
CREATE TABLE inbox_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id),
  actor_id uuid NOT NULL REFERENCES admin_users(id),
  action text NOT NULL,
  detail text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_inbox_activity_customer ON inbox_activity(customer_id);
```

`action` values (as a convention, not an enum — keep it flexible):

- `replied` — admin sent an SMS reply. `detail` = first 80 chars of the message.
- `assigned` — thread assigned. `detail` = assignee name (or "Unassigned").
- `note_added` — internal note added. `detail` = first 80 chars.
- `follow_up_set` — follow-up date set/changed. `detail` = the date + note.
- `follow_up_cleared` — follow-up removed.
- `closed` — thread closed.
- `reopened` — thread reopened.
- `request_resolved` — special request resolved.

### B — Log from existing actions

Update these existing API routes to insert an `inbox_activity` row:

- `app/api/admin/concierge/[customerId]/reply/route.ts` → log `replied`
- `app/api/admin/concierge/[customerId]/status/route.ts` → log `closed` or `reopened`
- `app/api/admin/requests/route.ts` (or wherever request resolution happens) → log `request_resolved`
- The new assign and follow-up routes from this spec → log their respective actions

Every log insert needs the `actor_id`. Get it from `requireAdminSession()` which now returns the user ID (per section 1E).

### C — UI: activity feed in customer panel

At the bottom of the customer panel (section 3C, below the notes log), show a collapsible "Activity" section. Default collapsed to save vertical space. When expanded, list activity entries in reverse chronological order:

```
Julia assigned to Daniel · 2 hours ago
Daniel replied: "Great, I've got a Barolo arriving ne..." · 1 hour ago
Julia set follow-up: Tue 13 May — "Barolo arriving, message Sarah" · 1 hour ago
```

Style: small text, grey, minimal. This is reference info, not the main UI.

---

## 6. Fix: conversation column scroll

**Bug**: the conversation column (middle column on desktop) currently grows with the number of messages, pushing the page below the fold. This means a long SMS thread makes the customer panel on the right (notes, follow-up, activity) scroll off-screen — you can't see notes while reading the conversation, which defeats the purpose of the three-column layout.

**Fix**: the conversation column must scroll independently within a fixed-height container. The overall inbox should fill the viewport height without creating a page-level scrollbar.

### A — Desktop layout height

The outer three-column container (`div.hidden.md\\:flex` in `InboxClientView`) should fill the remaining viewport height below the admin nav. Use `calc(100vh - <nav height>)` or a flex/grid approach:

```
height: calc(100vh - <nav bar height>px)
```

Currently the container has `style={{ minHeight: '600px' }}`. Replace this with a proper viewport-filling height. Inspect the admin nav to get its exact height (likely ~48–56px including borders), or use a more robust approach:

```tsx
<div className="hidden md:flex ... h-[calc(100vh-56px)]">
```

### B — Conversation column scroll

The middle column should be `flex flex-col overflow-hidden`. Inside it:

1. **Header** (customer name, phone, request badge, close/reopen button) — `shrink-0`, does not scroll.
2. **Message timeline** — `flex-1 overflow-y-auto`. This is the scrollable area. Messages scroll here, and it auto-scrolls to the bottom when new messages appear (existing behaviour).
3. **Reply input** — `shrink-0`, pinned at the bottom of the column. Does not scroll.

This way the conversation scrolls within its column while the header and reply box stay fixed.

### C — Customer panel scroll

The right column (customer panel) should also be independently scrollable if its content is tall: `overflow-y-auto`. This way if a customer has many notes, the panel scrolls without affecting the conversation column.

### D — Thread list scroll

The left column (thread list) already scrolls independently — confirm this is working and hasn't been broken.

### E — No page-level scrollbar on desktop

The end result: on desktop, the page should never scroll vertically. The three columns fill the viewport, and each column scrolls independently. The admin nav stays fixed at the top.

---

## 7. CLAUDE.md updates

After all the above is implemented, update `CLAUDE.md`:

### A — Key tables section

Add entries for `admin_users`, `inbox_notes`, `inbox_activity`. Update the `customers` entry to mention the new columns (`inbox_assigned_to`, `inbox_follow_up_date`, etc.).

### B — Auth model section

Update the Admin bullet to mention database-backed multi-user auth via `admin_users` table (was: single env-var user).

### C — Migration counter

Update the migration note: latest migration should now be `033_inbox_activity_log.sql`. New work numbers from 034.

---

## Implementation notes for Claude Code

- **Migration numbering**: start from `029`. Check the `supabase/migrations/` directory before creating — if anything has been added since this spec was written, number accordingly.
- **Don't break the existing inbox while building.** The assignment, notes, and follow-up columns are all nullable, so the inbox works fine before any data is populated. The admin auth fallback (section 1G) means the site works before the seed script runs.
- **Three-column layout**: the big structural change is in section 3A. The current two-panel inbox (thread list | thread detail) becomes three columns on desktop (thread list | conversation | customer panel). The conversation column keeps the SMS thread and reply box. Everything else — assignment, follow-up, notes, activity — moves to the customer panel on the right. Get this layout working in section 3 before building sections 4–6, since those sections all render into the customer panel.
- **Mobile**: the customer panel becomes a collapsible section above the message timeline (section 3B). It should be tappable to expand/collapse. Default collapsed so the conversation is visible immediately. All the controls (assignment, follow-up, notes, activity) stack vertically inside it.
- **Customer panel column widths**: thread list ~280px, customer panel ~320px, conversation fills the rest. On screens between 768px and 1024px, consider hiding the customer panel behind a toggle button (like a drawer) rather than forcing three cramped columns.
- **No new npm dependencies** unless absolutely necessary. `bcryptjs` is already installed. The date picker is native HTML. The activity log is just a Supabase insert.
- **Resend**: the @mention notification emails (section 3I) use `resend.emails.send()` directly with the mentioned user's email from `admin_users`. From address: `cheers@thecellar.club`.
- **Notes persist across threads**: this is called out in section 3H but bears repeating. Notes are keyed to `customer_id`, not to a conversation or thread. When a thread closes and a new one opens for the same customer, the notes carry over. This is the core difference from the previous version of this spec where notes were interleaved in the chat.
