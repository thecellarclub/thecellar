# Portal UI Fixes — Claude Code Spec

## Context

This is a Next.js app for The Cellar Club customer portal. The portal uses a light cream colour system (`#F5EFE6` page background, `#EDE8DF` card/panel background, `#1C0E09` dark text) throughout the dashboard. The files to change are:

- `app/portal/page.tsx` — login page layout
- `app/portal/PortalLoginForm.tsx` — login form inputs
- `app/portal/verify/page.tsx` — OTP verify page layout
- `app/portal/verify/PortalVerifyForm.tsx` — OTP verify form inputs
- `app/portal/dashboard/DashboardClient.tsx` — dashboard UI (setup banner, overview section)

---

## Change 1 — Login & verify page: switch from dark to light background

**Files:** `app/portal/page.tsx`, `app/portal/verify/page.tsx`

Both pages currently use `className="min-h-screen bg-maroon ..."` (dark maroon background) with cream text. Change them to use the same light theme as the dashboard.

- Page background: change `bg-maroon` to inline style `background: '#F5EFE6'`
- Brand mark text: change `text-cream` → `color: '#1C0E09'`; `text-cream/60` → `color: 'rgba(42,24,16,0.45)'`
- Card/panel: change `bg-maroon-dark border border-cream/12` → `border` with `background: '#EDE8DF'`, `borderColor: 'rgba(42,24,16,0.12)'`
- Heading: change `text-cream` → `color: '#1C0E09'`
- Subtitle: change `text-cream/55` → `color: 'rgba(42,24,16,0.55)'`
- Footer: change `text-cream/25` → `color: 'rgba(42,24,16,0.30)'`

**File:** `app/portal/PortalLoginForm.tsx`

The phone input and `+44` prefix currently use dark-theme colours. Update:

- Label: change `text-cream/55` → inline style `color: 'rgba(42,24,16,0.55)'`
- Wrapper border: change `border-cream/20 focus-within:border-cream/50` → inline styles `borderColor: 'rgba(42,24,16,0.18)'` with focus state `rgba(42,24,16,0.50)` (use onFocus/onBlur on the wrapper div)
- `+44` span: change `text-cream/60 border-cream/20` → inline styles `color: 'rgba(42,24,16,0.50)'`, `borderColor: 'rgba(42,24,16,0.18)'`
- Input: change `bg-maroon text-cream placeholder-cream/30` → inline styles `background: '#EDE8DF'`, `color: '#1C0E09'`; remove Tailwind bg/text/placeholder classes

**File:** `app/portal/verify/PortalVerifyForm.tsx`

- Label: change `text-cream/55` → inline style `color: 'rgba(42,24,16,0.55)'`
- Input: change `bg-maroon border border-cream/20 text-cream placeholder-cream/30 focus:border-cream/50` → inline styles `background: '#EDE8DF'`, `color: '#1C0E09'`, `borderColor: 'rgba(42,24,16,0.18)'`
- Error/success message: change dark variants (`text-green-400 bg-green-950/30 border-green-900/40`, `text-red-400 bg-red-950/30 border-red-900/40`) → light variants (`text-green-700 bg-green-50 border-green-200`, `text-red-700 bg-red-50 border-red-200`)
- "Didn't get it?" text: change `text-cream/40` → `color: 'rgba(42,24,16,0.45)'`; resend button: change `text-cream/60 hover:text-cream` → `color: 'rgba(42,24,16,0.65)'`

---

## Change 2 — "Finish setting up your account" banner: warning style + first-login modal

**File:** `app/portal/dashboard/DashboardClient.tsx`

### 2a — Banner styling

The current setup banner (rendered when `setupIncomplete` is true, around line 313) has a maroon left border on a plain cream background. Change it to a clear amber/warning style so it stands out:

