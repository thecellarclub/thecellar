import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'
import Stripe from 'stripe'
import { twilioClient } from '@/lib/twilio'
import { createServiceClient } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'
import { notifyAdmin } from '@/lib/resend'
import { handlePostCharge } from '@/lib/post-charge'
import { getRollingSpend, tierFromSpend, deliveryThreshold } from '@/lib/tiers'
import { normaliseUKPhone } from '@/lib/phone'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Customer {
  id: string
  phone: string
  first_name: string | null
  stripe_customer_id: string
  stripe_payment_method_id: string
  active: boolean
  texts_snoozed_until: string | null
  tier: string
}

interface Wine {
  id: string
  name: string
  price_pence: number
  stock_bottles: number
}

interface TextBlast {
  id: string
  wine_id: string
  wines: Wine
}

interface CellarRow {
  quantity: number
  wines: {
    name: string
    price_pence: number
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? ''
const MAX_BOTTLES = parseInt(process.env.MAX_BOTTLES_PER_ORDER ?? '12', 10)

/** Send an SMS reply via Twilio REST API (never TwiML <Message>) */
async function sendSms(to: string, body: string): Promise<void> {
  await twilioClient.messages.create({
    to,
    from: process.env.TWILIO_PHONE_NUMBER!,
    body,
  })
}

/** Always returned from the route — Twilio expects valid TwiML */
function twimlOk(): NextResponse {
  return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response/>', {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  })
}

/** Format a cellar wine list as "- 2x Wine Name (£X/bottle)" lines */
function formatWineList(rows: CellarRow[]): string {
  // Aggregate by wine name
  const map = new Map<string, { quantity: number; price_pence: number }>()
  for (const row of rows) {
    const key = row.wines.name
    const existing = map.get(key)
    if (existing) {
      existing.quantity += row.quantity
    } else {
      map.set(key, { quantity: row.quantity, price_pence: row.wines.price_pence })
    }
  }
  return Array.from(map.entries())
    .map(([name, { quantity, price_pence }]) => {
      const pounds = (price_pence / 100).toFixed(0)
      return `- ${quantity}x ${name} (£${pounds}/bottle)`
    })
    .join('\n')
}

// ─── CELLAR flow ──────────────────────────────────────────────────────────────

async function handleCellar(
  from: string,
  customer: Customer,
  sb: ReturnType<typeof createServiceClient>
): Promise<NextResponse> {
  const { data: rows } = await sb
    .from('cellar')
    .select('quantity, wines(name, price_pence)')
    .eq('customer_id', customer.id)
    .is('shipped_at', null) as { data: CellarRow[] | null }

  if (!rows || rows.length === 0) {
    await sendSms(from, `Your cellar's empty right now — keep an eye out for our next drop.`)
    return twimlOk()
  }

  const wineList = formatWineList(rows)
  const total = rows.reduce((sum, r) => sum + r.quantity, 0)
  await sendSms(from, `Your cellar:\n${wineList}\n${total} bottle${total === 1 ? '' : 's'} total.`)
  return twimlOk()
}

// ─── SHIP flow ────────────────────────────────────────────────────────────────

async function handleShip(
  from: string,
  customer: Customer,
  sb: ReturnType<typeof createServiceClient>
): Promise<NextResponse> {
  // Check cellar total
  const { data: totals } = await sb
    .from('customer_cellar_totals')
    .select('total_bottles')
    .eq('customer_id', customer.id)
    .maybeSingle()

  const total = Number(totals?.total_bottles ?? 0)

  if (total < 12) {
    await sendSms(
      from,
      `You've got ${total} bottle${total === 1 ? '' : 's'}. Shipping now costs £15. Reply SHIP CONFIRM to go ahead, or keep collecting for free at 12.`
    )
    return twimlOk()
  }

  // Check for existing pending shipment — resend link rather than duplicate
  const { data: existing } = await sb
    .from('shipments')
    .select('token')
    .eq('customer_id', customer.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing?.token) {
    await sendSms(
      from,
      `Brilliant! Confirm your delivery address at ${APP_URL}/ship?token=${existing.token}`
    )
    return twimlOk()
  }

  // Ship in full cases of 12 only — leave any remainder in the cellar
  const bottlesToShip = Math.floor(total / 12) * 12

  // Fetch unshipped, unlinked rows oldest-first to determine which get shipped
  const { data: cellarRows } = await sb
    .from('cellar')
    .select('id, quantity, wine_id')
    .eq('customer_id', customer.id)
    .is('shipped_at', null)
    .is('shipment_id', null)
    .order('created_at', { ascending: true })

  const selectedIds: string[] = []
  let remaining = bottlesToShip

  for (const row of (cellarRows ?? [])) {
    if (remaining <= 0) break

    if (row.quantity <= remaining) {
      // Entire row ships
      selectedIds.push(row.id)
      remaining -= row.quantity
    } else {
      // Row straddles the boundary — ship `remaining` bottles, leave the rest
      await sb.from('cellar').update({ quantity: remaining }).eq('id', row.id)
      selectedIds.push(row.id)
      // Insert the leftover bottles as a new unshipped row
      await sb.from('cellar').insert({
        customer_id: customer.id,
        wine_id: row.wine_id,
        quantity: row.quantity - remaining,
      })
      remaining = 0
    }
  }

  // Create new pending shipment with a token
  const token = crypto.randomUUID()
  const { data: newShipment, error } = await sb.from('shipments').insert({
    customer_id: customer.id,
    bottle_count: bottlesToShip,
    status: 'pending',
    token,
    shipping_fee_pence: 0,
  }).select('id').single()

  if (error || !newShipment) {
    console.error('[twilio/inbound] shipment insert error', error)
    await sendSms(from, `Something went wrong. Please try again.`)
    return twimlOk()
  }

  // Pre-link only the selected rows
  if (selectedIds.length > 0) {
    await sb
      .from('cellar')
      .update({ shipment_id: newShipment.id })
      .in('id', selectedIds)
  }

  await sendSms(
    from,
    `Brilliant! Confirm your delivery address at ${APP_URL}/ship?token=${token}`
  )
  return twimlOk()
}

// ─── SHIP CONFIRM flow (paid shipping for <12 bottles) ───────────────────────

async function handleShipConfirm(
  from: string,
  customer: Customer,
  sb: ReturnType<typeof createServiceClient>
): Promise<NextResponse> {
  const { data: totals } = await sb
    .from('customer_cellar_totals')
    .select('total_bottles')
    .eq('customer_id', customer.id)
    .maybeSingle()

  const total = Number(totals?.total_bottles ?? 0)

  // If they've hit 12+, redirect to free ship flow
  if (total >= 12) {
    return handleShip(from, customer, sb)
  }

  if (total === 0) {
    await sendSms(from, `Your cellar's empty — nothing to ship yet!`)
    return twimlOk()
  }

  // Check for existing pending shipment — resend link rather than duplicate
  const { data: existing } = await sb
    .from('shipments')
    .select('token')
    .eq('customer_id', customer.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing?.token) {
    await sendSms(
      from,
      `Brilliant! Confirm your delivery address at ${APP_URL}/ship?token=${existing.token}`
    )
    return twimlOk()
  }

  const SHIPPING_FEE_PENCE = 1500

  // ── Charge £15 shipping via Stripe ───────────────────────────────────────
  let paymentIntent: Stripe.PaymentIntent

  try {
    paymentIntent = await stripe.paymentIntents.create({
      amount: SHIPPING_FEE_PENCE,
      currency: 'gbp',
      customer: customer.stripe_customer_id,
      payment_method: customer.stripe_payment_method_id,
      off_session: true,
      confirm: true,
    })
  } catch (err: unknown) {
    if (err instanceof Stripe.errors.StripeCardError) {
      const pi = err.payment_intent

      if (err.code === 'authentication_required') {
        const token = crypto.randomUUID()
        await sb.from('shipments').insert({
          customer_id: customer.id,
          bottle_count: total,
          status: 'pending',
          token,
          shipping_fee_pence: SHIPPING_FEE_PENCE,
          stripe_payment_intent_id: pi?.id ?? null,
          stripe_charge_status: 'requires_action',
        })
        await sendSms(
          from,
          `We need you to verify your payment. Visit ${APP_URL}/authenticate?token=${token} to complete your shipment.`
        )
        return twimlOk()
      }

      const billingToken = crypto.randomUUID()
      await sb.from('customers').update({
        billing_token: billingToken,
        billing_token_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      }).eq('id', customer.id)
      await sendSms(
        from,
        `Your payment didn't go through. Update your card at ${APP_URL}/billing?token=${billingToken} and try again.`
      )
      return twimlOk()
    }

    console.error('[twilio/inbound] Stripe error (ship confirm)', err)
    await sendSms(from, `Something went wrong processing your payment. Please try again.`)
    return twimlOk()
  }

  if (
    paymentIntent.status === 'succeeded' ||
    paymentIntent.status === 'requires_action'
  ) {
    if (paymentIntent.status === 'requires_action') {
      const token = crypto.randomUUID()
      await sb.from('shipments').insert({
        customer_id: customer.id,
        bottle_count: total,
        status: 'pending',
        token,
        shipping_fee_pence: SHIPPING_FEE_PENCE,
        stripe_payment_intent_id: paymentIntent.id,
        stripe_charge_status: 'requires_action',
      })
      await sendSms(
        from,
        `We need you to verify your payment. Visit ${APP_URL}/authenticate?token=${token} to complete your shipment.`
      )
      return twimlOk()
    }

    // Payment succeeded — create shipment
    const token = crypto.randomUUID()
    const { error } = await sb.from('shipments').insert({
      customer_id: customer.id,
      bottle_count: total,
      status: 'pending',
      token,
      shipping_fee_pence: SHIPPING_FEE_PENCE,
      stripe_payment_intent_id: paymentIntent.id,
      stripe_charge_status: 'succeeded',
    })

    if (error) {
      console.error('[twilio/inbound] shipment insert error (ship confirm)', error)
      await sendSms(from, `Something went wrong. Your payment was taken — please contact us.`)
      return twimlOk()
    }

    await sendSms(
      from,
      `Payment taken — confirm your delivery address at ${APP_URL}/ship?token=${token}`
    )
    return twimlOk()
  }

  console.error('[twilio/inbound] unexpected PaymentIntent status (ship confirm)', paymentIntent.status)
  const billingToken = crypto.randomUUID()
  await sb.from('customers').update({
    billing_token: billingToken,
    billing_token_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  }).eq('id', customer.id)
  await sendSms(from, `Your payment didn't go through. Update your card at ${APP_URL}/billing?token=${billingToken} and try again.`)
  return twimlOk()
}

// ─── PAUSE flow ───────────────────────────────────────────────────────────────

async function handlePause(
  from: string,
  customer: Customer,
  sb: ReturnType<typeof createServiceClient>
): Promise<NextResponse> {
  const { data: shipment } = await sb
    .from('shipments')
    .select('id')
    .eq('customer_id', customer.id)
    .in('status', ['pending', 'confirmed'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!shipment) {
    await sendSms(from, `Nothing to pause right now.`)
    return twimlOk()
  }

  await sb
    .from('shipments')
    .update({ status: 'paused' })
    .eq('id', shipment.id)

  await sendSms(from, `Your shipment's on hold. Text SHIP when you're ready.`)
  return twimlOk()
}

// ─── STATUS flow ──────────────────────────────────────────────────────────────

async function handleStatus(
  from: string,
  customer: Customer,
  sb: ReturnType<typeof createServiceClient>
): Promise<NextResponse> {
  const spend = await getRollingSpend(customer.id, sb)
  const tier = customer.tier && customer.tier !== 'none' ? customer.tier : tierFromSpend(spend)
  const threshold = deliveryThreshold(tier)

  const tierNames: Record<string, string> = {
    bailey: 'Bailey',
    elvet: 'Elvet',
    palatine: 'Palatine',
  }

  const tierName = tierNames[tier] ?? 'Bailey'
  const spendFormatted = `£${(spend / 100).toFixed(2)}`

  // Fetch unshipped bottle count
  const { count: bottleCount } = await sb
    .from('cellar')
    .select('*', { count: 'exact', head: true })
    .eq('customer_id', customer.id)
    .is('shipped_at', null)

  const bottles = bottleCount ?? 0

  let progressLine = ''
  if (tier === 'bailey') {
    const needed = Math.max(0, 50100 - spend)
    progressLine = `\nElvet tier: £${(needed / 100).toFixed(2)} more spend needed.`
  } else if (tier === 'elvet') {
    const needed = Math.max(0, 100000 - spend)
    progressLine = `\nPalatine tier: £${(needed / 100).toFixed(2)} more spend needed.`
  } else {
    progressLine = `\nYou're on our top tier.`
  }

  await sendSms(
    from,
    `${tierName} member · ${spendFormatted} spent this year\n${bottles} bottle${bottles !== 1 ? 's' : ''} in your cellar (free shipping at ${threshold}).${progressLine}`
  )
  return twimlOk()
}

// ─── ACCOUNT flow ─────────────────────────────────────────────────────────────

async function handleAccount(
  from: string,
  customer: Customer
): Promise<NextResponse> {
  const portalUrl = `${APP_URL}/portal`
  await sendSms(
    from,
    `Manage your account (card, address, preferences) at ${portalUrl}\n\nReply STATUS for a quick summary.`
  )
  return twimlOk()
}

// ─── PENDING ORDER flow (integer reply) ──────────────────────────────────────

async function handlePendingOrder(
  from: string,
  customer: Customer,
  qty: number,
  sb: ReturnType<typeof createServiceClient>
): Promise<NextResponse> {
  // Look up the single explicitly-flagged active offer
  const { data: latestText } = await sb
    .from('texts')
    .select('id, wine_id, wines(*)')
    .eq('is_active', true)
    .maybeSingle() as { data: TextBlast | null }

  if (!latestText) {
    await sendSms(from, `There's no active offer right now. We'll text you when the next wine is ready.`)
    return twimlOk()
  }

  const wine = latestText.wines
  const textId = latestText.id

  // Check for existing pending order for this customer + text
  const { data: pendingOrder } = await sb
    .from('orders')
    .select('id, quantity, confirmation_expires_at')
    .eq('customer_id', customer.id)
    .eq('text_id', textId)
    .eq('order_status', 'awaiting_confirmation')
    .maybeSingle()

  if (pendingOrder) {
    const totalPence = pendingOrder.quantity * wine.price_pence
    await sendSms(
      from,
      `You already have a pending order for ${pendingOrder.quantity} bottle${pendingOrder.quantity !== 1 ? 's' : ''} (£${(totalPence / 100).toFixed(2)}). Reply YES to confirm it.`
    )
    return twimlOk()
  }

  // Check for existing confirmed order
  const { data: confirmedOrder } = await sb
    .from('orders')
    .select('id')
    .eq('customer_id', customer.id)
    .eq('text_id', textId)
    .eq('order_status', 'confirmed')
    .maybeSingle()

  if (confirmedOrder) {
    await sendSms(from, `You've already ordered from this offer! Your bottles are safely in the cellar.`)
    return twimlOk()
  }

  // Stock check
  if (wine.stock_bottles < qty) {
    const n = wine.stock_bottles
    if (n === 0) {
      await sendSms(from, `Sorry, we're out of stock on this one!`)
    } else {
      await sendSms(
        from,
        `Sorry, we only have ${n} bottle${n === 1 ? '' : 's'} left. Reply ${n} to grab them.`
      )
    }
    return twimlOk()
  }

  // Cap per-order quantity
  if (qty > MAX_BOTTLES) {
    await sendSms(
      from,
      `We cap orders at ${MAX_BOTTLES} bottles per text — reply ${MAX_BOTTLES} if you'd like the maximum.`
    )
    return twimlOk()
  }

  const totalPence = qty * wine.price_pence

  // Reserve stock
  await sb
    .from('wines')
    .update({ stock_bottles: wine.stock_bottles - qty })
    .eq('id', wine.id)

  // Create pending order (no Stripe charge yet)
  const confirmationExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

  const { error: orderErr } = await sb.from('orders').insert({
    customer_id: customer.id,
    wine_id: wine.id,
    text_id: textId,
    quantity: qty,
    price_pence: wine.price_pence,
    total_pence: totalPence,
    stripe_payment_intent_id: '',
    stripe_charge_status: 'pending',
    order_status: 'awaiting_confirmation',
    confirmation_expires_at: confirmationExpiresAt,
  })

  if (orderErr) {
    // Roll back stock reservation on insert failure
    await sb
      .from('wines')
      .update({ stock_bottles: wine.stock_bottles })
      .eq('id', wine.id)
    console.error('[twilio/inbound] order insert error', orderErr)
    await sendSms(from, `Something went wrong. Please try again.`)
    return twimlOk()
  }

  await sendSms(
    from,
    `Got it — ${qty} bottle${qty !== 1 ? 's' : ''} of ${wine.name} (£${(totalPence / 100).toFixed(2)}). Reply YES to confirm your order. This offer expires in 10 minutes.`
  )
  return twimlOk()
}

// ─── YES flow ─────────────────────────────────────────────────────────────────

async function handleYes(
  from: string,
  customer: Customer,
  sb: ReturnType<typeof createServiceClient>
): Promise<NextResponse> {
  // Find the most recent pending order for this customer
  const { data: order } = await sb
    .from('orders')
    .select('id, wine_id, quantity, price_pence, total_pence, confirmation_expires_at, auth_token')
    .eq('customer_id', customer.id)
    .eq('order_status', 'awaiting_confirmation')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!order) {
    await sendSms(from, `You don't have a pending order. Reply with a number to place an order.`)
    return twimlOk()
  }

  // Check expiry
  if (new Date() > new Date(order.confirmation_expires_at)) {
    // Release reserved stock
    const { data: wine } = await sb
      .from('wines')
      .select('stock_bottles')
      .eq('id', order.wine_id)
      .maybeSingle()

    await sb
      .from('wines')
      .update({ stock_bottles: (wine?.stock_bottles ?? 0) + order.quantity })
      .eq('id', order.wine_id)

    await sb
      .from('orders')
      .update({ order_status: 'expired' })
      .eq('id', order.id)

    await sendSms(from, `Sorry, your order expired. Reply with a number to place a new one.`)
    return twimlOk()
  }

  // Fetch wine details for the response
  const { data: wine } = await sb
    .from('wines')
    .select('id, name, price_pence, stock_bottles')
    .eq('id', order.wine_id)
    .maybeSingle()

  // Guard: no PM in DB
  if (!customer.stripe_payment_method_id) {
    const billingToken = crypto.randomUUID()
    await sb.from('customers').update({
      billing_token: billingToken,
      billing_token_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    }).eq('id', customer.id)
    await sb.from('orders').update({ order_status: 'cancelled', stripe_charge_status: 'failed' }).eq('id', order.id)
    const { data: wineForPm } = await sb.from('wines').select('stock_bottles').eq('id', order.wine_id).maybeSingle()
    if (wineForPm) await sb.from('wines').update({ stock_bottles: wineForPm.stock_bottles + order.quantity }).eq('id', order.wine_id)
    await sendSms(from, `We don't have a payment card on file. Add one at ${APP_URL}/billing?token=${billingToken} or update your details at ${APP_URL}/portal. Reply YES once done.`)
    return twimlOk()
  }

  // ── Charge via Stripe ────────────────────────────────────────────────────
  let paymentIntent: Stripe.PaymentIntent

  try {
    paymentIntent = await stripe.paymentIntents.create({
      amount: order.total_pence,
      currency: 'gbp',
      customer: customer.stripe_customer_id,
      payment_method: customer.stripe_payment_method_id,
      off_session: true,
      confirm: true,
      metadata: { order_id: order.id, customer_id: customer.id },
    })
  } catch (err: unknown) {
    if (err instanceof Stripe.errors.StripeCardError) {
      const pi = err.payment_intent

      if (err.code === 'authentication_required') {
        // 3DS required — generate auth token and send link
        const authToken = order.auth_token ?? crypto.randomUUID()
        await sb.from('orders').update({
          stripe_payment_intent_id: pi?.id ?? '',
          stripe_charge_status: 'requires_action',
          auth_token: authToken,
        }).eq('id', order.id)

        await sendSms(
          from,
          `We need you to verify your payment. Visit ${APP_URL}/authenticate?token=${authToken} to complete your order.`
        )
        return twimlOk()
      }

      // Card declined
      await sb.from('orders').update({
        stripe_payment_intent_id: pi?.id ?? '',
        stripe_charge_status: 'failed',
        order_status: 'cancelled',
      }).eq('id', order.id)

      // Release reserved stock
      await sb
        .from('wines')
        .update({ stock_bottles: (wine?.stock_bottles ?? 0) + order.quantity })
        .eq('id', order.wine_id)

      const billingToken = crypto.randomUUID()
      await sb.from('customers').update({
        billing_token: billingToken,
        billing_token_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      }).eq('id', customer.id)

      await sendSms(
        from,
        `Your payment didn't go through. Update your card at ${APP_URL}/billing?token=${billingToken} and reply YES again to try.`
      )
      return twimlOk()
    }

    const stripeErr = err as { type?: string; code?: string; message?: string; raw?: unknown }
    console.error('[twilio/inbound] Stripe error (YES)', {
      type: stripeErr?.type,
      code: stripeErr?.code,
      message: stripeErr?.message,
      customerId: customer.stripe_customer_id,
      paymentMethodId: customer.stripe_payment_method_id,
    })

    const isInvalidPM =
      stripeErr?.code === 'payment_method_not_found' ||
      stripeErr?.code === 'resource_missing' ||
      stripeErr?.type === 'invalid_request_error'

    if (isInvalidPM) {
      const billingToken = crypto.randomUUID()
      await sb.from('customers').update({
        billing_token: billingToken,
        billing_token_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        stripe_payment_method_id: null,
      }).eq('id', customer.id)

      await sb.from('orders').update({ order_status: 'cancelled', stripe_charge_status: 'failed' }).eq('id', order.id)
      const { data: wine } = await sb.from('wines').select('stock_bottles').eq('id', order.wine_id).maybeSingle()
      if (wine) await sb.from('wines').update({ stock_bottles: wine.stock_bottles + order.quantity }).eq('id', order.wine_id)

      await sendSms(from, `There's an issue with your saved card. Please update it at ${APP_URL}/billing?token=${billingToken} — you can also add a backup card in your account at ${APP_URL}/portal. Reply YES once updated.`)
      return twimlOk()
    }

    await sendSms(from, `Something went wrong processing your payment. Please reply YES to try again, or visit ${APP_URL}/portal for help.`)
    return twimlOk()
  }

  // ── Payment succeeded ────────────────────────────────────────────────────
  if (paymentIntent.status === 'succeeded') {
    await sb.from('orders').update({
      stripe_payment_intent_id: paymentIntent.id,
      stripe_charge_status: 'succeeded',
      order_status: 'confirmed',
    }).eq('id', order.id)

    await handlePostCharge({
      orderId: order.id,
      customerId: customer.id,
      wineId: order.wine_id,
      wineName: wine?.name ?? 'your wine',
      quantityJustBought: order.quantity,
      customerPhone: from,
      sb,
    })

    return twimlOk()
  }

  // ── requires_action (returned rather than thrown in some SDK versions) ────
  if (paymentIntent.status === 'requires_action') {
    const authToken = order.auth_token ?? crypto.randomUUID()
    await sb.from('orders').update({
      stripe_payment_intent_id: paymentIntent.id,
      stripe_charge_status: 'requires_action',
      auth_token: authToken,
    }).eq('id', order.id)

    await sendSms(
      from,
      `We need you to verify your payment. Visit ${APP_URL}/authenticate?token=${authToken} to complete your order.`
    )
    return twimlOk()
  }

  // ── Unexpected status ────────────────────────────────────────────────────
  console.error('[twilio/inbound] unexpected PaymentIntent status (YES)', paymentIntent.status)

  await sb.from('orders').update({
    stripe_payment_intent_id: paymentIntent.id,
    stripe_charge_status: 'failed',
    order_status: 'cancelled',
  }).eq('id', order.id)

  // Release reserved stock
  await sb
    .from('wines')
    .update({ stock_bottles: (wine?.stock_bottles ?? 0) + order.quantity })
    .eq('id', order.wine_id)

  const billingToken = crypto.randomUUID()
  await sb.from('customers').update({
    billing_token: billingToken,
    billing_token_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  }).eq('id', customer.id)
  await sendSms(from, `Your payment didn't go through. Update your card at ${APP_URL}/billing?token=${billingToken} and try again.`)
  return twimlOk()
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Read raw body — needed for Twilio signature validation
  const bodyText = await req.text()

  // Parse URL-encoded params (Twilio sends application/x-www-form-urlencoded)
  const params: Record<string, string> = {}
  new URLSearchParams(bodyText).forEach((v, k) => {
    params[k] = v
  })

  // Reconstruct the exact URL Twilio signed (works with ngrok in dev)
  const proto = req.headers.get('x-forwarded-proto') ?? 'https'
  const host = req.headers.get('host') ?? ''
  const url = `${proto}://${host}/api/webhooks/twilio/inbound`

  // Validate Twilio signature — reject anything that fails (critical)
  const authToken = process.env.TWILIO_AUTH_TOKEN!
  const signature = req.headers.get('x-twilio-signature') ?? ''
  const isValid = twilio.validateRequest(authToken, signature, url, params)

  if (!isValid) {
    console.error('[twilio/inbound] invalid signature — rejected', { url, signature: signature.slice(0, 20) })
    return new NextResponse('Forbidden', { status: 403 })
  }

  const rawFrom = params['From'] ?? ''
  let from: string
  try {
    from = normaliseUKPhone(rawFrom)
  } catch {
    // Non-UK number — return empty TwiML, don't engage
    return twimlOk()
  }
  // Trim and lowercase for consistent keyword matching
  const body = (params['Body'] ?? '').trim().toLowerCase()

  const sb = createServiceClient()

  try {
    // ── Customer lookup ──────────────────────────────────────────────────
    const { data: customer } = await sb
      .from('customers')
      .select('id, phone, first_name, stripe_customer_id, stripe_payment_method_id, active, texts_snoozed_until, tier')
      .eq('phone', from)
      .maybeSingle() as { data: Customer | null }

    if (!customer) {
      await sendSms(from, `Sorry, we don't recognise this number. Sign up at ${APP_URL}/join`)
      return twimlOk()
    }

    if (!customer.active) {
      await sendSms(from, `You're unsubscribed. Visit ${APP_URL}/join to rejoin.`)
      return twimlOk()
    }

    // ── STOP / UNSUBSCRIBE ───────────────────────────────────────────────
    if (body === 'stop' || body === 'unsubscribe') {
      await sb
        .from('customers')
        .update({ active: false, unsubscribed_at: new Date().toISOString() })
        .eq('id', customer.id)
      await sendSms(from, `You've been unsubscribed. Visit ${APP_URL}/join to rejoin.`)
      return twimlOk()
    }

    // ── CELLAR ───────────────────────────────────────────────────────────
    if (body === 'cellar') {
      return await handleCellar(from, customer, sb)
    }

    // ── SHIP CONFIRM ─────────────────────────────────────────────────────
    if (body === 'ship confirm') {
      return await handleShipConfirm(from, customer, sb)
    }

    // ── SHIP ─────────────────────────────────────────────────────────────
    if (body === 'ship') {
      return await handleShip(from, customer, sb)
    }

    // ── PAUSE ────────────────────────────────────────────────────────────
    if (body === 'pause') {
      return await handlePause(from, customer, sb)
    }

    // ── STATUS ───────────────────────────────────────────────────────────
    if (body === 'status') {
      return await handleStatus(from, customer, sb)
    }

    // ── ACCOUNT ──────────────────────────────────────────────────────────
    if (body === 'account') {
      return await handleAccount(from, customer)
    }

    // ── SNOOZE [n] ───────────────────────────────────────────────────────
    if (body === 'snooze' || body.startsWith('snooze ')) {
      let weeks = 4
      if (body.startsWith('snooze ')) {
        const parsed = parseInt(body.slice(7).trim(), 10)
        if (!isNaN(parsed) && parsed > 0) {
          weeks = parsed
        }
      }
      const until = new Date()
      until.setDate(until.getDate() + weeks * 7)
      await sb
        .from('customers')
        .update({ texts_snoozed_until: until.toISOString() })
        .eq('id', customer.id)
      await sendSms(
        from,
        `No problem — we'll hold your texts for ${weeks} week${weeks === 1 ? '' : 's'}. Text RESUME any time.`
      )
      return twimlOk()
    }

    // ── RESUME ───────────────────────────────────────────────────────────
    if (body === 'resume') {
      await sb
        .from('customers')
        .update({ texts_snoozed_until: null })
        .eq('id', customer.id)
      await sendSms(from, `Welcome back — you'll start getting our drops again soon.`)
      return twimlOk()
    }

    // ── REQUEST ──────────────────────────────────────────────────────────
    if (body === 'request') {
      await sendSms(
        from,
        `What would you like us to feature? Tell us a bit about it — e.g. "REQUEST something from Georgia" or "REQUEST Chateau Musar".`
      )
      return twimlOk()
    }

    if (body.startsWith('request ')) {
      const message = (params['Body'] ?? '').trim().slice(8).trim()
      await sb.from('special_requests').insert({
        customer_id: customer.id,
        message,
        status: 'new',
      })
      const name = customer.first_name ?? customer.phone
      await notifyAdmin(
        `New request from ${name}`,
        `Message: ${message}\nPhone: ${customer.phone}`
      )
      await sendSms(from, `Got it — we'll be in touch.`)
      return twimlOk()
    }

    // ── QUESTION ─────────────────────────────────────────────────────────
    if (body === 'question') {
      await sendSms(
        from,
        `What's on your mind? Ask us anything — e.g. "QUESTION can you help me find a special wine gift?" or "QUESTION how long does shipping take?".`
      )
      return twimlOk()
    }

    if (body.startsWith('question ')) {
      const message = (params['Body'] ?? '').trim().slice(9).trim()
      await sb.from('concierge_messages').insert({
        customer_id: customer.id,
        direction: 'inbound',
        message,
      })
      const name = customer.first_name ?? customer.phone
      await notifyAdmin(
        `New question from ${name}`,
        `Message: ${message}\nPhone: ${customer.phone}`
      )
      await sendSms(from, `On it — we'll get back to you soon.`)
      return twimlOk()
    }

    // ── YES → charge pending order ────────────────────────────────────────
    if (body === 'yes') {
      return await handleYes(from, customer, sb)
    }

    // ── POSITIVE INTEGER → pending order ─────────────────────────────────
    const qty = parseInt(body, 10)
    if (!isNaN(qty) && qty > 0 && /^\d+$/.test(body)) {
      return await handlePendingOrder(from, customer, qty, sb)
    }

    // ── Anything else → menu ─────────────────────────────────────────────
    await sendSms(
      from,
      `Hey! Here's what you can do:\n\nCELLAR — see what's in your cellar\nSHIP — send your bottles (free at 12, £15 before that)\nSTATUS — your tier and cellar progress\nACCOUNT — manage card, address and preferences\nREQUEST — suggest a wine for us to feature\nQUESTION — ask us anything\nSTOP — unsubscribe\n\nJust reply with one of the above.`
    )
    return twimlOk()
  } catch (err) {
    console.error('[twilio/inbound] unexpected error', err)
    // Always return valid TwiML even on error
    return twimlOk()
  }
}
