# Sign-Up Flow Improvements — Implementation Spec

This spec describes five targeted changes to the sign-up flow. Each section includes the exact files to touch, the exact changes to make, and any gotchas to watch for.

---

## 1. Rename "Cellar Text" → "The Cellar Club" Everywhere

Replace every user-visible occurrence of "Cellar Text" with "The Cellar Club".

### Files to change

| File | Location | Current text | New text |
|------|----------|--------------|----------|
| `app/admin/(protected)/layout.tsx` | Line 8 (page title) | `'Cellar Text Admin'` | `'The Cellar Club Admin'` |
| `app/admin/(protected)/layout.tsx` | Line 20 (sidebar nav) | `"Cellar Text"` | `"The Cellar Club"` |
| `app/admin/_components/MobileAdminNav.tsx` | Lines 32 & 66 | `"Cellar Text"` (×2) | `"The Cellar Club"` |
| `app/api/signup/send-code/route.ts` | Line 84 (SMS body) | `"Your Cellar Text verification code is: ${code}"` | `"Your The Cellar Club verification code is: ${code}"` |

> **Note:** "The Cellar Club" already appears correctly in most places (welcome SMS, marketing consent text, inbound fallback SMS). Only the four locations above need updating.

---

## 2. Shorten the SMS Marketing Consent Label

**File:** `app/join/details/page.tsx` — line 203–207

**Current text:**
```
I agree to receive promotional SMS messages from The Cellar Club. Reply STOP at any time to unsubscribe.
```

**New text:**
```
I agree to receive SMS messages from The Cellar Club. Reply STOP at any time to unsubscribe.
```

Just remove the word "promotional". Leave all surrounding JSX, styling, and the checkbox binding unchanged.

---

## 3. Update the Card-Step Security Message

**File:** `app/join/card/CardForm.tsx` — line 128

**Current text:**
```
Your card is saved securely. You'll only be charged when you order a wine.
```

**New text:**
```
The Cellar Club is free to join. You'll only be charged when you order wine.
```

Leave the rest of `CardForm.tsx` untouched (the "Secured by Stripe" line below stays as-is).

---

## 4. Persist Sign-Up Progress to the Database at Each Step

### Goal

If a user drops off part-way through sign-up, we currently lose all their data because the only database write happens in `app/api/signup/complete/route.ts` at the very end. We need to save to the database at each stage so we can re-engage drop-offs.

### Database changes

Add a new table `signup_progress` to store partial sign-up state. Add a migration file at `supabase/migrations/<timestamp>_signup_progress.sql`:

```sql
create table if not exists signup_progress (
  id            uuid primary key default gen_random_uuid(),
  phone         text unique not null,
  email         text,
  first_name    text,
  last_name     text,
  dob           date,
  age_verified  boolean default false,
  stripe_customer_id        text,
  stripe_payment_method_id  text,
  last_step     text not null default 'phone',   -- 'phone' | 'verified' | 'details' | 'card' | 'complete'
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Index for quick look-up by phone
create index if not exists signup_progress_phone_idx on signup_progress(phone);
```

Use an **upsert on `phone`** at every step so there is never a duplicate row per phone number.

### API route changes

Make the following changes to each existing route. Keep all existing session logic intact — the session is still the source of truth for the flow; the database row is purely for recovery.

#### `app/api/signup/send-code/route.ts` — after sending the SMS

After the existing session save (currently around line 94–98), add an upsert:

```typescript
// Persist phone to signup_progress so we can recover drop-offs
await supabase
  .from('signup_progress')
  .upsert(
    { phone: normalisedPhone, last_step: 'phone', updated_at: new Date().toISOString() },
    { onConflict: 'phone' }
  );
```

Import the Supabase client at the top of the file if it isn't already imported (check other routes for the correct import pattern — likely `import { createClient } from '@/lib/supabase/server'`).

#### `app/api/signup/verify-code/route.ts` — after marking the phone verified

After updating the session with `phoneVerified: true`, add:

```typescript
await supabase
  .from('signup_progress')
  .upsert(
    { phone: normalisedPhone, last_step: 'verified', updated_at: new Date().toISOString() },
    { onConflict: 'phone' }
  );
```

The normalised phone is available from the session at this point.

#### `app/api/signup/save-details/route.ts` — after saving to session

After the existing session save (firstName, lastName, DOB), add:

```typescript
await supabase
  .from('signup_progress')
  .upsert(
    {
      phone: session.phone,
      first_name: body.firstName,
      last_name: body.lastName,
      dob: dobString,           // same ISO date string computed for the age check
      age_verified: true,
      last_step: 'details',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'phone' }
  );
```

#### `app/api/signup/create-setup-intent/route.ts` — after creating the Stripe customer

