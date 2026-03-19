import { createServiceClient } from '@/lib/supabase'

export const ELVET_THRESHOLD = 50100   // £501 in pence
export const PALATINE_THRESHOLD = 100000 // £1000 in pence

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
 */
export function tierFromSpend(spendPence: number): 'bailey' | 'elvet' | 'palatine' {
  if (spendPence >= PALATINE_THRESHOLD) return 'palatine'
  if (spendPence >= ELVET_THRESHOLD) return 'elvet'
  return 'bailey'
}

/**
 * Check the customer's current rolling spend and upgrade their tier if they
 * now qualify for a higher one. Downgrades are handled separately by the cron.
 *
 * Returns the new tier name if an upgrade occurred, null otherwise.
 */
export async function checkAndApplyTierUpgrade(
  customerId: string,
  sb: ReturnType<typeof createServiceClient>
): Promise<string | null> {
  const { data: customer } = await sb
    .from('customers')
    .select('tier')
    .eq('id', customerId)
    .maybeSingle()

  if (!customer) return null

  const spend = await getRollingSpend(customerId, sb)
  const qualifyingTier = tierFromSpend(spend)

  const tierRank: Record<string, number> = { none: 0, bailey: 1, elvet: 2, palatine: 3 }
  const currentRank = tierRank[customer.tier ?? 'none'] ?? 0
  const qualifyingRank = tierRank[qualifyingTier] ?? 1

  // Only upgrade, never downgrade here
  if (qualifyingRank <= currentRank) return null

  const now = new Date()
  // Set tier_review_at to 1 year from now for the cron downgrade check
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

  return qualifyingTier
}

/**
 * The number of bottles a customer needs to trigger free shipping.
 * Palatine members get a case of 6; everyone else gets 12.
 */
export function deliveryThreshold(tier: string): number {
  return tier === 'palatine' ? 6 : 12
}
