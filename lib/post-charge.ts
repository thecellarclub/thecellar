import { createServiceClient } from '@/lib/supabase'
import { sendSms } from '@/lib/twilio'
import { checkAndApplyTierUpgrade, deliveryThreshold } from '@/lib/tiers'
import { ordinalDate } from '@/lib/format'

interface PostChargeParams {
  orderId: string
  customerId: string
  wineId: string
  wineName: string
  quantityJustBought: number
  customerPhone: string
  sb: ReturnType<typeof createServiceClient>
}

/**
 * Called after a Stripe charge succeeds (from the YES handler in the Twilio
 * inbound webhook, the Stripe webhook, and /api/authenticate/confirm).
 *
 * Inserts one cellar row for the just-purchased bottles, then dispatches to
 * one of three scenarios based on the customer's total unshipped cellar count:
 *
 *   Scenario 1 (< 12): Start or maintain case timer, send deadline SMS
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
}: PostChargeParams): Promise<void> {
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
    .select('tier')
    .eq('id', customerId)
    .maybeSingle()

  const currentTier = customerData?.tier ?? 'none'
  await checkAndApplyTierUpgrade(customerId, sb).catch((e) =>
    console.error('[post-charge] tier upgrade check failed:', e)
  )

  const threshold = deliveryThreshold(currentTier)

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

    let caseStartedAt: Date
    if (customer?.case_started_at) {
      caseStartedAt = new Date(customer.case_started_at)
    } else {
      caseStartedAt = new Date()
      await sb
        .from('customers')
        .update({ case_started_at: caseStartedAt.toISOString() })
        .eq('id', customerId)
    }

    const deadline = new Date(caseStartedAt)
    deadline.setDate(deadline.getDate() + 90)
    const deadlineStr = ordinalDate(deadline)

    const prefix = currentTier === 'none' ? 'Congratulations on your first order! ' : ''
    await sendSms(
      customerPhone,
      `${prefix}Your cellar now holds ${totalBottles} bottle${totalBottles !== 1 ? 's' : ''}. Complete your case of 12 by ${deadlineStr} for free shipping - or reply SHIP any time to send what you have for £10.`,
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

    // Reset case timer
    await sb.from('customers').update({
      case_started_at: null,
      case_nudge_1_sent_at: null,
      case_nudge_2_sent_at: null,
    }).eq('id', customerId)

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
        `Your case is complete!\n\n${wineLines}\n\nShipping to: ${addrLine}\n\nReply YES to confirm or CHANGE to update your address.`,
        { trigger: 'post-charge:case-complete', customerId }
      )
    } else {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
      await sendSms(
        customerPhone,
        `Your case is complete!\n\n${wineLines}\n\nConfirm your delivery address here: ${appUrl}/ship?token=${shipToken}`,
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

    // Start a fresh case timer for the remaining bottles
    const now = new Date()
    await sb
      .from('customers')
      .update({
        case_started_at: now.toISOString(),
        case_nudge_1_sent_at: null,
        case_nudge_2_sent_at: null,
      })
      .eq('id', customerId)

    const remainingBottles = totalBottles - threshold
    const deadline = new Date(now)
    deadline.setDate(deadline.getDate() + 90)
    const deadlineStr = ordinalDate(deadline)

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
    await sendSms(
      customerPhone,
      `Your case of 12 is ready! Confirm your address here: ${appUrl}/ship?token=${shipToken}\n\nYou have ${remainingBottles} bottle${remainingBottles !== 1 ? 's' : ''} left in your cellar. Complete your next case by ${deadlineStr} for free shipping.`,
      { trigger: 'post-charge:case-ready', customerId }
    )
  }
}
