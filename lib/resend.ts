import { Resend } from 'resend'

const FROM_EMAIL = 'The Cellar Club <cheers@thecellar.club>'
const ADMIN_EMAIL = 'hello@crushwines.co'

/**
 * Send a plain-text notification email to the admin inbox.
 * Fire-and-forget — caller should not await this in a hot path.
 * Pass an explicit `to` for SMS-flow alerts (members@thecellar.club);
 * omit to use the default ADMIN_EMAIL for all existing callers.
 */
export async function notifyAdmin(subject: string, text: string, to?: string): Promise<void> {
  const key = process.env.RESEND_API_KEY
  if (!key || key.startsWith('re_placeholder')) {
    console.warn('[resend] RESEND_API_KEY not configured — skipping email')
    return
  }
  try {
    const resend = new Resend(key)
    await resend.emails.send({
      from: FROM_EMAIL,
      to: to ?? ADMIN_EMAIL,
      subject,
      text,
    })
  } catch (err) {
    // Email failure must never break the SMS reply — log and move on
    console.error('[resend] failed to send admin notification:', err)
  }
}
