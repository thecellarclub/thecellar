import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { twilioClient, sanitiseGsm7 } from '@/lib/twilio'

/**
 * GET /api/cron/welcome-and-card-prompt
 *
 * Runs hourly at the top of each hour via Vercel cron (see vercel.json).
 * Secured by Authorization: Bearer CRON_SECRET header.
 *
 * Sends a welcome SMS to customers who completed Step 2 (details) but haven't
 * been welcomed yet and whose welcome_pending_at is at least 5 minutes old:
 *
 *   - If they now have a card on file → welcome A (same as the happy-path SMS)
 *   - If still no card → welcome B with a billing link to add their card
 *
 * Sets welcome_sent_at and clears welcome_pending_at after sending.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb = createServiceClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()

  const { data: candidates } = await sb
    .from('customers')
    .select('id, phone, first_name, stripe_payment_method_id')
    .eq('active', true)
    .not('first_name', 'is', null)
    .not('dob', 'is', null)
    .is('welcome_sent_at', null)
    .not('welcome_pending_at', 'is', null)
    .lt('welcome_pending_at', fiveMinutesAgo)

  let sent = 0

  for (const customer of candidates ?? []) {
    try {
      // Re-fetch stripe_payment_method_id immediately before sending in case
      // save-payment-method ran between the query above and now
      const { data: fresh } = await sb
        .from('customers')
        .select('stripe_payment_method_id, welcome_sent_at')
        .eq('id', customer.id)
        .single()

      if (!fresh || fresh.welcome_sent_at) continue

      const name = customer.first_name ?? 'there'

      if (fresh.stripe_payment_method_id) {
        // Customer finished Step 3 after the query — send completed-card welcome (A)
        await twilioClient.messages.create({
          to: customer.phone,
          from: process.env.TWILIO_PHONE_NUMBER!,
          body: sanitiseGsm7(
            `Welcome, ${name}! It's Daniel from The Cellar Club.\n\nI'll text you whenever I find something special. If you fancy it, reply how many bottles. I'll store them in the cellar until you fill a case of 12, then deliver free.\n\nGot a question or request? Text me anytime.`
          ),
        })
      } else {
        // No card on file — mint a 24-hour billing token and send welcome B
        const { generateShortToken } = await import('@/lib/token')
        const billingToken = generateShortToken()
        const billingTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

        await sb
          .from('customers')
          .update({ billing_token: billingToken, billing_token_expires_at: billingTokenExpiresAt })
          .eq('id', customer.id)

        await twilioClient.messages.create({
          to: customer.phone,
          from: process.env.TWILIO_PHONE_NUMBER!,
          body: sanitiseGsm7(
            `Welcome, ${name}! It's Daniel from The Cellar Club.\n\nI'll text you whenever I find something special. Add a card here so you're ready to buy in one tap when an offer drops: ${appUrl}/b/${billingToken}\n\nOr just reply OFFER any time and I'll send the latest.`
          ),
        })
      }

      await sb
        .from('customers')
        .update({ welcome_sent_at: new Date().toISOString(), welcome_pending_at: null })
        .eq('id', customer.id)

      sent++
    } catch (err) {
      console.error('[cron/welcome-and-card-prompt] failed for customer', customer.id, err)
    }
  }

  return NextResponse.json({ ok: true, sent, candidates: (candidates ?? []).length })
}
