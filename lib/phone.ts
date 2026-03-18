/**
 * Normalise a UK mobile number to E.164 (+447xxxxxxxxx).
 * Accepts: 07..., +447..., 447..., with optional spaces/dashes.
 * Throws if not a recognisable UK mobile.
 */
export function normaliseUKPhone(input: string): string {
  const digits = input.replace(/[\s\-().+]/g, '')

  // Already E.164 without + sign
  if (/^447\d{9}$/.test(digits)) return '+' + digits

  // Starts with 0 (UK national format)
  if (/^07\d{9}$/.test(digits)) return '+44' + digits.slice(1)

  // Already has country code with +
  if (/^\+447\d{9}$/.test(input.replace(/[\s\-()]/g, ''))) {
    return input.replace(/[\s\-()]/g, '')
  }

  throw new Error('Please enter a valid UK mobile number (e.g. 07700 900000)')
}
