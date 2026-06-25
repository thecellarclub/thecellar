import twilio from 'twilio'

export const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)

// GSM-7 basic character set (160 chars/SMS, 153 per segment in multipart)
const GSM7_BASIC = new Set(
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./' +
  '0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZ' +
  'ÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyz' +
  'äöñüà'
)
// Extended GSM-7 characters — each counts as 2 units
const GSM7_EXTENDED = new Set('{}\\[~]|€^')

/**
 * Sanitise a string to GSM-7 encoding, replacing common lookalikes and
 * stripping any remaining non-GSM-7 characters. This keeps messages in
 * GSM-7 (160 chars/SMS) rather than falling back to UCS-2 (70 chars/SMS).
 */
export function sanitiseGsm7(text: string): string {
  return text
    // Common typographic replacements
    .replace(/[—–‒]/g, '-')   // em dash, en dash, figure dash -> hyphen
    .replace(/[‘’]/g, "'")          // curly single quotes -> apostrophe
    .replace(/[“”]/g, '"')          // curly double quotes -> straight quote
    .replace(/·|•|‧/g, '.')   // middle dot, bullet -> full stop
    .replace(/…/g, '...')               // ellipsis -> three dots
    .replace(/ /g, ' ')                 // non-breaking space -> space
    // Strip any remaining non-GSM-7 characters
    .split('')
    .filter(ch => GSM7_BASIC.has(ch) || GSM7_EXTENDED.has(ch))
    .join('')
}

export async function sendSms(
  to: string,
  body: string,
  opts?: { trigger?: string; customerId?: string }
): Promise<void> {
  const sanitized = sanitiseGsm7(body)
  await twilioClient.messages.create({
    to,
    from: process.env.TWILIO_PHONE_NUMBER!,
    body: sanitized,
  })
}