- Background: `#FFFBEB` (amber-50)
- Left border colour: `#B45309` (amber-700)
- Top/right/bottom border colour: `#FDE68A` (amber-200)
- Heading (`font-serif text-lg`): change `color: '#1C0E09'` → `color: '#78350F'`; add a ⚠️ emoji icon before the text (in a flex row with `gap-2`)
- Subtitle (`font-sans text-sm`): change `color: 'rgba(42,24,16,0.60)'` → `color: '#92400E'`; update copy to: `"You need a payment card and delivery address to order wine by text."`
- Checklist item labels (`font-sans text-sm`): change `color: '#1C0E09'` → `color: '#78350F'`; add `font-medium`
- Checklist dot circles: change `borderColor: '#9B1B30'` and `background: '#9B1B30'` → `#B45309`
- Action buttons ("Add card →", "Add address →"): change `bg-rio` → inline `background: '#B45309'`; keep `text-cream`/white text

### 2b — First-login setup modal

Add a modal overlay that appears automatically the **first time** a customer logs in when their setup is incomplete (no card or no address). It must only show once per login session — use `sessionStorage` to track this.

**Implementation:**

1. Add `useEffect` import (it is not currently imported — `DashboardClient.tsx` only imports `useState, FormEvent`).
2. Add state: `const [showSetupModal, setShowSetupModal] = useState(false)`
3. Add a `useEffect` with an empty dependency array that checks setup completeness using the props directly (not the derived `hasCard`/`hasAddress` constants, which are declared later in the function). Check `!primaryCard && !cardSaved` for missing card, `!defaultAddress` for missing address. If either is missing, check `sessionStorage.getItem('setup_modal_shown')` — if not set, call `setShowSetupModal(true)` and `sessionStorage.setItem('setup_modal_shown', '1')`.
4. Render the modal **above** the `<main>` element (wrap the whole return in a `<>` fragment). The modal should only render when `showSetupModal` is true.

**Modal design:**

- Fixed full-screen overlay: `position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center; padding: 1rem; background: rgba(18,6,8,0.55)`
- Inner panel: `max-width: 24rem; width: 100%; padding: 1.5rem; background: #FFFBEB; border: 1px solid #FDE68A; border-top: 4px solid #B45309`
- Heading row: flex with ⚠️ emoji + `font-serif text-xl` heading in `color: '#78350F'`
- Body text (`font-sans text-sm`, `color: '#92400E'`): `"Before you can order wine by text, you need to add a payment card and a delivery address. It only takes a minute."`
- Buttons (only show the ones that are missing):
  - "Add a payment card →": full-width, `background: '#B45309'`, white text, `font-sans text-sm font-medium`. On click: `setShowSetupModal(false); setSection('card')`
  - "Add a delivery address →": full-width, `background: '#FEF3C7'`, `color: '#78350F'`, border `#FDE68A`. On click: `setShowSetupModal(false); setSection('address')`
- Dismiss link at bottom: `"I'll do this later"` — small, muted (`color: 'rgba(120,53,15,0.55)'`), no button styling. On click: `setShowSetupModal(false)`

---

## Change 3 — Overview section: improve text visibility

**File:** `app/portal/dashboard/DashboardClient.tsx`

Several elements in the Overview tab and the `CardPill` component use opacity values that are too faint on the cream background. Darken them:

| Element | Current colour | New colour |
|---|---|---|
| `CardPill` label ("Primary", "Backup") | `rgba(42,24,16,0.45)` | `rgba(42,24,16,0.65)` |
| "Delivery address" section label | `rgba(42,24,16,0.45)` | `rgba(42,24,16,0.65)` |
| Address lines (when address exists) | `rgba(42,24,16,0.75)` | `#1C0E09` |
| "No address saved yet." | `rgba(42,24,16,0.40)` | `rgba(42,24,16,0.70)` |
| "Update address" / "Add address" link | `rgba(42,24,16,0.50)` | `rgba(42,24,16,0.70)` |
| "Payment cards" section label | `rgba(42,24,16,0.45)` | `rgba(42,24,16,0.65)` |
| "No card on file." | `rgba(42,24,16,0.40)` | `rgba(42,24,16,0.70)` |
| "Manage cards" link | `rgba(42,24,16,0.50)` | `rgba(42,24,16,0.70)` |

No structural changes — only the `color` values in inline styles need updating.
