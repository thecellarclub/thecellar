import { createServiceClient } from '@/lib/supabase'

type SB = ReturnType<typeof createServiceClient>

export interface CaseDaysInfo {
  bottles: number
  daysFilling: number
}

/**
 * Per-customer unshipped bottle count and days since the oldest unshipped
 * bottle was added — i.e. how long their current case has been filling.
 * Computed directly from `cellar` rows (not `case_started_at`) so it matches
 * exactly what admins see in the Cellar column next to it.
 */
export async function getCaseDaysByCustomer(sb: SB): Promise<Map<string, CaseDaysInfo>> {
  const { data: rows } = await sb
    .from('cellar')
    .select('customer_id, quantity, added_at')
    .is('shipment_id', null)

  const accum = new Map<string, { bottles: number; oldestAddedAt: string }>()
  for (const row of rows ?? []) {
    const existing = accum.get(row.customer_id)
    if (existing) {
      existing.bottles += row.quantity
      if (row.added_at < existing.oldestAddedAt) existing.oldestAddedAt = row.added_at
    } else {
      accum.set(row.customer_id, { bottles: row.quantity, oldestAddedAt: row.added_at })
    }
  }

  const now = Date.now()
  const result = new Map<string, CaseDaysInfo>()
  for (const [customerId, { bottles, oldestAddedAt }] of accum) {
    const daysFilling = Math.floor((now - new Date(oldestAddedAt).getTime()) / (1000 * 60 * 60 * 24))
    result.set(customerId, { bottles, daysFilling })
  }
  return result
}
