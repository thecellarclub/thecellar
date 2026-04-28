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
    .replace(/[\u2014\u2013\u2012]/g, '-')   // em dash, en dash, figure dash -> hyphen
    .replace(/[\u2018\u2019]/g, "'")          // curly single quotes -> apostrophe
    .replace(/[\u201C\u201D]/g, '"')          // curly double quotes -> straight quote
    .replace(/\u00B7|\u2022|\u2027/g, '.')   // middle dot, bullet -> full stop
    .replace(/\u2026/g, '...')               // ellipsis -> three dots
    .replace(/\u00A0/g, ' ')                 // non-breaking space -> space
    // Strip any remaining non-GSM-7 characters
    .split('')
    .filter(ch => GSM7_BASIC.has(ch) || GSM7_EXTENDED.has(ch))
    .join('')
}

export async function sendSms(to: string, body: string) {
  return twilioClient.messages.create({
    to,
    from: process.env.TWILIO_PHONE_NUMBER!,
    body: sanitiseGsm7(body),
  })
}
