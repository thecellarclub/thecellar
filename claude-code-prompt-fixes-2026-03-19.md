# Claude Code Prompt — Bug Fixes 2026-03-19

Three things to fix. Do them in order.

---

## 1. Remove "guests only" restriction text

Two lines in the codebase incorrectly say the club is for guests who've visited our venues. This isn't true — the club is open to anyone. Delete both lines, no replacement needed.

**File 1:** `app/join/layout.tsx`
Find and remove the line: `For guests who've visited Coarse, Isla, or Crush.`
(and any wrapping `<p>` or `<span>` tag if it's the only content in that element)

**File 2:** `app/join/page.tsx`
Find and remove the line: `The Cellar Club is for guests who've visited Crush or Norse.`
(and any wrapping element if it's the only content)

Remove cleanly — no ugly empty tags left behind.

---

## 2. Phone number normalisation bug

### The problem
Customers are registering successfully but then getting "Sorry, we don't recognise this number" when they text in. The root cause is a format mismatch between how numbers are stored in the database and how Twilio sends the `From` field.

Twilio always sends `From` in E.164 format: `+447826665548`.
Some numbers in the DB may be stored in national format: `07826665548`.
The Twilio webhook does a raw `.eq('phone', from)` lookup — if the stored format doesn't match, no customer is found.

### Fix A — Normalise the Twilio webhook lookup

In `app/api/webhooks/twilio/inbound/route.ts`, import `normaliseUKPhone` from `@/lib/phone` and normalise the `from` field before the customer lookup. Wrap in try/catch — if normalisation fails (non-UK number), send the "sorry we don't recognise" message and return.

```ts
import { normaliseUKPhone } from '@/lib/phone'

// At the top of the handler, after extracting `from` from formData:
let from: string
try {
  from = normaliseUKPhone(rawFrom)
} catch {
  // Non-UK number — ignore silently or send a polite response
  return twimlOk()
}
```

### Fix B — Normalise all existing phone numbers in the DB

Write a Supabase migration (`supabase/migrations/010_normalise_phones.sql`) that updates all existing customer phone numbers to E.164 format. The transformation needed:

- `07XXXXXXXXX` → `+447XXXXXXXXX` (strip leading 0, prepend +44)
- `+447XXXXXXXXX` → no change (already correct)
- `447XXXXXXXXX` → `+447XXXXXXXXX` (prepend +)
- Any other format — leave alone (log a warning, don't break)

SQL to handle the common cases:

```sql
-- National format: 07xxxxxxxxx → +447xxxxxxxxx
UPDATE customers
SET phone = '+44' || substring(phone from 2)
WHERE phone ~ '^07\d{9}$';

-- Missing + prefix: 447xxxxxxxxx → +447xxxxxxxxx
UPDATE customers
SET phone = '+' || phone
WHERE phone ~ '^447\d{9}$';
```

Apply this migration. Verify by checking the customers table after.

### Fix C — Update normaliseUKPhone to reject non-UK numbers explicitly

Update `lib/phone.ts` to:
1. Keep all existing UK normalisation logic
2. After all valid patterns, throw with a UK-specific message: `'We currently only accept UK mobile numbers (starting 07 or +44).'`
3. Add handling for the edge case where someone enters `+44` followed by a number starting with `0` (e.g. `+440782...`) — strip the extra 0: `+44` + `7826...`

```ts
// Edge case: +440... (double-zero after country code)
if (/^\+440\d{9}$/.test(input.replace(/[\s\-()]/g, ''))) {
  return '+44' + input.replace(/[\s\-()]/g, '').slice(4) // strip the 0 after +44
}
```

### Fix D — Update the sign-up UI

In `app/join/page.tsx`, update the phone input:
- Add placeholder text: `07700 900000`
- Add a small helper text below the input: `UK numbers only (07xxx or +447xxx)`
- Update the validation error message for invalid phone numbers to: `Please enter a valid UK mobile number — starting 07 or +44.`

---

## 3. Verify fix integrity

After making all changes:

1. Check `lib/phone.ts` — confirm `normaliseUKPhone('07826665548')` returns `'+447826665548'`, and `normaliseUKPhone('+447826665548')` also returns `'+447826665548'`
2. Check the Twilio webhook — confirm `from` is normalised before the DB lookup
3. Check the SQL migration looks correct before applying
4. Run `npm run build` — confirm no TypeScript errors

Do not apply the Supabase migration automatically — output the SQL and confirm it's ready to run, then apply it.
