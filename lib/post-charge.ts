import { createServiceClient } from '@/lib/supabase'
import { sendSms } from '@/lib/twilio'
import { checkAndApplyTierUpgrade, deliveryThreshold, rebatePctForTier, deliveryFeePence, getRefundedQuantityByOrder } from '@/lib/tiers'
import { redeemCreditForOrder, accrueRebate, getBalance } from '@/lib/credit'
import { awardMilestones } from '@/lib/milestones'

interface PostChargeParams {
  orderId: string
  customerId: string
  wineId: string
  wineName: string
  quantityJustBought: number
  customerPhone: string
  sb: ReturnType<typeof createServiceClient>
  /** Optional line prepended to the outgoing SMS (e.g. a credit-fallback note). */
  preNote?: string
}

/**
 * Called after a Stripe charge succeeds (from the YES handler in the Twilio
 * inbound webhook, the Stripe webhook, and /api/authenticate/confirm).
 *
 * Inserts one cellar row for the just-purchased bottles, then dispatches to
 * one of three scenarios based on the customer's total unshipped cellar count:
 *
 *   Scenario 1 (< 12): Start or maintain case timer, send cellar-update SMS (no deadline)
 *   Scenario 2 (= 12): Send wine list + free shipping notification, reset timer
 *   Scenario 3 (> 12): Split oldest 12, auto-create pending shipment, start new timer
 */
