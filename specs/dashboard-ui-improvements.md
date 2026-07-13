# Spec: Dashboard UI Improvements
**File:** `app/portal/dashboard/DashboardClient.tsx`

## Overview

Three related visual improvements to the member dashboard page, based on the current `DashboardClient.tsx`.

---

## 1. Lighter card/box backgrounds

The `background: '#EDE8DF'` used on all dashboard boxes (tier summary, overview cards, address/card section panels) looks too dark against the page background of `#F5EFE6`. Lighten these to feel airier.

**Change:** Replace `background: '#EDE8DF'` with `background: '#F8F4EF'` on all panel/box elements inside `DashboardClient.tsx`. This applies to:
- The tier + cellar summary box (line ~460)
- The overview "Delivery address" panel (line ~591)
- The overview "Payment cards" panel (line ~612)
- The card section panels (lines ~677, ~697)

Keep the `borderColor: 'rgba(42,24,16,0.12)'` unchanged. The input fields use `bg-[#EDE8DF]` as a Tailwind class — leave those as-is (inputs should stay slightly darker than the panel background for contrast).

---

## 2. Replace the setup banner with a sticky top-of-screen notification bar

Currently, when `setupIncomplete` is true, there is a yellow banner inline in the page scroll (around line ~391). When the user clicks "Add address →" or "Add card →", it just sets `section` to `'address'` or `'card'`, scrolling the user to a tab section far below. This is confusing.

**Replace the inline banner with a sticky notification bar** that sits fixed at the top of the viewport (below the header), and **replace the section-switching tab pattern with inline modals** triggered directly from the banner.

### 2a. Sticky banner

Remove the existing inline `setupIncomplete` banner block (lines ~391–448). Replace it with a sticky bar rendered just inside `<main>`, pinned below the header:

```tsx
{setupIncomplete && (
  <div
    style={{
      position: 'sticky',
      top: 0,
      zIndex: 40,
      background: '#1C0E09',
      borderBottom: '1px solid rgba(255,255,255,0.08)',
      padding: '0.75rem 1.5rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '1rem',
    }}
  >
    <p className="font-sans text-xs" style={{ color: 'rgba(240,230,220,0.80)' }}>
      Add a {!hasCard && !hasAddress ? 'payment card and delivery address' : !hasCard ? 'payment card' : 'delivery address'} to start ordering by text.
    </p>
    <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
      {!hasCard && (
        <button
          onClick={() => setActiveModal('card')}
          className="font-sans text-xs font-medium px-3 py-1.5 transition-opacity hover:opacity-90"
          style={{ background: '#9B1B30', color: '#F0E6DC' }}
        >
          Add card
        </button>
      )}
      {!hasAddress && (
        <button
          onClick={() => setActiveModal('address')}
          className="font-sans text-xs font-medium px-3 py-1.5 border transition-opacity hover:opacity-90"
          style={{ borderColor: 'rgba(240,230,220,0.25)', color: 'rgba(240,230,220,0.80)', background: 'transparent' }}
        >
          Add address
        </button>
      )}
    </div>
  </div>
)}
```

### 2b. Modal state

Add a new state variable:

```tsx
const [activeModal, setActiveModal] = useState<'address' | 'card' | null>(null)
```

The existing "Add address →" and "Add card →" buttons in the Overview section (`setSection('address')` / `setSection('card')`) should also be updated to call `setActiveModal('address')` / `setActiveModal('card')` instead of `setSection(...)`.

The existing `section` state and the three nav tabs (Overview / Address / Payment) remain unchanged for users who want to navigate manually — only the prompts from the setup banner and overview nudge buttons open modals.

### 2c. Address modal

Render a centred modal overlay when `activeModal === 'address'`. It should wrap the existing address form (the same `<form onSubmit={handleAddressSubmit}>` block currently in `{section === 'address'}`) without duplicating the submit handler logic. On successful save (`addrMsg === 'Address saved.'`) call `setActiveModal(null)` to close.

```tsx
{activeModal === 'address' && (
  <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'rgba(18,6,8,0.60)' }}>
    <div style={{ maxWidth: '26rem', width: '100%', background: '#F8F4EF', padding: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <h2 className="font-serif text-xl" style={{ color: '#1C0E09' }}>Delivery address</h2>
        <button onClick={() => setActiveModal(null)} className="font-sans text-xs" style={{ color: 'rgba(42,24,16,0.45)' }}>✕ Close</button>
      </div>
      {/* existing address form fields go here */}
    </div>
  </div>
)}
```

### 2d. Card modal

Same pattern for `activeModal === 'card'`, wrapping `<PortalCardForm>`. On `onSuccess`, call `setCardSaved(true)`, `router.refresh()`, and `setActiveModal(null)`.

```tsx
{activeModal === 'card' && (
  <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'rgba(18,6,8,0.60)' }}>
    <div style={{ maxWidth: '26rem', width: '100%', background: '#F8F4EF', padding: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <h2 className="font-serif text-xl" style={{ color: '#1C0E09' }}>Add a payment card</h2>
        <button onClick={() => setActiveModal(null)} className="font-sans text-xs" style={{ color: 'rgba(42,24,16,0.45)' }}>✕ Close</button>
      </div>
      <PortalCardForm onSuccess={() => { setCardSaved(true); router.refresh(); setActiveModal(null) }} />
    </div>
  </div>
)}
```

---

## 3. Improve the first-login modal

The existing `showSetupModal` (the modal that appears only once per session, lines ~307–369) uses amber/yellow tones (`#FFFBEB`, `#FDE68A`, `#B45309`) that clash with the rest of the design. Replace its colour palette to match the dark, wine-house aesthetic used elsewhere.

**Replace:**
- `background: '#FFFBEB'` → `background: '#F8F4EF'`
- `border: '1px solid #FDE68A'` → `border: '1px solid rgba(42,24,16,0.14)'`
- `borderTop: '4px solid #B45309'` → `borderTop: '4px solid #9B1B30'`
- Heading `color: '#78350F'` → `color: '#1C0E09'`
- Body text `color: '#92400E'` → `color: 'rgba(42,24,16,0.70)'`
- The "Add a payment card →" primary button: keep `background: '#9B1B30'` (rio), text `#F0E6DC`
- The "Add a delivery address →" secondary button: `background: 'transparent'`, `border: '1px solid rgba(42,24,16,0.20)'`, `color: '#1C0E09'`
- The "I'll do this later" dismiss link: `color: 'rgba(42,24,16,0.45)'`
- Replace the `⚠️` emoji with a simple inline SVG exclamation icon or remove it entirely — the emoji reads as a browser warning and undercuts the premium feel

Both CTA buttons in the modal should now open the respective `activeModal` (new in step 2) rather than calling `setSection(...)`.

---

## Summary of state changes

| Before | After |
|---|---|
| `section` controls inline address/card forms via tab nav | No change — tabs still work |
| Setup banner is inline in page scroll | Removed; replaced with sticky top bar |
| Banner CTAs call `setSection(...)` | New CTAs call `setActiveModal(...)` |
| No `activeModal` state | `activeModal: 'address' \| 'card' \| null` added |
| First-login modal uses amber palette | First-login modal uses cream/maroon palette |
| Boxes background `#EDE8DF` | Boxes background `#F8F4EF` |

No API routes, database changes, or new dependencies required.
