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

/** Tier from case count, per the tiers-v3 ladder (2 / 4 / 6 cases). */
export function tierFromCases(cases: number): 'none' | 'bailey' | 'elvet' | 'palatine' {
  if (cases >= 6) return 'palatine'
  if (cases >= 4) return 'elvet'
  if (cases >= 2) return 'bailey'
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
 * Bottles from confirmed orders within the customer's current tier cycle,
 * net of refunds, floor-divided into cases (12 bottles each). The cycle
 * starts at `tier_since` — set once on a customer's first-ever tier upgrade,
 * then only moved by the annual tier-review cron's soft-demote step (see
 * case-nudges cron) — and falls back to `subscribed_at` for customers who
 * haven't earned a tier yet.
 */
export async function getRollingCases(customerId: string, sb: SB): Promise<number> {
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
  const bottles = orders.reduce((sum, o) => sum + Math.max(0, (o.quantity ?? 0) - (refundedByOrder[o.id] ?? 0)), 0)
  return Math.floor(bottles / 12)
}

/**
 * Lifetime bottles from ALL confirmed orders ever, net of refunds, no window
 * — used for milestone detection (lifetime cases 1/3/5/6), which never resets.
 */
export async function getLifetimeCases(customerId: string, sb: SB): Promise<number> {
  const { data } = await sb
    .from('orders')
    .select('id, quantity')
    .eq('customer_id', customerId)
    .eq('order_status', 'confirmed')

  const orders = data ?? []
  const refundedByOrder = await getRefundedQuantityByOrder(orders.map((o) => o.id), sb)
  const bottles = orders.reduce((sum, o) => sum + Math.max(0, (o.quantity ?? 0) - (refundedByOrder[o.id] ?? 0)), 0)
  return Math.floor(bottles / 12)
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

  const cases = await getRollingCases(customerId, sb)
  const qualifyingTier = tierFromCases(cases)

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