After saving `stripeCustomerId` and `email` to the session, add:

```typescript
await supabase
  .from('signup_progress')
  .upsert(
    {
      phone: session.phone,
      email: body.email,
      stripe_customer_id: stripeCustomer.id,
      last_step: 'card_started',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'phone' }
  );
```

#### `app/api/signup/save-payment-method/route.ts` — after saving payment method ID to session

```typescript
await supabase
  .from('signup_progress')
  .upsert(
    {
      phone: session.phone,
      stripe_payment_method_id: paymentMethodId,
      last_step: 'card_complete',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'phone' }
  );
```

#### `app/api/signup/complete/route.ts` — after successful customer creation

Once the `customers` row is successfully inserted, mark the progress row as complete and then delete it (or just mark it complete — deleting keeps the table tidy):

```typescript
await supabase
  .from('signup_progress')
  .delete()
  .eq('phone', normalisedPhone);
```

If you prefer to keep the audit trail, use an update to `last_step: 'complete'` instead of a delete.

### Error handling

Wrap each upsert in a `try/catch` (or check for a Supabase error) and log it, but **do not** let a failed progress save break the sign-up flow. The session is still the source of truth; the progress row is best-effort.

```typescript
const { error } = await supabase.from('signup_progress').upsert(…);
if (error) console.error('[signup_progress] upsert failed:', error.message);
```

---

## 5. Switch the Entire Sign-Up Flow to the Light Colour Palette

### Goal

The sign-up flow currently uses a dark maroon theme. Switching it to the same light cream palette as the homepage solves the card autofill problem completely (dark text on a light/yellow background is always readable), and makes the flow visually consistent with the rest of the site.

### Colour mapping

| Element | Old (dark theme) | New (light theme) |
|---------|-----------------|-------------------|
| Page background | `bg-maroon` / `#120608` | `#EDE8DF` |
| Panel/card background | `bg-maroon-dark` / `#1E0B10` | `#F5EFE6` |
| Input background | `bg-maroon` | `#EDE8DF` (`bg-[#EDE8DF]`) |
| Primary text | `text-cream` / `#F0E6DC` | `#1C0E09` |
| Secondary text | `text-cream/55` etc | `rgba(42,24,16,0.55)` etc |
| Borders | `border-cream/20` etc | `rgba(42,24,16,0.18)` |
| Step indicator accent | `text-gold` / `#C9851D` | `#9B1B30` (burgundy, same as primary button) |
| Placeholder text | `placeholder-cream/30` | `rgba(42,24,16,0.35)` |
| Error messages | `text-red-400 bg-red-950/30 border-red-900/40` | `text-red-700 bg-red-50 border-red-200` |
| Footer/link text | `text-cream/30`, `text-cream/35` | `rgba(42,24,16,0.35)`, `rgba(42,24,16,0.45)` |

The primary action button (`bg-rio text-cream`) stays unchanged — burgundy with cream text works on both themes.

### Files to change

#### `app/join/layout.tsx`

- Outer div: `bg-maroon` → `style={{ backgroundColor: '#EDE8DF' }}` (remove the Tailwind class)
- Brand mark text: `text-cream` → `style={{ color: '#1C0E09' }}`; sub-labels `text-cream/70` → `style={{ color: 'rgba(42,24,16,0.50)' }}`
- Divider `bg-gold/50` → `style={{ backgroundColor: 'rgba(42,24,16,0.20)' }}`
- Footer `border-cream/10` → `style={{ borderTop: '1px solid rgba(42,24,16,0.12)' }}`
- Footer text `text-cream/30` → `style={{ color: 'rgba(42,24,16,0.35)' }}`
- Footer links `text-cream/35 hover:text-cream/60` → `style={{ color: 'rgba(42,24,16,0.45)' }}`

#### `app/join/page.tsx`

- Panel: `bg-maroon-dark border-cream/12` → `bg-[#F5EFE6]` with `style={{ borderColor: 'rgba(42,24,16,0.12)' }}`
- "Sending code" state: same panel treatment
- Step label `text-gold` → `style={{ color: '#9B1B30' }}`
- Heading `text-cream` → `style={{ color: '#1C0E09' }}`
- Label `text-cream/55` → `style={{ color: 'rgba(42,24,16,0.55)' }}`
- Input container border `border-cream/20` → `style={{ borderColor: 'rgba(42,24,16,0.18)' }}`
- Country code prefix `text-cream/60 border-cream/20` → same rgba equivalents
- Input `bg-maroon text-cream placeholder-cream/30` → `bg-[#EDE8DF]` with `style={{ color: '#1C0E09' }}`
- Error box: `text-red-400 bg-red-950/30 border-red-900/40` → `text-red-700 bg-red-50 border-red-200`

