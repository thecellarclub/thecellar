# Spec: Ordinal dates in SMS messages

## Problem

SMS messages containing dates show bare day numbers — "4 August", "22 March" — instead of correct British English ordinals — "4th August", "22nd March". This is visible in the SMS log and customer messages.

The dates are built inline with `toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })` in two files. The `formatDate` utility in `lib/format.ts` is **not** used here — so fixing `lib/format.ts` alone won't catch these.

---

## Affected locations

### `lib/post-charge.ts`

**Line ~91** — cellar update SMS after a charge:
```ts
const deadlineStr = deadline.toLocaleDateString('en-GB', {
  day: 'numeric',
  month: 'long',
})
```
Used in: `"Complete your case of 12 by ${deadlineStr} for free shipping…"`

**Line ~241** — case-ready SMS (overflow bottles, next case deadline):
```ts
const deadlineStr = deadline.toLocaleDateString('en-GB', {
  day: 'numeric',
  month: 'long',
})
```
Used in: `"Complete your next case by ${deadlineStr} for free shipping."`

### `app/api/cron/case-nudges/route.ts`

**Line ~84** — shared `deadlineStr` used by both nudge-1 and nudge-2 SMS:
```ts
const deadlineStr = deadline.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
```
Used in:
- nudge-1: `"Just a nudge - your case deadline is ${deadlineStr}…"`
- nudge-2: `"Last call - your case deadline is ${deadlineStr}…"`

---

## Fix

Add a small ordinal helper and use it wherever `deadlineStr` is built. Do **not** use `toLocaleDateString` with `day: 'numeric'` for SMS output — it produces bare numbers.

### Ordinal helper (add to `lib/format.ts` and export, or inline at each call site)

```ts
export function ordinalDate(date: Date): string {
  const day = date.getDate()
  const suffix =
    day % 100 >= 11 && day % 100 <= 13
      ? 'th'
      : ['th', 'st', 'nd', 'rd', 'th'][Math.min(day % 10, 4)]
  const month = date.toLocaleDateString('en-GB', { month: 'long' })
  return `${day}${suffix} ${month}`
}
```

Examples: `1st January`, `2nd August`, `3rd March`, `4th July`, `11th November`, `22nd October`.

> **No year needed** — these deadlines are always within the next 90 days, so the year is unambiguous and omitting it keeps the SMS shorter.

### Replace each `deadlineStr` build:

**Before (all three locations):**
```ts
const deadlineStr = deadline.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
// or the multi-line variant
const deadlineStr = deadline.toLocaleDateString('en-GB', {
  day: 'numeric',
  month: 'long',
})
```

**After:**
```ts
import { ordinalDate } from '@/lib/format'
// ...
const deadlineStr = ordinalDate(deadline)
```

---

## Files to change

- `lib/format.ts` — add and export `ordinalDate(date: Date): string`
- `lib/post-charge.ts` — replace both `deadlineStr` builds with `ordinalDate(deadline)`
- `app/api/cron/case-nudges/route.ts` — replace the one `deadlineStr` build with `ordinalDate(deadline)`

---

## Note on `lib/format.ts` `formatDate` / `formatDateTime`

The `admin-ux-batch-2` spec also calls for `formatDate` and `formatDateTime` to use ordinals (for admin UI dates). That's a separate change to the same file — the two can be done together or independently. The `ordinalDate` helper above can be used by both.