export async function handlePostCharge({
  orderId,
  customerId,
  wineId,
  wineName,
  quantityJustBought,
  customerPhone,
  sb,
  preNote,
}: PostChargeParams): Promise<void> {
  // 0. Redeem any credit quoted against this order (idempotent per order — safe
  // to run on every call, including 3DS/webhook re-deliveries of the same order).
  const { data: orderForCredit } = await sb
    .from('orders')
    .select('total_pence, credit_used_pence')
    .eq('id', orderId)
    .maybeSingle()

  if (orderForCredit && orderForCredit.credit_used_pence > 0) {
    await redeemCreditForOrder(sb, {
      customerId,
      orderId,
      intendedPence: orderForCredit.credit_used_pence,
    }).catch((e) => console.error('[post-charge] credit redemption failed:', e))
  }

  // 1. Insert cellar row for the just-purchased bottles
  await sb.from('cellar').insert({
    customer_id: customerId,
    wine_id: wineId,
    order_id: orderId,
    quantity: quantityJustBought,
    added_at: new Date().toISOString(),
  })

  // 1b. Fetch customer tier and check for upgrade (non-blocking)
  const { data: customerData } = await sb
    .from('customers')
    .select('tier, free_shipping_at_6')
    .eq('id', customerId)
    .maybeSingle()

  const currentTier = customerData?.tier ?? 'none'
  const freeShippingAt6 = customerData?.free_shipping_at_6 ?? false
  const upgradedTier = await checkAndApplyTierUpgrade(customerId, sb).catch((e) => {
    console.error('[post-charge] tier upgrade check failed:', e)
    return null
  })

  const threshold = deliveryThreshold(currentTier, freeShippingAt6)

  // 1c. Tier rebate accrual — gated behind CREDIT_REBATE_ENABLED. Off by default:
  // customers' stored `tier` values still reflect the old spend-based model
  // until migration 044's recompute has run — flipping this on before then
  // would pay rebates at rates keyed to tiers customers haven't actually
  // earned under the v3 case ladder. See claude-code-prompt-credit-wallet.md
  // §4a. Rate is the tier held coming INTO the order (currentTier, fetched
  // above before the upgrade check) — an order that triggers an upgrade earns
  // at the old rate, not the new one.
  if (process.env.CREDIT_REBATE_ENABLED && orderForCredit) {
    const rebatePence = Math.round(orderForCredit.total_pence * rebatePctForTier(currentTier))
    if (rebatePence > 0) {
      await accrueRebate(sb, { customerId, amountPence: rebatePence, orderId }).catch((e) =>
        console.error('[post-charge] rebate accrual failed:', e)
      )
    }
  }

  const creditBalancePence = await getBalance(sb, customerId).catch(() => 0)
  const creditBalanceLine = creditBalancePence > 0
    ? `\n\nCredit balance: £${(creditBalancePence / 100).toFixed(2)}`
    : ''
  const notePrefix = preNote ? `${preNote}\n\n` : ''

  // 2. Fetch all unreserved cellar rows for this customer, oldest first.
  // Filter by shipment_id IS NULL (not shipped_at) so that bottles already
  // reserved in a pending shipment are excluded from the case-complete count.
  const { data: allRows } = await sb
    .from('cellar')
    .select('id, wine_id, quantity, added_at')
    .eq('customer_id', customerId)
    .is('shipment_id', null)
    .order('added_at', { ascending: true })

  const rows = allRows ?? []
  const totalBottles = rows.reduce((sum, r) => sum + r.quantity, 0)

  if (totalBottles < threshold) {
    // ── Scenario 1: fewer than threshold bottles ──────────────────────────────
    // Start the case timer if not already running
    const { data: customer } = await sb
      .from('customers')
      .select('case_started_at')
      .eq('id', customerId)
      .maybeSingle()

    if (!customer?.case_started_at) {
      await sb
        .from('customers')
        .update({ case_started_at: new Date().toISOString() })
        .eq('id', customerId)
    }

    // "First order" is a count of real (not fully-refunded) confirmed orders,
    // never a tier proxy — tier stays 'none' until 2 lifetime cases, so nearly
    // every order would otherwise get this prefix.
    const { data: confirmedOrders } = await sb
      .from('orders')
      .select('id, quantity')
      .eq('customer_id', customerId)
      .eq('order_status', 'confirmed')

    const orders = confirmedOrders ?? []
    const refundedByOrder = await getRefundedQuantityByOrder(orders.map((o) => o.id), sb)
    const realOrderCount = orders.filter((o) => (o.quantity ?? 0) - (refundedByOrder[o.id] ?? 0) > 0).length
    const isFirstOrder = realOrderCount === 1

    const prefix = isFirstOrder ? 'Congratulations on your first order! ' : ''
    const shipFeeStr = `£${(deliveryFeePence(currentTier) / 100).toFixed(0)}`
    await sendSms(
      customerPhone,
      `${notePrefix}${prefix}Your cellar now holds ${totalBottles} bottle${totalBottles !== 1 ? 's' : ''}. Complete your case of ${threshold} for free shipping - or reply SHIP any time to send what you have for ${shipFeeStr}.${creditBalanceLine}`,
      { trigger: 'post-charge:cellar-update', customerId }
    )
  } else if (totalBottles === threshold) {
    // ── Scenario 2: exactly threshold bottles — case complete ─────────────────

    // Build wine list
    const wineCounts: Record<string, number> = {}
    for (const row of rows) {
      wineCounts[row.wine_id] = (wineCounts[row.wine_id] ?? 0) + row.quantity
    }
    const wineIds = Object.keys(wineCounts)
    const { data: wines } = await sb.from('wines').select('id, name').in('id', wineIds)
    const wineMap: Record<string, string> = {}
    for (const w of wines ?? []) { wineMap[w.id] = w.name }
    const wineLines = wineIds
      .map((id) => `${wineCounts[id]}x ${wineMap[id] ?? 'wine'}`)
      .join('\n')

    // Reset case timer (and consume the one-shot free-at-6 grant if it was used)
    await sb.from('customers').update({
      case_started_at: null,
      case_reminder_sent_at: null,
      ...(freeShippingAt6 ? { free_shipping_at_6: false } : {}),
    }).eq('id', customerId)

    if (freeShippingAt6) {
      await sb.from('inbox_activity').insert({
        customer_id: customerId,
        actor_id: null,
        action: 'free_shipping_at_6_cleared',
        detail: 'auto-cleared on shipment creation',
      })
    }

    // Check for saved address
    const { data: cust } = await sb
      .from('customers')
      .select('default_address')
      .eq('id', customerId)
      .maybeSingle()

    const addr = cust?.default_address as Record<string, string> | null

    // Create shipment and capture the ID so we can link cellar rows
    const shipToken = crypto.randomUUID()
    const { data: newShipment } = await sb
      .from('shipments')
      .insert({
        customer_id: customerId,
        status: 'pending',
        token: shipToken,
        bottle_count: threshold,
        shipping_fee_pence: 0,
      })
      .select('id')
      .single()

    // Link all unshipped cellar rows to this shipment
    if (newShipment) {
      await sb
        .from('cellar')
        .update({ shipment_id: newShipment.id })
        .in('id', rows.map((r) => r.id))
    }

    if (addr?.line1) {
      const addrLine = [addr.line1, addr.city, addr.postcode].filter(Boolean).join(', ')
      await sendSms(
        customerPhone,
        `${notePrefix}Your case is complete!\n\n${wineLines}\n\nShipping to: ${addrLine}\n\nReply YES to confirm or CHANGE to update your address.${creditBalanceLine}`,
        { trigger: 'post-charge:case-complete', customerId }
      )
    } else {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
      await sendSms(
        customerPhone,
        `${notePrefix}Your case is complete!\n\n${wineLines}\n\nConfirm your delivery address here: ${appUrl}/ship?token=${shipToken}${creditBalanceLine}`,
        { trigger: 'post-charge:case-complete', customerId }
      )
    }
  } else {
    // ── Scenario 3: more than 12 bottles ─────────────────────────────────────
    // Walk oldest rows first, accumulate until we have exactly 12 to ship
    const toShipIds: string[] = []
    let accumulated = 0

    for (const row of rows) {
      if (accumulated >= threshold) break
      const needed = threshold - accumulated

      if (row.quantity <= needed) {
        toShipIds.push(row.id)
        accumulated += row.quantity
      } else {
        // Split this row: ship 'needed' bottles, keep the rest
        const splitQty = needed
        const remainderQty = row.quantity - splitQty

        await sb
          .from('cellar')
          .update({ quantity: splitQty })
          .eq('id', row.id)

        await sb.from('cellar').insert({
          customer_id: customerId,
          wine_id: row.wine_id,
          quantity: remainderQty,
          added_at: new Date().toISOString(),
        })

        toShipIds.push(row.id)
        accumulated += splitQty
      }
    }

    // Create a pending shipment
    const shipToken = crypto.randomUUID()
    const { data: newShipment } = await sb
      .from('shipments')
      .insert({
        customer_id: customerId,
        status: 'pending',
        token: shipToken,
        bottle_count: threshold,
        shipping_fee_pence: 0,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (newShipment) {
      // Pre-link the 12 rows and mark them as shipped (removes from cellar count)
      await sb
        .from('cellar')
        .update({
          shipment_id: newShipment.id,
          shipped_at: new Date().toISOString(),
        })
        .in('id', toShipIds)
    }

    // Start a fresh case timer for the remaining bottles (and consume the
    // one-shot free-at-6 grant if it was used)
    const now = new Date()
    await sb
      .from('customers')
      .update({
        case_started_at: now.toISOString(),
        case_reminder_sent_at: null,
        ...(freeShippingAt6 ? { free_shipping_at_6: false } : {}),
      })
      .eq('id', customerId)

    if (freeShippingAt6) {
      await sb.from('inbox_activity').insert({
        customer_id: customerId,
        actor_id: null,
        action: 'free_shipping_at_6_cleared',
        detail: 'auto-cleared on shipment creation',
      })
    }

    const remainingBottles = totalBottles - threshold

    // The case size just fulfilled (`threshold`) can be 6 from a one-shot
    // free-at-6 grant, which is now consumed above — the NEXT case always
    // goes back to 12 unless the customer is Palatine (permanent 6) or has
    // been granted a fresh one-shot since. Never reuse `threshold` here.
    const nextCaseThreshold = deliveryThreshold(upgradedTier ?? currentTier, false)

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
    await sendSms(
      customerPhone,
      `${notePrefix}Your case of ${threshold} is ready! Confirm your address here: ${appUrl}/ship?token=${shipToken}\n\nYou have ${remainingBottles} bottle${remainingBottles !== 1 ? 's' : ''} left in your cellar. Complete your next case of ${nextCaseThreshold} for free shipping.${creditBalanceLine}`,
      { trigger: 'post-charge:case-ready', customerId }
    )
  }

  // Lifetime milestone detection (cases 1/3/5/6) — runs after the scenario SMS
  // above so a milestone congratulations text never arrives before the order
  // confirmation it's congratulating them alongside. Fire-and-forget, never
  // blocks order confirmation. Suppress milestone 6's own SMS when this call
  // also just upgraded the customer to Palatine — they get one combined text
  // instead (see the palatine congrats copy in lib/tiers.ts).
  await awardMilestones(customerId, sb, {
    skipSmsForMilestone: upgradedTier === 'palatine' ? 6 : undefined,
  })
}
