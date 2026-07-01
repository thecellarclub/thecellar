import { createServiceClient } from '@/lib/supabase'
import { sendSms } from '@/lib/twilio'
import { sanitiseGsm7 } from '@/lib/twilio'

export const BAILEY_THRESHOLD = 100000   // £1,000 in pence
export const PALATINE_THRESHOLD = 250000 // £2,500 in pence

/**
 * Sum all confirmed orders for this customer in the last rolling 12 months.
 * price_pence on orders is for the WHOLE order (quantity * unit price).
 */
export async function getRollingSpend(
  customerId: string,
  sb: ReturnType<typeof createServiceClient>
): Promise<number> {
  const since = new Date()
  since.setFullYear(since.getFullYear() - 1)

  const { data } = await sb
    .from('orders')
    .select('price_pence')
    .eq('customer_id', customerId)
    .eq('order_status', 'confirmed')
    .gte('created_at', since.toISOString())

  return (data ?? []).reduce((sum, o) => sum + (o.price_pence ?? 0), 0)
}

/**
 * Determine tier from rolling annual spend in pence.
 * Returns 'elvet' for any spend (first order and above), 'bailey' at £1k, 'palatine' at £2.5k.
 */
export function tierFromSpend(spendPence: number): 'elvet' | 'bailey' | 'palatine' {
  if (spendPence >= PALATINE_THRESHOLD) return 'palatine'
  if (spendPence >= BAILEY_THRESHOLD) return 'bailey'
  return 'elvet'
}

/**
 * Check the customer's current rolling spend and upgrade their tier if they
 * now qualify for a higher one. Downgrades are handled separately by the cron.
 *
 * Returns the new tier name if an upgrade occurred, null otherwise.
 * Sends a congratulations SMS for bailey/palatine upgrades.
 */
export async function checkAndApplyTierUpgrade(
  customerId: string,
  sb: ReturnType<typeof createServiceClient>
): Promise<string | null> {
  const { data: customer } = await sb
    .from('customers')
    .select('tier, phone')
    .eq('id', customerId)
    .maybeSingle()

  if (!customer) return null

  const spend = await getRollingSpend(customerId, sb)
  const qualifyingTier = tierFromSpend(spend)

  const tierRank: Record<string, number> = { none: 0, elvet: 1, bailey: 2, palatine: 3 }
  const currentRank = tierRank[customer.tier ?? 'none'] ?? 0
  const qualifyingRank = tierRank[qualifyingTier] ?? 1

  // Only upgrade, never downgrade here
  if (qualifyingRank <= currentRank) return null

  const now = new Date()
  const reviewAt = new Date(now)
  reviewAt.setFullYear(reviewAt.getFullYear() + 1)

  await sb
    .from('customers')
    .update({
      tier: qualifyingTier,
      tier_since: now.toISOString(),
      tier_review_at: reviewAt.toISOString(),
    })
    .eq('id', customerId)

  // Send congratulations SMS for bailey/palatine upgrades (not for none→elvet — handled in post-charge)
  if ((qualifyingTier === 'bailey' || qualifyingTier === 'palatine') && customer.phone) {
    const tierDisplayName = qualifyingTier === 'bailey' ? 'Bailey' : 'Palatine'
    const message = sanitiseGsm7(
      `Congratulations on reaching ${tierDisplayName} tier! Daniel will be in touch shortly to explain the benefits you get with it.`
    )
    await sendSms(customer.phone, message, { trigger: 'tier-upgrade', customerId }).catch(
      (e: unknown) => console.error('[tiers] upgrade SMS failed:', e)
    )
  }

  return qualifyingTier
}

/**
 * The number of bottles a customer needs to trigger free shipping.
 * - Palatine members get 6 (existing behaviour).
 * - Any customer with a one-shot free_shipping_at_6 grant gets 6.
 * - Everyone else gets 12.
 */
export function deliveryThreshold(tier: string, freeShippingAt6 = false): number {
  if (tier === 'palatine' || freeShippingAt6) return 6
  return 12
}
