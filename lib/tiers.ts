import { createServiceClient } from '@/lib/supabase'
import { sendSms } from '@/lib/twilio'
import { sanitiseGsm7 } from '@/lib/twilio'

type SB = ReturnType<typeof createServiceClient>

/**
 * Naming note (deliberate, unchanged from v2 — do not "correct" this): `bailey`
 * is the ENTRY tier and `elvet` is the MID tier, swapped vs the old spend-based
 * code's naming.
 */
export const TIER_RANK: Record<string, number> = { none: 0, bailey: 1, elvet: 2, palatine: 3 }

export const TIER_NAMES: Record<string, string> = {
  none: 'none',
  bailey: 'Bailey',
  elvet: 'Elvet',
  palatine: 'Palatine',
}

/** Tier from case count, per the tiers-v3 ladder (2 / 4 / 6 cases). Still used
 * as a display fallback for tier-less customers in the inbound SMS webhook —
 * the milestone/upgrade path uses `tierFromRung` (tiers-v3-2) instead. */
export function tierFromCases(cases: number): 'none' | 'bailey' | 'elvet' | 'palatine' {
  if (cases >= 6) return 'palatine'
  if (cases >= 4) return 'elvet'
  if (cases >= 2) return 'bailey'
  return 'none'
}

/** The ladder rung a tier's floor sits at (tiers-v3-2 relative climb). */
export function rungOfTier(tier: string): number {
  if (tier === 'palatine') return 6
  if (tier === 'elvet') return 4
  if (tier === 'bailey') return 2
  return 0
}

/** Tier implied by a ladder position (cycle_start_rung + cases this cycle). */
export function tierFromRung(rung: number): 'none' | 'bailey' | 'elvet' | 'palatine' {
  if (rung >= 6) return 'palatine'
  if (rung >= 4) return 'elvet'
  if (rung >= 2) return 'bailey'
  return 'none'
}

/**
 * Total refunded quantity for a set of orders, keyed by order_id. Refunds
 * never change `orders.order_status` away from 'confirmed' (see the admin
 * refund route), so anything counting confirmed-order bottles must net this
 * out itself or refunded bottles count towards case totals forever.
 */
export async function getRefundedQuantityByOrder(orderIds: string[], sb: SB): Promise<Record<string, number>> {
  if (orderIds.length === 0) return {}
  const { data } = await sb.from('refunds').select('order_id, quantity').in('order_id', orderIds)
  const byOrder: Record<string, number> = {}
  for (const r of data ?? []) {
    byOrder[r.order_id] = (byOrder[r.order_id] ?? 0) + r.quantity
  }
  return byOrder
}

/**
 * Un-floored bottle count from confirmed orders within the customer's
 * current tier cycle, net of refunds. The cycle starts at `tier_since` — set
 * once on a customer's first-ever tier upgrade, then only moved by the
 * annual tier-review cron's soft-demote step (see case-nudges cron) — and
 * falls back to `subscribed_at` for customers who haven't earned a tier yet.
 */
export async function getRollingBottles(customerId: string, sb: SB): Promise<number> {
  const { data: customer } = await sb
    .from('customers')
    .select('tier_since, subscribed_at')
    .eq('id', customerId)
    .maybeSingle()

  const since = customer?.tier_since ?? customer?.subscribed_at ?? new Date(0).toISOString()

  const { data } = await sb
    .from('orders')
    .select('id, quantity')
    .eq('customer_id', customerId)
    .eq('order_status', 'confirmed')
    .gte('created_at', since)

  const orders = data ?? []
  const refundedByOrder = await getRefundedQuantityByOrder(orders.map((o) => o.id), sb)
  return orders.reduce((sum, o) => sum + Math.max(0, (o.quantity ?? 0) - (refundedByOrder[o.id] ?? 0)), 0)
}

/** Rolling bottles for the current tier cycle, floor-divided into cases (12
 * bottles each). */
export async function getRollingCases(customerId: string, sb: SB): Promise<number> {
  const bottles = await getRollingBottles(customerId, sb)
  return Math.floor(bottles / 12)
}

/**
 * A member's position on the ladder under the relative-climb model
 * (tiers-v3-2): their cycle start rung (where this membership year's climb
 * resumes from) plus cases completed since. Every completed case moves them
 * exactly one rung. Single source of truth for both tier-upgrade checks and
 * the portal's ladder view.
 */
export async function getLadderPosition(customerId: string, sb: SB): Promise<number> {
  const { data: customer } = await sb
    .from('customers')
    .select('cycle_start_rung')
    .eq('id', customerId)
    .maybeSingle()

  const cases = await getRollingCases(customerId, sb)
  return (customer?.cycle_start_rung ?? 0) + cases
}

/**
 * Check the customer's current-cycle case count and upgrade their tier if they
 * now qualify for a higher one. Downgrades (soft-demote) are handled separately
 * by the annual tier-review cron.
 *
 * Returns the new tier name if an upgrade occurred, null otherwise.
 * Sends a congratulations SMS for bailey/elvet/palatine upgrades.
 */
