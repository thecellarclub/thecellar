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
 * In both cases, if there is an active offer with stock remaining a second SMS
 * is sent with the offer body so new members can engage immediately without
 * needing to text OFFER. If the active offer is sold out (or there is no active
 * offer) the welcome message notes that the next offer is coming soon.
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

  // Fetch the current active offer once — used for all welcomes in this run
  const { data: activeOffer } = await sb
    .from('texts')
    .select('id, body, wines(stock_bottles)')
    .eq('is_active', true)
    .maybeSingle() as {
      data: { id: string; body: string; wines: { stock_bottles: number } | null } | null
    }

  const offerInStock =
    activeOffer !== null && (activeOffer.wines?.stock_bottles ?? 0) > 0

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
        // ── Welcome A — customer has a card ────────────────────────────────
        const outOfStockLine = offerInStock
          ? ''
          : '\n\nThe latest offer has just sold out — the next one will be with you in a few days.'

        await twilioClient.messages.create({
          to: customer.phone,
          from: process.env.TWILIO_PHONE_NUMBER!,
          body: sanitiseGsm7(
            `Welcome, ${name}! It's Daniel from The Cellar Club.\n\nI'll text you whenever I find something special. If you fancy it, reply how many bottles. I'll store them in the cellar until you fill a case of 12, then deliver free.${outOfStockLine}\n\nGot a question or request? Text me anytime.`
          ),
        })

        // Send the current offer as a follow-up if there's stock
        if (offerInStock && activeOffer) {
          await twilioClient.messages.create({
            to: customer.phone,
            from: process.env.TWILIO_PHONE_NUMBER!,
            body: sanitiseGsm7(activeOffer.body),
          })
        }
      } else {
        // ── Welcome B — no card on file ────────────────────────────────────
        const { generateShortToken } = await import('@/lib/token')
        const billingToken = generateShortToken()
        const billingTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

        await sb
          .from('customers')
          .update({ billing_token: billingToken, billing_token_expires_at: billingTokenExpiresAt })
          .eq('id', customer.id)

        const cardLine = `Nothing charged unless you order: ${appUrl}/b/${billingToken}`

        const outOfStockLine = offerInStock
          ? ''
          : '\n\nThe latest offer has just sold out — the next one will be with you in a few days.'

        await twilioClient.messages.create({
          to: customer.phone,
          from: process.env.TWILIO_PHONE_NUMBER!,
          body: sanitiseGsm7(
            `Welcome, ${name}! It's Daniel from The Cellar Club.\n\nI'll text you whenever I find something special. Add your card so you're ready to order in one tap when an offer drops: ${cardLine}${outOfStockLine}`
          ),
        })

        // Send the current offer as a follow-up if there's stock
        if (offerInStock && activeOffer) {
          await twilioClient.messages.create({
            to: customer.phone,
            from: process.env.TWILIO_PHONE_NUMBER!,
            body: sanitiseGsm7(activeOffer.body),
          })
        }
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
