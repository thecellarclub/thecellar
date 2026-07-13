import { createServiceClient } from '@/lib/supabase'
import { notifyAdmin } from '@/lib/resend'

type SB = ReturnType<typeof createServiceClient>

const UNIQUE_VIOLATION = '23505'
const CHECK_VIOLATION = '23514'

async function applyCredit(
  sb: SB,
  params: {
    customerId: string
    deltaPence: number
    reason: 'rebate' | 'redemption' | 'admin_grant'
    note?: string | null
    orderId?: string | null
    createdBy?: string | null
  }
): Promise<number> {
  const { data, error } = await sb.rpc('apply_credit', {
    p_customer_id: params.customerId,
    p_delta_pence: params.deltaPence,
    p_reason: params.reason,
    p_note: params.note ?? null,
    p_order_id: params.orderId ?? null,
    p_created_by: params.createdBy ?? null,
  })

  if (error) {
    const err = new Error(error.message) as Error & { code?: string }
    err.code = error.code
    throw err
  }

  return data as number
}

export async function getBalance(sb: SB, customerId: string): Promise<number> {
  const { data } = await sb
    .from('customers')
    .select('credit_balance_pence')
    .eq('id', customerId)
    .maybeSingle()

  return data?.credit_balance_pence ?? 0
}

/** Admin one-time grant. Caller must have already validated amountPence/reason. */
export async function grantCredit(
  sb: SB,
  params: { customerId: string; amountPence: number; reason: string; adminId: string }
): Promise<number> {
  return applyCredit(sb, {
    customerId: params.customerId,
    deltaPence: params.amountPence,
    reason: 'admin_grant',
    note: params.reason,
    createdBy: params.adminId,
  })
}

/** Tier rebate accrual. Idempotent per order — swallows a duplicate-accrual retry. */
export async function accrueRebate(
  sb: SB,
  params: { customerId: string; amountPence: number; orderId: string }
): Promise<void> {
  if (params.amountPence <= 0) return
  try {
    await applyCredit(sb, {
      customerId: params.customerId,
      deltaPence: params.amountPence,
      reason: 'rebate',
      orderId: params.orderId,
    })
  } catch (err) {
    if ((err as { code?: string }).code === UNIQUE_VIOLATION) return // already accrued
    throw err
  }
}

/**
 * Redeem previously-quoted credit for an order. Idempotent per order — a retry
 * (e.g. webhook re-delivery) that already has a redemption row is a no-op.
 *
 * If the customer's balance shrank between the BALANCE quote and this call
 * (e.g. a second concurrent redemption), deduct whatever remains instead of
 * failing an already-authorised charge, and notify admin of the shortfall.
 */
export async function redeemCreditForOrder(
  sb: SB,
  params: { customerId: string; orderId: string; intendedPence: number }
): Promise<void> {
  const { customerId, orderId, intendedPence } = params
  if (intendedPence <= 0) return

  try {
    await applyCredit(sb, {
      customerId,
      deltaPence: -intendedPence,
      reason: 'redemption',
      orderId,
    })
    return
  } catch (err) {
    const code = (err as { code?: string }).code
    if (code === UNIQUE_VIOLATION) return // already redeemed

    if (code !== CHECK_VIOLATION) throw err

    // Balance shrank since the quote — absorb the shortfall rather than
    // failing an order the customer already authorised.
    const available = await getBalance(sb, customerId)

    if (available <= 0) {
      await sb.from('orders').update({ credit_used_pence: 0 }).eq('id', orderId)
      void notifyAdmin(
        'Credit redemption shortfall',
        `Order ${orderId}: intended to redeem £${(intendedPence / 100).toFixed(2)} but balance was already £0. Order confirmed with no credit applied.`
      )
      return
    }

    try {
      await applyCredit(sb, {
        customerId,
        deltaPence: -available,
        reason: 'redemption',
        orderId,
      })
      await sb.from('orders').update({ credit_used_pence: available }).eq('id', orderId)
      void notifyAdmin(
        'Credit redemption shortfall',
        `Order ${orderId}: intended to redeem £${(intendedPence / 100).toFixed(2)} but only £${(available / 100).toFixed(2)} was available. Order confirmed with the smaller amount deducted.`
      )
    } catch (err2) {
      if ((err2 as { code?: string }).code === UNIQUE_VIOLATION) return
      throw err2
    }
  }
}
