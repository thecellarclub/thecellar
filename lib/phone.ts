/**
 * Normalise a UK mobile number to E.164 (+447xxxxxxxxx).
 * Accepts: 07..., +447..., 447..., +440... (double-zero edge case), with optional spaces/dashes.
 * Throws if not a recognisable UK mobile.
 */
export function normaliseUKPhone(input: string): string {
  const clean = input.replace(/[\s\-()]/g, '')

  // Edge case: +440xxxxxxxx (someone typed +44 then kept the leading 0)
  if (/^\+440\d{9}$/.test(clean)) return '+44' + clean.slice(4)

  // Already E.164 (+447xxxxxxxxx)
  if (/^\+447\d{9}$/.test(clean)) return clean

  // Already E.164 without + sign (447xxxxxxxxx)
  const digits = clean.replace(/^\+/, '')
  if (/^447\d{9}$/.test(digits)) return '+' + digits

  // UK national format (07xxxxxxxxx)
  if (/^07\d{9}$/.test(digits)) return '+44' + digits.slice(1)

  throw new Error('We currently only accept UK mobile numbers (starting 07 or +44).')
}