export async function checkAndApplyTierUpgrade(customerId: string, sb: SB): Promise<string | null> {
  const { data: customer } = await sb
    .from('customers')
    .select('tier, phone, tier_since')
    .eq('id', customerId)
    .maybeSingle()

  if (!customer) return null

  const position = await getLadderPosition(customerId, sb)
  const qualifyingTier = tierFromRung(position)

  const currentRank = TIER_RANK[customer.tier ?? 'none'] ?? 0
  const qualifyingRank = TIER_RANK[qualifyingTier] ?? 0

  // Only upgrade, never downgrade here
  if (qualifyingRank <= currentRank) return null

  const now = new Date()
  const updates: Record<string, unknown> = { tier: qualifyingTier }

  // Only the FIRST-ever tier upgrade establishes the cycle anchor — mid-cycle
  // upgrades (e.g. bailey -> elvet within the same year) don't reset it. The
  // annual tier-review cron's soft-demote step is the only other thing that
  // moves tier_since/tier_review_at.
  if (!customer.tier_since) {
    const reviewAt = new Date(now)
    reviewAt.setFullYear(reviewAt.getFullYear() + 1)
    updates.tier_since = now.toISOString()
    updates.tier_review_at = reviewAt.toISOString()
  }

  await sb.from('customers').update(updates).eq('id', customerId)

  // Draft copy — Julia will polish wording.
  if (customer.phone) {
    const messages: Record<string, string> = {
      bailey: `Welcome to Bailey tier! You'll now earn 5% back in credit on every order, and delivery drops to £7 under a full case.`,
      elvet: `You're up to Elvet tier - your rebate climbs to 7% and delivery drops to £5.`,
      palatine: `You've reached Palatine, our top tier! 10% back in credit, wine texts 2 hours before everyone else, and free shipping on any amount, any time - no more delivery fees, ever. One more case and your Coravin's on its way.`,
    }
    const message = messages[qualifyingTier]
    if (message) {
      await sendSms(customer.phone, sanitiseGsm7(message), { trigger: 'tier-upgrade', customerId }).catch(
        (e: unknown) => console.error('[tiers] upgrade SMS failed:', e)
      )
    }
  }

  return qualifyingTier
}

/**
 * Tier rebate percentage, applied to full order value on every confirmed order.
 * Rates per the tiers-v3.1 ladder. Gated behind CREDIT_REBATE_ENABLED at the
 * call site — see lib/post-charge.ts.
 */
export function rebatePctForTier(tier: string): number {
  if (tier === 'palatine') return 0.10
  if (tier === 'elvet') return 0.07
  if (tier === 'bailey') return 0.05
  return 0
}

/**
 * Delivery fee for shipments under the free-shipping threshold, per the
 * tiers-v3.1 ladder: £10 / £7 / £5 / £0 for none / bailey / elvet / palatine.
 * Palatine never pays for delivery, at any bottle count.
 */
export function deliveryFeePence(tier: string): number {
  if (tier === 'palatine') return 0
  if (tier === 'elvet') return 500
  if (tier === 'bailey') return 700
  return 1000
}

/**
 * Perk rows per tier, keyed by tier slug — single source of truth for the
 * /club page's tier-detail blocks and the portal ladder's expandable tier
 * rungs. Keep in sync with rebatePctForTier/deliveryFeePence above (these
 * are the same numbers, spelled out for display).
 */
export const TIER_PERKS: Record<'bailey' | 'elvet' | 'palatine', { label: string; value: string }[]> = {
  bailey: [
    { label: 'Credit back', value: '5% of every order' },
    { label: 'Delivery (under a case)', value: '£7' },
    { label: 'Wine texts', value: '2 / week' },
    { label: 'Concierge requests', value: '2 / month' },
  ],
  elvet: [
    { label: 'Credit back', value: '7% of every order' },
    { label: 'Delivery (under a case)', value: '£5' },
    { label: 'Wine texts', value: '2 / week' },
    { label: 'Concierge requests', value: '5 / month' },
  ],
  palatine: [
    { label: 'Credit back', value: '10% of every order' },
    { label: 'Delivery (under a case)', value: 'free, any amount, anytime' },
    { label: 'Wine texts', value: '2 / week, 2 hrs early' },
    { label: 'Concierge requests', value: 'unlimited' },
  ],
}

/**
 * The number of bottles a customer needs to trigger free shipping.
 * - Any customer with a one-shot free_shipping_at_6 grant gets 6.
 * - Everyone else gets 12 — including Palatine (tiers-v3.1: a case is a case;
 *   Palatine's perk is zero-fee delivery at any amount, not an early
 *   auto-complete — see deliveryFeePence).
 */
export function deliveryThreshold(tier: string, freeShippingAt6 = false): number {
  if (freeShippingAt6) return 6
  return 12
}
