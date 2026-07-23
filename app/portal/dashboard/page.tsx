import { redirect } from 'next/navigation'
import { getPortalSession } from '@/lib/portal-auth'
import { createServiceClient } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'
import { getRollingBottles, getLadderPosition } from '@/lib/tiers'
import { buildLadderNodes } from './ladder'
import DashboardClient from './DashboardClient'

type CellarRow = {
  quantity: number
  wines: { name: string; price_pence: number } | null
}

export default async function PortalDashboardPage() {
  const session = await getPortalSession()
  if (!session) redirect('/portal')

  const sb = createServiceClient()

  const { data: customer } = await sb
    .from('customers')
    .select('id, first_name, phone, tier, tier_since, tier_review_at, cycle_start_rung, cycle_year, stripe_payment_method_id, backup_payment_method_id, default_address, credit_balance_pence')
    .eq('id', session.customerId)
    .maybeSingle()

  if (!customer) redirect('/portal')

  // Cellar
  const { data: cellarRows } = await sb
    .from('cellar')
    .select('quantity, wines(name, price_pence)')
    .eq('customer_id', customer.id)
    .is('shipped_at', null) as { data: CellarRow[] | null }

  const bottles = (cellarRows ?? []).reduce((s, r) => s + r.quantity, 0)

  // Cases + bottles within the current membership-year cycle (tiers-v3.2),
  // and the member's ladder position (cycle_start_rung + cases this cycle).
  const bottlesThisCycle = await getRollingBottles(customer.id, sb)
  const casesThisCycle = Math.floor(bottlesThisCycle / 12)
  const ladderPosition = await getLadderPosition(customer.id, sb)
  const cycleYear = customer.cycle_year ?? 1
  const cycleStartRung = customer.cycle_start_rung ?? 0

  // This cycle year's milestone (gift-rung) awards only — a prior year's
  // award for the same rung must never render as "done" this year (tiers-v3.2:
  // a re-passed rung carries a new gift).
  const { data: milestoneRows } = await sb
    .from('milestone_awards')
    .select('milestone, reward_choice, fulfilled_at')
    .eq('customer_id', customer.id)
    .eq('cycle_year', cycleYear)
    .order('milestone', { ascending: true })

  const ladderNodes = buildLadderNodes({
    cycleStartRung,
    position: ladderPosition,
    cycleYear,
    tier: customer.tier ?? 'none',
    milestones: (milestoneRows ?? []).map((m) => ({
      milestone: m.milestone,
      rewardChoice: m.reward_choice,
      fulfilledAt: m.fulfilled_at,
    })),
  })
  const topOfLadder = ladderPosition >= 7

  // Renewal date fallback chain: tier_review_at -> tier_since+1yr -> first
  // confirmed order date +1yr -> null (brand-new member, no orders — hide
  // the renewal line entirely). Migration 044 hasn't run for everyone, so
  // tier/tier_since can still be null here.
  let renewalDate: string | null = customer.tier_review_at ?? null
  if (!renewalDate && customer.tier_since) {
    const d = new Date(customer.tier_since)
    d.setFullYear(d.getFullYear() + 1)
    renewalDate = d.toISOString()
  }
  if (!renewalDate) {
    const { data: firstOrder } = await sb
      .from('orders')
      .select('created_at')
      .eq('customer_id', customer.id)
      .eq('order_status', 'confirmed')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (firstOrder) {
      const d = new Date(firstOrder.created_at)
      d.setFullYear(d.getFullYear() + 1)
      renewalDate = d.toISOString()
    }
  }

  // Past payments
  const { data: paymentRows } = await sb
    .from('orders')
    .select('id, quantity, total_pence, stripe_charge_status, created_at, wines(name, vintage, region)')
    .eq('customer_id', customer.id)
    .order('created_at', { ascending: false })

  // Past shipments
  const { data: shipmentRows } = await sb
    .from('shipments')
    .select('id, status, tracking_number, tracking_provider, created_at, dispatched_at, delivered_at')
    .eq('customer_id', customer.id)
    .order('created_at', { ascending: false })

  // Cards from Stripe
  let primaryCard: { last4: string; brand: string; exp_month: number; exp_year: number } | null = null
  let backupCard: { last4: string; brand: string; exp_month: number; exp_year: number } | null = null

  if (customer.stripe_payment_method_id) {
    try {
      const pm = await stripe.paymentMethods.retrieve(customer.stripe_payment_method_id)
      if (pm.card) {
        primaryCard = { last4: pm.card.last4, brand: pm.card.brand, exp_month: pm.card.exp_month, exp_year: pm.card.exp_year }
      }
    } catch { /* non-fatal */ }
  }

  if (customer.backup_payment_method_id) {
    try {
      const pm = await stripe.paymentMethods.retrieve(customer.backup_payment_method_id)
      if (pm.card) {
        backupCard = { last4: pm.card.last4, brand: pm.card.brand, exp_month: pm.card.exp_month, exp_year: pm.card.exp_year }
      }
    } catch { /* non-fatal */ }
  }

  const addr = customer.default_address as Record<string, string> | null

  type PaymentWine = { name: string; vintage: number | null; region: string | null } | null

  return (
    <DashboardClient
      firstName={customer.first_name ?? ''}
      phone={customer.phone}
      tier={customer.tier ?? 'none'}
      tierSince={customer.tier_since ?? null}
      creditBalancePence={customer.credit_balance_pence ?? 0}
      bottles={bottles}
      cellar={(cellarRows ?? []).map((r) => ({
        quantity: r.quantity,
        name: r.wines?.name ?? 'Unknown wine',
        pricePence: r.wines?.price_pence ?? 0,
      }))}
      casesThisCycle={casesThisCycle}
      bottlesThisCycle={bottlesThisCycle}
      ladderNodes={ladderNodes}
      topOfLadder={topOfLadder}
      renewalDate={renewalDate}
      twilioPhoneNumber={process.env.TWILIO_PHONE_NUMBER ?? ''}
      primaryCard={primaryCard}
      backupCard={backupCard}
      defaultAddress={addr ? {
        line1: addr.line1 ?? '',
        line2: addr.line2 ?? undefined,
        city: addr.city ?? '',
        postcode: addr.postcode ?? '',
      } : null}
      payments={(paymentRows ?? []).map((p) => {
        const wine = p.wines as unknown as PaymentWine
        return {
          id: p.id,
          quantity: p.quantity,
          totalPence: p.total_pence,
          status: p.stripe_charge_status,
          createdAt: p.created_at,
          wineName: wine?.name ?? '—',
          wineVintage: wine?.vintage ?? null,
          wineRegion: wine?.region ?? null,
        }
      })}
      shipments={(shipmentRows ?? []).map((s) => ({
        id: s.id,
        status: s.status,
        trackingNumber: s.tracking_number ?? null,
        trackingProvider: s.tracking_provider ?? null,
        createdAt: s.created_at,
        dispatchedAt: s.dispatched_at ?? null,
        deliveredAt: s.delivered_at ?? null,
      }))}
    />
  )
}