#### `app/join/verify/page.tsx`

Same panel, step label, heading, input, and error box changes as above. Additionally:
- Subtitle `text-cream/55` → rgba equivalent
- "Too many attempts" text `text-cream/70`, `text-cream/50` → rgba equivalents
- Link colour `text-cream/60 hover:text-cream` → `style={{ color: '#9B1B30' }}`
- Footer note `text-cream/40` → rgba equivalent

#### `app/join/details/page.tsx`

Same panel, heading, label, input changes. Additionally:
- `<select>` elements: `bg-maroon border-cream/20 text-cream` → `bg-[#EDE8DF]` with rgba border and dark text
- Checkbox helper text `text-cream/35` → `rgba(42,24,16,0.40)`
- Consent label text `text-cream/60` → `rgba(42,24,16,0.65)`
- `<strong>` inside consent: `text-cream/80` → `#1C0E09`
- Red asterisk: `text-red-400` → `text-red-600`

#### `app/join/card/CardForm.tsx`

Same panel, heading, label, email input changes. Additionally, update the `CARD_ELEMENT_OPTIONS` Stripe styles:

```typescript
const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      color: '#1C0E09',                          // was '#F0E6DC'
      fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
      fontSize: '16px',
      '::placeholder': { color: 'rgba(42,24,16,0.35)' },  // was 'rgba(240,230,220,0.3)'
      iconColor: '#1C0E09',                      // was '#F0E6DC'
    },
    invalid: {
      color: '#b91c1c',                          // was '#f87171'
      iconColor: '#b91c1c',
    },
  },
}
```

The card element container: `bg-maroon border-cream/20` → `bg-[#EDE8DF]` with rgba border.
Helper text `text-cream/30` → `rgba(42,24,16,0.40)`.
Also update the subtitle text (combines with change #3 above): `"The Cellar Club is free to join. You'll only be charged when you order wine."`

#### `app/join/address/AddressForm.tsx`

Same panel, heading, label, input changes. The reusable `inputClass` and `labelClass` constants at the top of the component both need updating — change them and all instances update automatically.

#### `app/join/confirmed/page.tsx`

- Panel: `bg-maroon-dark border-cream/12` → light equivalents
- Checkmark border: `border-cream/20` → `rgba(42,24,16,0.20)`
- Checkmark icon: `text-cream/60` → `rgba(42,24,16,0.50)`
- Heading `text-cream` → `#1C0E09`
- Body text `text-cream/55`, `text-cream/35` → rgba equivalents

### `app/globals.css` — autofill override

The existing autofill rule forces dark maroon background + cream text on all inputs. Add a parallel rule specifically for the light-theme inputs so the autofill background blends in and text stays dark:

```css
/* Light theme autofill (join/sign-up flow uses #EDE8DF inputs with dark text) */
input.bg-\[\#EDE8DF\]:-webkit-autofill,
input.bg-\[\#EDE8DF\]:-webkit-autofill:hover,
input.bg-\[\#EDE8DF\]:-webkit-autofill:focus,
input.bg-\[\#EDE8DF\]:-webkit-autofill:active {
  -webkit-box-shadow: 0 0 0 1000px #EDE8DF inset !important;
  box-shadow: 0 0 0 1000px #EDE8DF inset !important;
  -webkit-text-fill-color: #1C0E09 !important;
  caret-color: #1C0E09;
}
```

Keep the existing dark rule untouched above it — it still applies to the rest of the site.

---

## Testing checklist

After implementing all five changes, verify:

- [ ] Admin sidebar and page title show "The Cellar Club"
- [ ] Verification SMS reads "Your The Cellar Club verification code is: …"
- [ ] Marketing consent checkbox reads "I agree to receive SMS messages from The Cellar Club…" (no "promotional")
- [ ] Card step subtitle reads "The Cellar Club is free to join. You'll only be charged when you order wine."
- [ ] All sign-up pages have a cream/beige background matching the homepage (`#EDE8DF`)
- [ ] All panels have an off-white card background (`#F5EFE6`)
- [ ] All input text, labels, headings are dark brown — not cream
- [ ] Browser autofill on name/address/email fields shows dark text (no invisible text)
- [ ] Stripe `CardElement` shows dark text and icons at all times
- [ ] Primary buttons remain burgundy (`bg-rio`) with cream text
- [ ] After entering phone number, a row appears in `signup_progress` with `last_step = 'phone'`
- [ ] After verifying code, row updates to `last_step = 'verified'`
- [ ] After submitting details, row updates with name, DOB and `last_step = 'details'`
- [ ] After card saved, row updates with `stripe_customer_id`, `stripe_payment_method_id` and `last_step = 'card_complete'`
- [ ] After address submitted, row is deleted and full customer row exists in `customers`
