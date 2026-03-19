# Claude Code Prompt — Admin Panel Mobile Optimization

The admin panel needs to work well on mobile, primarily for managing customer requests and concierge messages on the go. Focus on `/admin/requests` and `/admin/concierge`. A lighter pass on the overall admin navigation is also needed.

---

## 1. `/admin/requests` — Mobile layout

**Problem:** The current table layout breaks on mobile. On small screens, switch to a card-based layout.

**On mobile (< 768px):**
- Replace the table with a stacked card list
- Each card shows:
  - Customer name (bold, large enough to tap) + phone number
  - Message text (truncated to 3 lines with "show more" expansion)
  - Timestamp (relative, e.g. "2 hours ago")
  - Status badge (new / in_progress / resolved) — colour coded: new = Rio Red, in_progress = amber, resolved = muted green
  - "Mark resolved" button — full-width, large tap target (min 44px height)
- Cards should have clear separation and a left border colour-coded by status
- Most recent at the top

**On desktop:** Keep the existing table layout.

---

## 2. `/admin/concierge` — Mobile layout

This is the most important one. On mobile it needs to feel like a messaging interface.

**Thread list view (mobile):**
- Replace table with a list of conversation previews (like iMessage/WhatsApp thread list)
- Each row: customer name, last message preview (truncated), timestamp
- Unread / unanswered threads should be visually distinct (bold name, Rio Red left dot)
- Tap a row → go to the thread detail view

**Thread detail view (mobile):**
- Full-screen conversation view
- Back button at top → returns to thread list
- Messages in chat bubble style:
  - Inbound (customer) messages: left-aligned, dark background, cream text
  - Outbound (admin) messages: right-aligned, Rio Red background, cream text
- Timestamps under each message (small, muted)
- Reply input fixed at the bottom of the screen — full width, large enough to type comfortably on mobile. Send button to the right of input.
- The input area must sit ABOVE the mobile keyboard (use `position: sticky; bottom: 0` with appropriate padding)

**On desktop:** Keep the existing split-panel or thread view layout — only apply the mobile overhaul at < 768px.

---

## 3. Admin navigation — mobile

The admin sidebar or nav probably doesn't work well on mobile. Make these changes:

- On mobile (< 768px): replace the sidebar with a top navigation bar + hamburger menu that opens a drawer
- Drawer should slide in from the left and list all admin pages with large tap targets
- Current page should be highlighted
- Close the drawer when a nav item is tapped

Alternatively if there's already a responsive admin nav that mostly works, just ensure the hamburger/drawer pattern is solid and the tap targets are ≥ 44px.

---

## 4. General mobile admin improvements

- All buttons in admin must be at least 44px tall on mobile
- Form inputs must be at least 16px font size on mobile (prevents iOS zoom-on-focus)
- Tables on other admin pages (customers, wines, texts, shipments) should be horizontally scrollable on mobile rather than broken — wrap them in `overflow-x: auto`
- The dashboard stats should stack vertically on mobile (currently likely a grid)

---

## Implementation notes

- Use Tailwind responsive prefixes (`md:`, `lg:`) for breakpoint-specific styles
- The mobile concierge thread view is the highest-priority piece — get this right first
- Do not change the desktop admin experience — mobile-only changes only

---

*Ref: winetexts-build-spec.md Section 5 (Admin Interface)*
