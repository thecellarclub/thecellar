import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { sendSms } from '@/lib/twilio'
import { deliveryThreshold, TIER_NAMES } from '@/lib/tiers'

/**
 * GET /api/cron/case-nudges
 *
 * Runs daily at 09:00 via Vercel cron (see vercel.json).
 * Secured by Authorization: Bearer CRON_SECRET header.
 *
 * There is no case deadline. Customers are never rushed and never billed
 * automatically for early shipping — the only way a customer is charged for
 * shipping under a full case is the customer-initiated SHIP → SHIP CONFIRM
 * flow (handled entirely in the Twilio inbound webhook). This cron:
 *   Day 90+ of filling a case (once per case): send a single no-pressure
 *   reminder with their bottle count and a link to the rewards page.
 * Slow-filling cellars beyond that are surfaced to admins instead — see the
 * inbox-digest cron's "slow-filling cellars" section and the "Case days"
 * column on /admin/customers.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb = createServiceClient()
  const now = new Date()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  // ── Expire stale awaiting_confirmation orders ─────────────────────────────
  // Covers both broadcast and manual-offer orders whose window has closed but
  // the customer never interacted again (so handleYes never cleaned them up).
  let expiredOrderCount = 0
  const { data: staleOrders } = await sb
    .from('orders')
    .select('id, wine_id, quantity')
    .eq('order_status', 'awaiting_confirmation')
    .lt('confirmation_expires_at', now.toISOString())

  for (const stale of staleOrders ?? []) {
    await sb.from('orders').update({ order_status: 'expired' }).eq('id', stale.id)
    const { data: wine } = await sb.from('wines').select('stock_bottles').eq('id', stale.wine_id).maybeSingle()
    if (wine) {
      await sb.from('wines').update({ stock_bottles: wine.stock_bottles + stale.quantity }).eq('id', stale.wine_id)
    }
    expiredOrderCount++
  }

  // Fetch all active customers with a running case timer
  const { data: customers } = await sb
    .from('customers')
    .select('id, phone, case_started_at, case_reminder_sent_at, tier, tier_review_at, free_shipping_at_6')
    .not('case_started_at', 'is', null)
    .eq('status', 'active')

  let reminderCount = 0
  let tierDowngrades = 0
  let tierReviewed = 0

  for (const customer of customers ?? []) {
    const caseStart = new Date(customer.case_started_at)
    const daysSinceCase = Math.floor((now.getTime() - caseStart.getTime()) / (1000 * 60 * 60 * 24))

    // Fetch unreserved cellar bottle total (sum of quantity, not row count)
    // for this customer. customer_cellar_totals already filters
    // shipment_id IS NULL, so bottles reserved in a pending shipment don't
    // trigger a reminder.
    const { data: cellarTotal } = await sb
      .from('customer_cellar_totals')
      .select('total_bottles')
      .eq('customer_id', customer.id)
      .maybeSingle()

    const bottles = Number(cellarTotal?.total_bottles ?? 0)

    if (bottles === 0) {
      // Nothing in cellar — reset timer silently
      await sb
        .from('customers')
        .update({ case_started_at: null, case_reminder_sent_at: null })
        .eq('id', customer.id)
      continue
    }

    if (daysSinceCase >= 90 && !customer.case_reminder_sent_at) {
      // ── Single gentle reminder — no fee, no SHIP instruction, no date ────────
      const threshold = deliveryThreshold(customer.tier, customer.free_shipping_at_6)
      const remaining = Math.max(0, threshold - bottles)

      await sb
        .from('customers')
        .update({ case_reminder_sent_at: now.toISOString() })
        .eq('id', customer.id)

      await sendSms(
        customer.phone,
        `You have ${bottles} bottle${bottles !== 1 ? 's' : ''} in your cellar - ${remaining} more and your case ships free. No deadline, take your time. Every case counts towards your member rewards: ${appUrl}/club`,
        { trigger: 'cron:case-reminder', customerId: customer.id }
      )

      reminderCount++
    }
  }

  // ── Tier review (annual soft-demote, tiers-v3) ────────────────────────────
  // On each member's first-purchase anniversary: soft-demote one rank as a
  // floor (palatine -> elvet, elvet -> bailey, bailey stays bailey), and start
  // a fresh case-counting cycle (tier_since reset). Credit and milestones are
  // never touched here — this only ever moves `tier`/`tier_since`/`tier_review_at`.
  const TIER_DEMOTE: Record<string, string> = { palatine: 'elvet', elvet: 'bailey', bailey: 'bailey' }

  const { data: tierCustomers } = await sb
    .from('customers')
    .select('id, phone, tier, tier_review_at')
    .not('tier_review_at', 'is', null)
    .lte('tier_review_at', now.toISOString())
    .neq('tier', 'none')

  for (const tc of tierCustomers ?? []) {
    tierReviewed++
    const newTier = TIER_DEMOTE[tc.tier] ?? tc.tier

    const nextReview = new Date(now)
    nextReview.setFullYear(nextReview.getFullYear() + 1)

    await sb
      .from('customers')
      .update({ tier: newTier, tier_since: now.toISOString(), tier_review_at: nextReview.toISOString() })
      .eq('id', tc.id)

    if (newTier !== tc.tier) {
      tierDowngrades++
      await sendSms(
        tc.phone,
        `Your membership has moved to ${TIER_NAMES[newTier] ?? newTier} tier for the new year. Keep collecting to work your way back up - every case counts.`,
        { trigger: 'cron:tier-downgrade', customerId: tc.id }
      ).catch((e: unknown) => console.error('[cron] tier downgrade SMS failed:', e))
    }
  }

  return NextResponse.json({
    ok: true,
    expiredOrders: expiredOrderCount,
    processed: (customers ?? []).length,
    reminders: reminderCount,
    tierReviewed,
    tierDowngrades,
  })
}
