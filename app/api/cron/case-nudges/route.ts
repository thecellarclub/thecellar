import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { twilioClient } from '@/lib/twilio'
import { stripe } from '@/lib/stripe'
import { getRollingSpend, tierFromSpend } from '@/lib/tiers'

/**
 * GET /api/cron/case-nudges
 *
 * Runs daily at 09:00 via Vercel cron (see vercel.json).
 * Secured by Authorization: Bearer CRON_SECRET header.
 *
 * For each active customer with a running case timer:
 *   Day 75+: send nudge 1 (if not sent)
 *   Day 90+: send nudge 2 (if not sent)
 *   Day 104+ & nudge 2 sent: auto-ship, charge £15, reset timer
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb = createServiceClient()
  const now = new Date()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  async function sendSms(to: string, body: string): Promise<void> {
    await twilioClient.messages.create({
      to,
      from: process.env.TWILIO_PHONE_NUMBER!,
      body,
    })
  }

  // Fetch all active customers with a running case timer
  const { data: customers } = await sb
    .from('customers')
    .select('id, phone, stripe_customer_id, stripe_payment_method_id, case_started_at, case_nudge_1_sent_at, case_nudge_2_sent_at, tier, tier_review_at')
    .not('case_started_at', 'is', null)
    .eq('active', true)

  let nudge1Count = 0
  let nudge2Count = 0
  let autoShipCount = 0
  let tierDowngrades = 0
  let tierReviewed = 0

  for (const customer of customers ?? []) {
    const caseStart = new Date(customer.case_started_at)
    const daysSinceCase = Math.floor((now.getTime() - caseStart.getTime()) / (1000 * 60 * 60 * 24))

    // Fetch unshipped cellar count for this customer
    const { count: bottleCount } = await sb
      .from('cellar')
      .select('*', { count: 'exact', head: true })
      .eq('customer_id', customer.id)
      .is('shipped_at', null)

    const bottles = bottleCount ?? 0

    if (bottles === 0) {
      // Nothing in cellar — reset timer silently
      await sb
        .from('customers')
        .update({ case_started_at: null, case_nudge_1_sent_at: null, case_nudge_2_sent_at: null })
        .eq('id', customer.id)
      continue
    }

    const deadline = new Date(caseStart)
    deadline.setDate(deadline.getDate() + 90)
    const deadlineStr = deadline.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })

    if (daysSinceCase >= 104 && customer.case_nudge_2_sent_at) {
      // ── Auto-ship: charge £15 and create pending shipment ─────────────────
      try {
        const pi = await stripe.paymentIntents.create({
          amount: 1500,
          currency: 'gbp',
          customer: customer.stripe_customer_id,
          payment_method: customer.stripe_payment_method_id,
          confirm: true,
          off_session: true,
          description: 'Early shipment fee — The Cellar Club',
          metadata: { customer_id: customer.id, reason: 'auto_ship_cron' },
        })

        if (pi.status === 'succeeded') {
          // Fetch unshipped cellar rows
          const { data: cellarRows } = await sb
            .from('cellar')
            .select('id')
            .eq('customer_id', customer.id)
            .is('shipped_at', null)

          // Create pending shipment
          const shipToken = crypto.randomUUID()
          const { data: shipment } = await sb
            .from('shipments')
            .insert({
              customer_id: customer.id,
              status: 'pending',
              token: shipToken,
              bottle_count: bottles,
              shipping_fee_pence: 1500,
              stripe_payment_intent_id: pi.id,
              stripe_charge_status: 'succeeded',
              created_at: now.toISOString(),
            })
            .select('id')
            .single()

          if (shipment && cellarRows && cellarRows.length > 0) {
            const ids = cellarRows.map((r: { id: string }) => r.id)
            await sb
              .from('cellar')
              .update({ shipment_id: shipment.id, shipped_at: now.toISOString() })
              .in('id', ids)
          }

          // Reset case timer
          await sb
            .from('customers')
            .update({ case_started_at: null, case_nudge_1_sent_at: null, case_nudge_2_sent_at: null })
            .eq('id', customer.id)

          await sendSms(
            customer.phone,
            `Your 90-day case deadline has passed — we've started shipping your ${bottles} bottle${bottles !== 1 ? 's' : ''} and charged £15 for delivery. Please confirm your address: ${appUrl}/ship?token=${shipToken}`
          )

          autoShipCount++
        }
      } catch (err) {
        console.error('[cron/case-nudges] auto-ship charge failed for customer', customer.id, err)
      }
    } else if (daysSinceCase >= 90 && !customer.case_nudge_2_sent_at) {
      // ── Nudge 2: final warning ────────────────────────────────────────────
      await sb
        .from('customers')
        .update({ case_nudge_2_sent_at: now.toISOString() })
        .eq('id', customer.id)

      await sendSms(
        customer.phone,
        `Last call — your case deadline is ${deadlineStr}. You have ${bottles} bottle${bottles !== 1 ? 's' : ''} in your cellar. Reply SHIP to send them for £15, or keep collecting for free at 12. After the deadline we'll ship automatically and charge £15.`
      )

      nudge2Count++
    } else if (daysSinceCase >= 75 && !customer.case_nudge_1_sent_at) {
      // ── Nudge 1: gentle reminder ──────────────────────────────────────────
      await sb
        .from('customers')
        .update({ case_nudge_1_sent_at: now.toISOString() })
        .eq('id', customer.id)

      await sendSms(
        customer.phone,
        `Just a nudge — your case deadline is ${deadlineStr}. You have ${bottles} bottle${bottles !== 1 ? 's' : ''} in your cellar. Complete your case of 12 for free shipping, or reply SHIP any time to send what you have for £15.`
      )

      nudge1Count++
    }
  }

  // ── Tier review (downgrades) ──────────────────────────────────────────────
  const { data: tierCustomers } = await sb
    .from('customers')
    .select('id, phone, tier, tier_review_at')
    .not('tier_review_at', 'is', null)
    .lte('tier_review_at', now.toISOString())
    .neq('tier', 'none')
    .neq('tier', 'bailey')

  for (const tc of tierCustomers ?? []) {
    tierReviewed++
    const spend = await getRollingSpend(tc.id, sb)
    const qualifyingTier = tierFromSpend(spend)

    const tierRank: Record<string, number> = { none: 0, bailey: 1, elvet: 2, palatine: 3 }
    const currentRank = tierRank[tc.tier] ?? 1
    const qualifyingRank = tierRank[qualifyingTier] ?? 1

    // Set next review 1 year from now
    const nextReview = new Date(now)
    nextReview.setFullYear(nextReview.getFullYear() + 1)

    if (qualifyingRank < currentRank) {
      // Downgrade
      await sb
        .from('customers')
        .update({
          tier: qualifyingTier,
          tier_since: now.toISOString(),
          tier_review_at: nextReview.toISOString(),
        })
        .eq('id', tc.id)

      const tierNames: Record<string, string> = {
        bailey: 'Bailey',
        elvet: 'Elvet',
        palatine: 'Palatine',
      }
      await sendSms(
        tc.phone,
        `Your Cellar Club membership has moved to ${tierNames[qualifyingTier] ?? qualifyingTier} tier. Keep collecting to work your way back up — every bottle counts.`
      ).catch((e: unknown) => console.error('[cron] tier downgrade SMS failed:', e))

      tierDowngrades++
    } else {
      // No downgrade needed — just push review date forward
      await sb
        .from('customers')
        .update({ tier_review_at: nextReview.toISOString() })
        .eq('id', tc.id)
    }
  }

  return NextResponse.json({
    ok: true,
    processed: (customers ?? []).length,
    nudge1: nudge1Count,
    nudge2: nudge2Count,
    autoShipped: autoShipCount,
    tierReviewed,
    tierDowngrades,
  })
}
