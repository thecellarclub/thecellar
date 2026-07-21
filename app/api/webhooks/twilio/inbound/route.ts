import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'
import Stripe from 'stripe'
import { sendSms } from '@/lib/twilio'
import { createServiceClient } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'
import { notifyAdmin } from '@/lib/resend'
import { handlePostCharge } from '@/lib/post-charge'
import { getRollingCases, tierFromCases, deliveryThreshold, deliveryFeePence, TIER_NAMES } from '@/lib/tiers'
import { getBalance } from '@/lib/credit'
import { normaliseUKPhone } from '@/lib/phone'
import { generateShortToken } from '@/lib/token'
import { parseOrderReply } from '@/lib/parse-order-reply'
import {
  noCardCardLink,
  cardSavedOrderRecap,
  paymentFailedT0,
} from '@/lib/sms-templates'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Customer {
  id: string
  phone: string
  first_name: string | null
  stripe_customer_id: string
  stripe_payment_method_id: string | null
  status: string
  texts_snoozed_until: string | null
  tier: string
  sms_awaiting: string | null
  concierge_status: string | null
  free_shipping_at_6: boolean
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

interface WineRow {
  name: string
  producer: string | null
  region: string | null
  vintage: number | null
  price_pence: number
  stock_bottles: number
  description: string | null
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

/** Always returned from the route — Twilio expects valid TwiML */
function twimlOk(): NextResponse {
  return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response/>', {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  })
}

/** Fire-and-forget write to sms_parse_log. Never throws. */
async function logInbound(params: {
  sb: ReturnType<typeof createServiceClient>
  phone: string
  raw: string
  customerId?: string | null
  parseKind: string
  parseQuantity?: number | null
  ambiguous?: boolean
  matchedTextId?: string | null
}): Promise<void> {
  try {
    await params.sb.from('sms_parse_log').insert({
      customer_id: params.customerId ?? null,
      inbound_phone: params.phone,
      raw_message: params.raw,
      parse_kind: params.parseKind,
      parse_quantity: params.parseQuantity ?? null,
      ambiguous: params.ambiguous ?? false,
      matched_text_id: params.matchedTextId ?? null,
    })
  } catch (err) {
    console.error('[sms_parse_log] insert failed', err)
  }
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
    await sendSms(from, `Nothing in your cellar yet — I'll text you when the next wine's ready.`, { trigger: 'keyword:cellar', customerId: customer.id })
    return twimlOk()
  }

  const wineList = formatWineList(rows)
  const total = rows.reduce((sum, r) => sum + r.quantity, 0)
  await sendSms(from, `Your cellar:\n${wineList}\n${total} bottle${total === 1 ? '' : 's'} total.`, { trigger: 'keyword:cellar', customerId: customer.id })
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
  const threshold = deliveryThreshold(customer.tier, customer.free_shipping_at_6)

  if (total === 0) {
    await sendSms(from, `Nothing in your cellar yet — I'll text you when the next wine's ready.`, { trigger: 'keyword:ship', customerId: customer.id })
    return twimlOk()
  }

  if (total < threshold) {
    const feePence = deliveryFeePence(customer.tier)
    await sendSms(
      from,
      `You've got ${total} bottle${total === 1 ? '' : 's'} in your cellar. Shipping now costs £${(feePence / 100).toFixed(0)}. Reply SHIP CONFIRM to go ahead, or keep collecting for free at ${threshold}.`,
      { trigger: 'keyword:ship', customerId: customer.id }
    )
    return twimlOk()
  }

  // Check for existing pending shipment — resend link rather than duplicate
  const { data: existing } = await sb
    .from('shipments')
    .select('id, token, bottle_count')
    .eq('customer_id', customer.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing?.token) {
    const { data: addrCust } = await sb.from('customers').select('default_address').eq('id', customer.id).maybeSingle()
    const addr = addrCust?.default_address as Record<string, string> | null
    if (addr?.line1) {
      const addrLine = [addr.line1, addr.line2, addr.city, addr.postcode].filter(Boolean).join(', ')
      await sendSms(from, `You have a shipment ready - ${existing.bottle_count} bottle${existing.bottle_count === 1 ? '' : 's'} to: ${addrLine}\n\nReply YES to confirm or CHANGE to update your address.`, { trigger: 'keyword:ship', customerId: customer.id })
    } else {
      await sendSms(from, `Confirm your delivery address at ${APP_URL}/ship?token=${existing.token}`, { trigger: 'keyword:ship', customerId: customer.id })
    }
    return twimlOk()
  }

  // Ship in full cases of `threshold` only - leave any remainder in the cellar
  const bottlesToShip = Math.floor(total / threshold) * threshold

  // Fetch unshipped, unlinked rows oldest-first to determine which get shipped
  const { data: cellarRows } = await sb
    .from('cellar')
    .select('id, quantity, wine_id')
    .eq('customer_id', customer.id)
    .is('shipped_at', null)
    .is('shipment_id', null)
    .order('added_at', { ascending: true })

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
    await sendSms(from, `Something went wrong. Please try again.`, { trigger: 'keyword:ship', customerId: customer.id })
    return twimlOk()
  }

  // Pre-link only the selected rows
  if (selectedIds.length > 0) {
    await sb
      .from('cellar')
      .update({ shipment_id: newShipment.id })
      .in('id', selectedIds)
  }

  // Consume the one-shot free-at-6 grant, same as post-charge.ts
  if (customer.free_shipping_at_6) {
    await sb.from('customers').update({ free_shipping_at_6: false }).eq('id', customer.id)
    await sb.from('inbox_activity').insert({
      customer_id: customer.id,
      actor_id: null,
      action: 'free_shipping_at_6_cleared',
      detail: 'auto-cleared on shipment creation',
    })
  }

  const { data: addrCust } = await sb.from('customers').select('default_address').eq('id', customer.id).maybeSingle()
  const addr = addrCust?.default_address as Record<string, string> | null
  if (addr?.line1) {
    const addrLine = [addr.line1, addr.line2, addr.city, addr.postcode].filter(Boolean).join(', ')
    await sendSms(from, `Your case is ready to ship - ${bottlesToShip} bottles to: ${addrLine}\n\nReply YES to confirm or CHANGE to update your address.`, { trigger: 'keyword:ship', customerId: customer.id })
  } else {
    await sendSms(from, `Confirm your delivery address at ${APP_URL}/ship?token=${token}`, { trigger: 'keyword:ship', customerId: customer.id })
  }
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
  const threshold = deliveryThreshold(customer.tier, customer.free_shipping_at_6)

  // If they've hit their free-shipping threshold, redirect to free ship flow
  if (total >= threshold) {
    return handleShip(from, customer, sb)
  }

  if (total === 0) {
    await sendSms(from, `Your cellar's empty — nothing to ship yet!`, { trigger: 'keyword:ship-confirm', customerId: customer.id })
    return twimlOk()
  }

  // Check for existing pending shipment — resend link rather than duplicate
  const { data: existing } = await sb
    .from('shipments')
    .select('id, token, bottle_count')
    .eq('customer_id', customer.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing?.token) {
    const { data: addrCust } = await sb.from('customers').select('default_address').eq('id', customer.id).maybeSingle()
    const addr = addrCust?.default_address as Record<string, string> | null
    if (addr?.line1) {
      const addrLine = [addr.line1, addr.line2, addr.city, addr.postcode].filter(Boolean).join(', ')
      await sendSms(from, `You have a shipment ready - ${existing.bottle_count} bottle${existing.bottle_count === 1 ? '' : 's'} to: ${addrLine}\n\nReply YES to confirm or CHANGE to update your address.`, { trigger: 'keyword:ship-confirm', customerId: customer.id })
    } else {
      await sendSms(from, `Confirm your delivery address at ${APP_URL}/ship?token=${existing.token}`, { trigger: 'keyword:ship-confirm', customerId: customer.id })
    }
    return twimlOk()
  }

  const SHIPPING_FEE_PENCE = deliveryFeePence(customer.tier)

  // ── Guard: no payment method saved ──────────────────────────────────────
  if (!customer.stripe_payment_method_id) {
    const billingToken = crypto.randomUUID()
    await sb.from('customers').update({
      billing_token: billingToken,
      billing_token_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    }).eq('id', customer.id)
    await sendSms(
      from,
      `I don't have a card on file. Add one here: ${APP_URL}/billing?token=${billingToken} — then text SHIP CONFIRM again.`,
      { trigger: 'keyword:ship-confirm', customerId: customer.id }
    )
    return twimlOk()
  }

  // ── Fetch unshipped cellar rows to pre-link ──────────────────────────────
  const { data: cellarRowsForEarly } = await sb
    .from('cellar')
    .select('id, quantity, wine_id')
    .eq('customer_id', customer.id)
    .is('shipped_at', null)
    .is('shipment_id', null)
    .order('added_at', { ascending: true })

  const availableBottles = (cellarRowsForEarly ?? []).reduce((sum, r) => sum + r.quantity, 0)

  if (availableBottles === 0) {
    await sendSms(from, `Your cellar's empty — nothing to ship yet!`, { trigger: 'keyword:ship-confirm', customerId: customer.id })
    return twimlOk()
  }

  // Use actual available count (guards against view/row mismatch)
  const bottlesToShipEarly = availableBottles
  const earlySelectedIds = (cellarRowsForEarly ?? []).map(r => r.id)

  // ── Charge £10 shipping via Stripe ───────────────────────────────────────
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
          bottle_count: bottlesToShipEarly,
          status: 'pending',
          token,
          shipping_fee_pence: SHIPPING_FEE_PENCE,
          stripe_payment_intent_id: pi?.id ?? null,
          stripe_charge_status: 'requires_action',
        })
        await sendSms(
          from,
          `Your bank needs a quick check. Tap here to complete: ${APP_URL}/authenticate?token=${token}`,
          { trigger: 'keyword:ship-confirm', customerId: customer.id }
        )
        return twimlOk()
      }

      // Card declined
      const billingToken = crypto.randomUUID()
      await sb.from('customers').update({
        billing_token: billingToken,
        billing_token_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      }).eq('id', customer.id)
      await sendSms(
        from,
        `Card didn't go through. Update it here: ${APP_URL}/billing?token=${billingToken} — then reply SHIP CONFIRM to try again.`,
        { trigger: 'keyword:ship-confirm', customerId: customer.id }
      )
      return twimlOk()
    }

    // Non-card Stripe error — check for invalid/missing payment method
    const stripeErr = err as { type?: string; code?: string; message?: string }
    console.error('[twilio/inbound] Stripe error (ship confirm)', {
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
      await sendSms(
        from,
        `There's an issue with your saved card. Please update it at ${APP_URL}/billing?token=${billingToken} and reply SHIP CONFIRM again.`,
        { trigger: 'keyword:ship-confirm', customerId: customer.id }
      )
      return twimlOk()
    }

    await sendSms(from, `Something went wrong processing your payment. Please reply SHIP CONFIRM to try again.`, { trigger: 'keyword:ship-confirm', customerId: customer.id })
    return twimlOk()
  }

  if (paymentIntent.status === 'requires_action') {
    const token = crypto.randomUUID()
    const { data: newShipmentAuth } = await sb.from('shipments').insert({
      customer_id: customer.id,
      bottle_count: bottlesToShipEarly,
      status: 'pending',
      token,
      shipping_fee_pence: SHIPPING_FEE_PENCE,
      stripe_payment_intent_id: paymentIntent.id,
      stripe_charge_status: 'requires_action',
    }).select('id').single()

    if (newShipmentAuth && earlySelectedIds.length > 0) {
      await sb.from('cellar').update({ shipment_id: newShipmentAuth.id }).in('id', earlySelectedIds)
    }

    await sendSms(
      from,
      `Your bank needs a quick check. Tap here to complete: ${APP_URL}/authenticate?token=${token}`,
      { trigger: 'keyword:ship-confirm', customerId: customer.id }
    )
    return twimlOk()
  }

  if (paymentIntent.status === 'succeeded') {
    // Payment succeeded — create shipment and pre-link cellar rows
    const token = crypto.randomUUID()
    const { data: newShipment, error } = await sb.from('shipments').insert({
      customer_id: customer.id,
      bottle_count: bottlesToShipEarly,
      status: 'pending',
      token,
      shipping_fee_pence: SHIPPING_FEE_PENCE,
      stripe_payment_intent_id: paymentIntent.id,
      stripe_charge_status: 'succeeded',
    }).select('id').single()

    if (error || !newShipment) {
      console.error('[twilio/inbound] shipment insert error (ship confirm)', error)
      await sendSms(from, `Something went wrong saving your shipment. Your payment was taken - please contact us.`, { trigger: 'keyword:ship-confirm', customerId: customer.id })
      return twimlOk()
    }

    // Pre-link cellar rows so /api/ship/confirm doesn't need the legacy fallback
    if (earlySelectedIds.length > 0) {
      await sb.from('cellar').update({ shipment_id: newShipment.id }).in('id', earlySelectedIds)
    }

    const { data: addrCust } = await sb.from('customers').select('default_address').eq('id', customer.id).maybeSingle()
    const addr = addrCust?.default_address as Record<string, string> | null
    if (addr?.line1) {
      const addrLine = [addr.line1, addr.line2, addr.city, addr.postcode].filter(Boolean).join(', ')
      await sendSms(from, `Payment taken — I'll ship your ${bottlesToShipEarly} bottle${bottlesToShipEarly === 1 ? '' : 's'} to ${addrLine}.\n\nReply YES to confirm or CHANGE to update your address.`, { trigger: 'keyword:ship-confirm', customerId: customer.id })
    } else {
      await sendSms(from, `Payment taken - confirm your delivery address at ${APP_URL}/ship?token=${token}`, { trigger: 'keyword:ship-confirm', customerId: customer.id })
    }
    return twimlOk()
  }

  // Unexpected PaymentIntent status
  console.error('[twilio/inbound] unexpected PaymentIntent status (ship confirm)', paymentIntent.status)
  const billingToken = crypto.randomUUID()
  await sb.from('customers').update({
    billing_token: billingToken,
    billing_token_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  }).eq('id', customer.id)
  await sendSms(from, `Card didn't go through. Update it here: ${APP_URL}/billing?token=${billingToken} — then reply SHIP CONFIRM to try again.`, { trigger: 'keyword:ship-confirm', customerId: customer.id })
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
    await sendSms(from, `Nothing to pause right now.`, { trigger: 'keyword:pause', customerId: customer.id })
    return twimlOk()
  }

  await sb
    .from('shipments')
    .update({ status: 'paused' })
    .eq('id', shipment.id)

  // Unlink pre-linked cellar rows so they're available for a future shipment
  await sb
    .from('cellar')
    .update({ shipment_id: null })
    .eq('shipment_id', shipment.id)
    .is('shipped_at', null)

  await sendSms(from, `Your shipment's on hold. Text SHIP when you're ready.`, { trigger: 'keyword:pause', customerId: customer.id })
  return twimlOk()
}

// ─── STATUS flow ──────────────────────────────────────────────────────────────

async function handleStatus(
  from: string,
  customer: Customer,
  sb: ReturnType<typeof createServiceClient>
): Promise<NextResponse> {
  const cases = await getRollingCases(customer.id, sb)
  const tier = customer.tier && customer.tier !== 'none' ? customer.tier : tierFromCases(cases)
  const threshold = deliveryThreshold(tier, customer.free_shipping_at_6)

  const tierName = TIER_NAMES[tier] ?? 'Bailey'

  // Fetch unshipped bottle count — sum(quantity), not a row count, and
  // excludes bottles already reserved in a pending shipment (shipment_id set).
  const { data: totals } = await sb
    .from('customer_cellar_totals')
    .select('total_bottles')
    .eq('customer_id', customer.id)
    .maybeSingle()

  const bottles = Number(totals?.total_bottles ?? 0)

  let progressLine = ''
  if (tier === 'none') {
    const needed = Math.max(0, 2 - cases)
    progressLine = `\nBailey tier: ${needed} more case${needed === 1 ? '' : 's'} needed.`
  } else if (tier === 'bailey') {
    const needed = Math.max(0, 4 - cases)
    progressLine = `\nElvet tier: ${needed} more case${needed === 1 ? '' : 's'} needed.`
  } else if (tier === 'elvet') {
    const needed = Math.max(0, 6 - cases)
    progressLine = `\nPalatine tier: ${needed} more case${needed === 1 ? '' : 's'} needed.`
  } else {
    progressLine = `\nYou're on our top tier.`
  }

  await sendSms(
    from,
    `${tierName} member - ${cases} case${cases === 1 ? '' : 's'} this cycle\n${bottles} bottle${bottles !== 1 ? 's' : ''} in your cellar (free shipping at ${threshold}).${progressLine}`,
    { trigger: 'keyword:status', customerId: customer.id }
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
    `Manage your account (card, address, preferences) at ${portalUrl}\n\nReply STATUS for a quick summary.`,
    { trigger: 'keyword:account', customerId: customer.id }
  )
  return twimlOk()
}

// ─── PENDING ORDER flow (integer reply) ──────────────────────────────────────

// A bare-number reply only auto-confirms an order if it lands within this
// window of the offer actually going out. Past that, `is_active` just marks
// "most recent offer" — it can stay true for weeks — so a stray number could
// otherwise re-trigger an old order confirmation out of nowhere.
const OFFER_REPLY_WINDOW_MS = 72 * 60 * 60 * 1000

async function handlePendingOrder(
  from: string,
  customer: Customer,
  qty: number,
  sb: ReturnType<typeof createServiceClient>
): Promise<NextResponse> {
  // Look up the single explicitly-flagged active offer
  const { data: latestText } = await sb
    .from('texts')
    .select('id, wine_id, sent_at, broadcast_sent_at, wines(*)')
    .eq('is_active', true)
    .maybeSingle() as { data: (TextBlast & { sent_at: string; broadcast_sent_at: string | null }) | null }

  if (!latestText) {
    await sendSms(from, `Nothing live right now — I'll text you when the next one's ready.`, { trigger: 'offer_reply', customerId: customer.id })
    return twimlOk()
  }

  const wine = latestText.wines
  const textId = latestText.id

  // Guard: don't auto-confirm if the offer is stale, or if an admin has
  // already sent a manual message since it went out — either means a human
  // is (or should be) driving the conversation, not the auto-order flow.
  const offerSentAt = new Date(latestText.broadcast_sent_at ?? latestText.sent_at).getTime()
  const offerIsStale = Date.now() - offerSentAt > OFFER_REPLY_WINDOW_MS

  let adminHasReplied = false
  if (!offerIsStale) {
    const { data: recentAdminMsg } = await sb
      .from('concierge_messages')
      .select('id')
      .eq('customer_id', customer.id)
      .eq('direction', 'outbound')
      .gt('created_at', new Date(offerSentAt).toISOString())
      .limit(1)
      .maybeSingle()
    adminHasReplied = !!recentAdminMsg
  }

  if (offerIsStale || adminHasReplied) {
    // Route to the inbox for a human instead of auto-processing — mirrors the
    // "unparseable" fallback below.
    await sb.from('concierge_messages').insert({
      customer_id: customer.id,
      direction: 'inbound',
      message: String(qty),
      category: 'general',
    })
    if (customer.concierge_status === 'closed') {
      await sb.from('customers').update({ concierge_status: 'open' }).eq('id', customer.id)
    }
    void logInbound({ sb, phone: from, raw: String(qty), customerId: customer.id, parseKind: 'quantity', parseQuantity: qty, matchedTextId: textId })
    return twimlOk()
  }

  // Check for existing pending order for this customer + text
  const { data: pendingOrder } = await sb
    .from('orders')
    .select('id, quantity, confirmation_expires_at')
    .eq('customer_id', customer.id)
    .eq('text_id', textId)
    .eq('order_status', 'awaiting_confirmation')
    .maybeSingle()

  if (pendingOrder) {
    if (pendingOrder.quantity === qty) {
      // Same quantity — just re-prompt
      const totalPence = pendingOrder.quantity * wine.price_pence
      await sendSms(
        from,
        `You have a pending order for ${pendingOrder.quantity} bottle${pendingOrder.quantity !== 1 ? 's' : ''} (£${(totalPence / 100).toFixed(2)}). Reply YES to confirm it, or NO to cancel.`,
        { trigger: 'offer_reply', customerId: customer.id }
      )
      return twimlOk()
    }

    // Different quantity — cancel the old order and create a fresh one below
    await sb.from('wines').update({ stock_bottles: wine.stock_bottles + pendingOrder.quantity }).eq('id', wine.id)
    await sb.from('orders').update({ order_status: 'cancelled' }).eq('id', pendingOrder.id)
    // Refresh stock count so the new order sees the restored total
    wine.stock_bottles = wine.stock_bottles + pendingOrder.quantity
  }

  // Stock check
  if (wine.stock_bottles < qty) {
    const n = wine.stock_bottles
    if (n === 0) {
      await sendSms(from, `Sorry, this one's sold out!`, { trigger: 'offer_reply', customerId: customer.id })
    } else {
      await sendSms(
        from,
        `Only ${n} left on this one — reply ${n} to grab them.`,
        { trigger: 'offer_reply', customerId: customer.id }
      )
    }
    return twimlOk()
  }

  const totalPence = qty * wine.price_pence

  // Reserve stock
  await sb
    .from('wines')
    .update({ stock_bottles: wine.stock_bottles - qty })
    .eq('id', wine.id)

  // No-card customers get a 24h window so they have time to add a card
  const confirmationExpiresAt = customer.stripe_payment_method_id
    ? new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()
    : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

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
    await sendSms(from, `Something went wrong. Please try again.`, { trigger: 'offer_reply', customerId: customer.id })
    return twimlOk()
  }

  // If the customer has no saved card, send billing link — no YES instruction yet
  if (!customer.stripe_payment_method_id) {
    const billingToken = generateShortToken()
    await sb.from('customers').update({
      billing_token: billingToken,
      billing_token_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }).eq('id', customer.id)
    await sendSms(
      from,
      noCardCardLink(qty, wine.name, (totalPence / 100).toFixed(2), APP_URL, billingToken),
      { trigger: 'offer_reply', customerId: customer.id }
    )
    void logInbound({ sb, phone: from, raw: String(qty), customerId: customer.id, parseKind: 'quantity', parseQuantity: qty, matchedTextId: textId })
    return twimlOk()
  }

  await sendSms(
    from,
    `${qty} x ${wine.name} — £${(totalPence / 100).toFixed(2)}. Reply YES to confirm.`,
    { trigger: 'offer_reply', customerId: customer.id }
  )
  void logInbound({ sb, phone: from, raw: String(qty), customerId: customer.id, parseKind: 'quantity', parseQuantity: qty, matchedTextId: textId })
  return twimlOk()
}

// ─── YES flow ─────────────────────────────────────────────────────────────────

async function handleYes(
  from: string,
  customer: Customer,
  sb: ReturnType<typeof createServiceClient>,
  paymentMode: 'auto' | 'card' | 'balance' = 'auto',
  preNote?: string
): Promise<NextResponse> {
  // ── Check for pending shipment confirmation first ─────────────────────────
  const { data: pendingShipment } = await sb
    .from('shipments')
    .select('id, bottle_count, token')
    .eq('customer_id', customer.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (pendingShipment) {
    // Fetch the saved address
    const { data: cust } = await sb
      .from('customers')
      .select('default_address')
      .eq('id', customer.id)
      .maybeSingle()

    const addr = cust?.default_address as Record<string, string> | null

    if (addr?.line1) {
      // Confirm the shipment using the saved address
      await sb
        .from('shipments')
        .update({ shipping_address: addr, status: 'confirmed' })
        .eq('id', pendingShipment.id)

      // Mark pre-linked cellar rows as shipped
      await sb
        .from('cellar')
        .update({ shipped_at: new Date().toISOString() })
        .eq('shipment_id', pendingShipment.id)
        .is('shipped_at', null)

      // Legacy fallback: if no rows were pre-linked, link all unshipped rows now
      const { count } = await sb
        .from('cellar')
        .select('*', { count: 'exact', head: true })
        .eq('shipment_id', pendingShipment.id)

      if ((count ?? 0) === 0) {
        await sb
          .from('cellar')
          .update({ shipment_id: pendingShipment.id, shipped_at: new Date().toISOString() })
          .eq('customer_id', customer.id)
          .is('shipped_at', null)
      }

      const addrLine = [addr.line1, addr.city, addr.postcode].filter(Boolean).join(', ')
      await sendSms(from, `Done! I'll get your ${pendingShipment.bottle_count} bottles on their way to ${addrLine}. I'll text you a tracking number when they ship.`, { trigger: 'keyword:yes', customerId: customer.id })
      return twimlOk()
    }

    // No saved address — send the link instead
    await sendSms(from, `Please confirm your delivery address here: ${APP_URL}/ship?token=${pendingShipment.token}`, { trigger: 'keyword:yes', customerId: customer.id })
    return twimlOk()
  }

  // ── Find the most recent pending or payment_failed order for this customer ─
  const { data: order } = await sb
    .from('orders')
    .select('id, wine_id, quantity, price_pence, total_pence, confirmation_expires_at, auth_token, text_id, order_status, payment_failed_at')
    .eq('customer_id', customer.id)
    .in('order_status', ['awaiting_confirmation', 'payment_failed'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!order) {
    await sendSms(from, `You don't have a pending order. Reply with a number to place an order.`, { trigger: 'keyword:yes', customerId: customer.id })
    return twimlOk()
  }

  // ── Payment_failed retry window: allow YES within 24h of failure ──────────
  if (order.order_status === 'payment_failed') {
    const retryExpiry = new Date(new Date(order.payment_failed_at as string).getTime() + 24 * 60 * 60 * 1000)
    if (new Date() > retryExpiry) {
      // Window expired — release reserved stock and inform customer
      const { data: failedWine } = await sb.from('wines').select('stock_bottles').eq('id', order.wine_id).maybeSingle()
      await sb.from('wines').update({ stock_bottles: (failedWine?.stock_bottles ?? 0) + order.quantity }).eq('id', order.wine_id)
      await sb.from('orders').update({ order_status: 'expired' }).eq('id', order.id)
      await sendSms(from, `Your order window has passed. Reply with a number to place a new order.`, { trigger: 'keyword:yes', customerId: customer.id })
      return twimlOk()
    }
    // Within retry window — reset back to awaiting_confirmation with a fresh expiry
    await sb.from('orders').update({
      order_status: 'awaiting_confirmation',
      confirmation_expires_at: retryExpiry.toISOString(),
    }).eq('id', order.id)
  }

  // Check expiry (for awaiting_confirmation orders; payment_failed path resets above)
  if (new Date() > new Date(order.confirmation_expires_at)) {
    // Release reserved stock
    const { data: expiredWineStock } = await sb
      .from('wines')
      .select('stock_bottles')
      .eq('id', order.wine_id)
      .maybeSingle()

    await sb
      .from('wines')
      .update({ stock_bottles: (expiredWineStock?.stock_bottles ?? 0) + order.quantity })
      .eq('id', order.wine_id)

    await sb
      .from('orders')
      .update({ order_status: 'expired' })
      .eq('id', order.id)

    if (!order.text_id) {
      // Manual offer expired — don't tell them to "reply with a number"
      await sendSms(from, `Sorry, that offer has expired. I'll follow up with a new one shortly.`, { trigger: 'keyword:yes', customerId: customer.id })

      const { data: expiredWine } = await sb.from('wines').select('name').eq('id', order.wine_id).maybeSingle()
      const name = customer.first_name ?? customer.phone
      const wineName = expiredWine?.name ?? 'unknown wine'

      await sb.from('concierge_messages').insert({
        customer_id: customer.id,
        direction: 'inbound',
        message: `Tried to confirm expired manual offer (${order.quantity} x ${wineName})`,
        category: 'purchase_query',
        context: `Expired manual offer: ${wineName}`,
      })

      if (customer.concierge_status === 'closed') {
        await sb.from('customers').update({ concierge_status: 'open' }).eq('id', customer.id)
      }

      void notifyAdmin(
        `Expired manual offer - ${name}`,
        `${name} replied YES to a manual offer that has expired.\n\nWine: ${order.quantity} x ${wineName}\nPhone: ${customer.phone}\n\nRe-send via the customer page if still available.`
      )
    } else {
      await sendSms(from, `Sorry, your order expired. Reply with a number to place a new one.`, { trigger: 'keyword:yes', customerId: customer.id })
    }
    return twimlOk()
  }

  // Fetch wine details for the response
  const { data: wine } = await sb
    .from('wines')
    .select('id, name, price_pence, stock_bottles')
    .eq('id', order.wine_id)
    .maybeSingle()

  // Guard: no PM in DB — send billing link (order stays pending, YES gate fires after card save)
  if (!customer.stripe_payment_method_id) {
    const billingToken = generateShortToken()
    await sb.from('customers').update({
      billing_token: billingToken,
      billing_token_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }).eq('id', customer.id)
    const totalPenceForPm = order.quantity * order.price_pence
    await sendSms(from, noCardCardLink(order.quantity, wine?.name ?? 'your wine', (totalPenceForPm / 100).toFixed(2), APP_URL, billingToken), { trigger: 'keyword:yes', customerId: customer.id })
    return twimlOk()
  }

  // ── Credit check (auto mode only — BALANCE/CARD replies skip straight to charging) ──
  let chargeAmountPence = order.total_pence

  if (paymentMode === 'auto') {
    const balance = await getBalance(sb, customer.id)
    if (balance > 0) {
      await sendSms(
        from,
        `You have £${(balance / 100).toFixed(2)} credit. Reply BALANCE to use it (any leftover goes on your card), or CARD to pay by card only.`,
        { trigger: 'keyword:yes', customerId: customer.id }
      )
      return twimlOk()
    }
  } else if (paymentMode === 'balance') {
    const balance = await getBalance(sb, customer.id)
    const creditToUse = Math.min(balance, order.total_pence)
    chargeAmountPence = order.total_pence - creditToUse

    await sb.from('orders').update({ credit_used_pence: creditToUse }).eq('id', order.id)

    if (chargeAmountPence === 0) {
      // Full credit covers the order — no Stripe call at all.
      await sb.from('orders').update({
        order_status: 'confirmed',
        stripe_charge_status: null,
      }).eq('id', order.id)

      await handlePostCharge({
        orderId: order.id,
        customerId: customer.id,
        wineId: order.wine_id,
        wineName: wine?.name ?? 'your wine',
        quantityJustBought: order.quantity,
        customerPhone: from,
        sb,
        preNote,
      })
      return twimlOk()
    }
  } else {
    // paymentMode === 'card' — charge full total, credit untouched. Reset any
    // stale credit_used_pence left over from a prior BALANCE attempt that failed.
    await sb.from('orders').update({ credit_used_pence: 0 }).eq('id', order.id)
  }

  // ── Charge via Stripe ────────────────────────────────────────────────────
  let paymentIntent: Stripe.PaymentIntent

  try {
    paymentIntent = await stripe.paymentIntents.create({
      amount: chargeAmountPence,
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
          `Your bank needs a quick verification. Tap here to complete: ${APP_URL}/authenticate?token=${authToken}`,
          { trigger: 'keyword:yes', customerId: customer.id }
        )
        return twimlOk()
      }

      // Card declined — move to payment_failed (stock stays reserved for the retry window)
      const now = new Date().toISOString()
      await sb.from('orders').update({
        stripe_payment_intent_id: pi?.id ?? '',
        stripe_charge_status: 'failed',
        order_status: 'payment_failed',
        payment_failed_at: now,
        payment_failed_attempts: 1,
        payment_failed_last_message_at: now,
      }).eq('id', order.id)

      const billingToken = generateShortToken()
      await sb.from('customers').update({
        billing_token: billingToken,
        billing_token_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }).eq('id', customer.id)

      await sendSms(from, paymentFailedT0(order.quantity, APP_URL, billingToken), { trigger: 'keyword:yes', customerId: customer.id })
      void notifyAdmin(
        `Payment failed — ${customer.first_name ?? customer.phone} — ${order.quantity} x ${wine?.name ?? 'wine'}`,
        `Customer: ${customer.first_name ?? ''} ${customer.phone}\nOrder: ${order.id}\nWine: ${wine?.name ?? ''}\nQty: ${order.quantity}\nTotal: £${(order.total_pence / 100).toFixed(2)}`,
        'members@thecellar.club'
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
      const billingToken = generateShortToken()
      const now = new Date().toISOString()
      await sb.from('customers').update({
        billing_token: billingToken,
        billing_token_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        stripe_payment_method_id: null,
      }).eq('id', customer.id)

      await sb.from('orders').update({
        order_status: 'payment_failed',
        stripe_charge_status: 'failed',
        payment_failed_at: now,
        payment_failed_attempts: 1,
        payment_failed_last_message_at: now,
      }).eq('id', order.id)

      await sendSms(from, paymentFailedT0(order.quantity, APP_URL, billingToken), { trigger: 'keyword:yes', customerId: customer.id })
      void notifyAdmin(
        `Payment failed — ${customer.first_name ?? customer.phone} — ${order.quantity} x ${wine?.name ?? 'wine'}`,
        `Customer: ${customer.first_name ?? ''} ${customer.phone}\nOrder: ${order.id}\nQty: ${order.quantity}\nTotal: £${(order.total_pence / 100).toFixed(2)}\nReason: invalid payment method`,
        'members@thecellar.club'
      )
      return twimlOk()
    }

    await sendSms(from, `Something went wrong processing your payment. Please reply YES to try again, or visit ${APP_URL}/portal for help.`, { trigger: 'keyword:yes', customerId: customer.id })
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
      preNote,
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
      `Your bank needs a quick verification. Tap here to complete: ${APP_URL}/authenticate?token=${authToken}`,
      { trigger: 'keyword:yes', customerId: customer.id }
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
  await sendSms(from, `Card didn't go through. Update it here: ${APP_URL}/billing?token=${billingToken} — then reply YES to try again.`, { trigger: 'keyword:yes', customerId: customer.id })
  return twimlOk()
}

// ─── OFFER flow ───────────────────────────────────────────────────────────────

async function handleOffer(
  from: string,
  customer: Customer,
  sb: ReturnType<typeof createServiceClient>
): Promise<NextResponse> {
  const { data: activeText } = await sb
    .from('texts')
    .select('id, wines(name, producer, region, vintage, price_pence, stock_bottles, description)')
    .eq('is_active', true)
    .maybeSingle() as { data: { id: string; wines: WineRow } | null }

  if (!activeText || !activeText.wines) {
    await sendSms(from, `Nothing live right now — I'll text you when the next one's ready.`, { trigger: 'keyword:offer', customerId: customer.id })
    return twimlOk()
  }

  const w = activeText.wines

  if (!w.stock_bottles || w.stock_bottles <= 0) {
    await sendSms(from, `Sorry, that one sold out. I'll be in touch with the next drop.`, { trigger: 'keyword:offer', customerId: customer.id })
    return twimlOk()
  }

  const price = `£${(w.price_pence / 100).toFixed(2)}`
  const vintage = w.vintage ? `${w.vintage} ` : ''
  const origin = [w.region].filter(Boolean).join(', ')
  const desc = w.description ? `\n\n${w.description}` : ''

  await sendSms(
    from,
    `This week's offer: ${vintage}${w.name}${origin ? ` (${origin})` : ''} - ${price} per bottle.${desc}\n\nReply with how many bottles you'd like.`,
    { trigger: 'keyword:offer', customerId: customer.id }
  )
  await sb.from('customers').update({ sms_awaiting: 'offer' }).eq('id', customer.id)
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
  const rawBody = (params['Body'] ?? '').trim()
  const body = rawBody.toLowerCase()
  // Strip trailing punctuation for keyword matching only — e.g. "yes." → "yes", "YES!" → "yes"
  // Also normalise polite variants — "yes please" / "yes pls" → "yes"
  const keyword = body.replace(/[.!?,;]+$/, '').replace(/^yes\s+(please|pls)$/, 'yes')

  const sb = createServiceClient()

  try {
    // ── Customer lookup ──────────────────────────────────────────────────
    const { data: customer } = await sb
      .from('customers')
      .select('id, phone, first_name, stripe_customer_id, stripe_payment_method_id, status, texts_snoozed_until, tier, sms_awaiting, concierge_status, free_shipping_at_6')
      .eq('phone', from)
      .maybeSingle() as { data: Customer | null }

    if (!customer) {
      await sendSms(from, `Hey! I don't recognise this number. If you'd like to join, sign up at ${APP_URL}/join`, { trigger: 'unknown_number' })
      return twimlOk()
    }

    if (customer.status !== 'active') {
      await sendSms(from, `You're unsubscribed. Visit ${APP_URL}/join to rejoin.`, { trigger: 'inactive', customerId: customer.id })
      return twimlOk()
    }

    // ── Pending state — awaiting follow-up to REQUEST or QUESTION ─────────
    if (customer.sms_awaiting) {
      if (keyword === 'exit') {
        await sb.from('customers').update({ sms_awaiting: null }).eq('id', customer.id)
        await sendSms(from, `No problem. Text OFFER, QUESTION or REQUEST any time, or visit your portal: ${APP_URL}/portal`, { trigger: 'keyword:exit', customerId: customer.id })
        return twimlOk()
      }

      // If awaiting offer and customer replies with a parseable quantity, skip straight to order
      if (customer.sms_awaiting === 'offer') {
        if (keyword === 'yes') {
          await sb.from('customers').update({ sms_awaiting: null }).eq('id', customer.id)
          return await handleYes(from, customer, sb)
        }

        const parseResult = parseOrderReply(rawBody)
        if (parseResult.kind === 'quantity') {
          await sb.from('customers').update({ sms_awaiting: null }).eq('id', customer.id)
          void logInbound({
            sb, phone: from, raw: rawBody, customerId: customer.id,
            parseKind: 'quantity', parseQuantity: parseResult.quantity,
            ambiguous: parseResult.ambiguous ?? false,
          })
          return await handlePendingOrder(from, customer, parseResult.quantity, sb)
        }
      }

      const pendingType = customer.sms_awaiting
      await sb.from('customers').update({ sms_awaiting: null }).eq('id', customer.id)

      if (pendingType === 'request') {
        await sb.from('special_requests').insert({
          customer_id: customer.id,
          message: body,
          status: 'new',
        })
        await sb.from('concierge_messages').insert({
          customer_id: customer.id,
          direction: 'inbound',
          message: body,
          category: 'special_request',
          context: 'Special request',
        })
        if (customer.concierge_status !== 'open') {
          await sb.from('customers').update({ concierge_status: 'open' }).eq('id', customer.id)
        }
        const name = customer.first_name ?? customer.phone
        await notifyAdmin(
          `New wine request from ${name}`,
          `Message: ${body}\nPhone: ${customer.phone}`
        )
        await sendSms(from, `Got it — I'll look into that. If I can get hold of it, I'll run it as a drop.`, { trigger: 'keyword:request', customerId: customer.id })
        return twimlOk()
      }

      if (pendingType === 'question') {
        await sb.from('concierge_messages').insert({
          customer_id: customer.id,
          message: body,
          direction: 'inbound',
        })
        const name = customer.first_name ?? customer.phone
        // Reopen closed concierge thread if needed
        if (customer.concierge_status === 'closed') {
          await sb.from('customers').update({ concierge_status: 'open' }).eq('id', customer.id)
          await notifyAdmin(
            `Concierge thread reopened — ${name}`,
            `${name} sent a new message after their thread was closed.\n\nMessage: ${body}\nPhone: ${customer.phone}`
          )
        } else {
          await notifyAdmin(
            `New question from ${name}`,
            `Message: ${body}\nPhone: ${customer.phone}`
          )
        }
        await sendSms(from, `Got it — I'll get back to you shortly.`, { trigger: 'keyword:question', customerId: customer.id })
        return twimlOk()
      }

      if (pendingType === 'offer') {
        const { data: activeOffer } = await sb
          .from('texts')
          .select('wines(name, price_pence)')
          .eq('is_active', true)
          .maybeSingle() as { data: { wines: { name: string; price_pence: number } } | null }

        const wineName = activeOffer?.wines?.name ?? 'the current offer'
        const winePrice = activeOffer?.wines?.price_pence
        const priceStr = winePrice ? `£${(winePrice / 100).toFixed(0)}/bottle` : null
        const context = `Re: ${wineName}${priceStr ? ` (${priceStr})` : ''}`

        const rawMessage = (params['Body'] ?? '').trim()

        await sb.from('concierge_messages').insert({
          customer_id: customer.id,
          direction: 'inbound',
          message: rawMessage,
          category: 'purchase_query',
          context,
        })

        if (customer.concierge_status === 'closed') {
          await sb.from('customers').update({ concierge_status: 'open' }).eq('id', customer.id)
        }

        return twimlOk()
      }
    }

    // ── STOP / UNSUBSCRIBE ───────────────────────────────────────────────
    if (keyword === 'stop' || keyword === 'unsubscribe') {
      await sb
        .from('customers')
        .update({ status: 'deactivated', unsubscribed_at: new Date().toISOString() })
        .eq('id', customer.id)
      await sendSms(from, `You've been unsubscribed. Visit ${APP_URL}/join to rejoin.`, { trigger: 'keyword:stop', customerId: customer.id })
      return twimlOk()
    }

    // ── CELLAR ───────────────────────────────────────────────────────────
    if (keyword === 'cellar') {
      return await handleCellar(from, customer, sb)
    }

    // ── SHIP CONFIRM ─────────────────────────────────────────────────────
    if (body === 'ship confirm') {
      return await handleShipConfirm(from, customer, sb)
    }

    // ── SHIP ─────────────────────────────────────────────────────────────
    if (keyword === 'ship') {
      return await handleShip(from, customer, sb)
    }

    // ── PAUSE ────────────────────────────────────────────────────────────
    if (keyword === 'pause') {
      return await handlePause(from, customer, sb)
    }

    // ── STATUS ───────────────────────────────────────────────────────────
    if (keyword === 'status') {
      return await handleStatus(from, customer, sb)
    }

    // ── ACCOUNT ──────────────────────────────────────────────────────────
    if (keyword === 'account') {
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
        `No problem - I'll hold your texts for ${weeks} week${weeks === 1 ? '' : 's'}. Text RESUME any time.`,
        { trigger: 'keyword:snooze', customerId: customer.id }
      )
      return twimlOk()
    }

    // ── RESUME ───────────────────────────────────────────────────────────
    if (keyword === 'resume') {
      await sb
        .from('customers')
        .update({ texts_snoozed_until: null })
        .eq('id', customer.id)
      await sendSms(from, `Welcome back — I'll have something for you soon.`, { trigger: 'keyword:resume', customerId: customer.id })
      return twimlOk()
    }

    // ── REQUEST ──────────────────────────────────────────────────────────
    if (body.startsWith('request ')) {
      // Inline content — process immediately (backward compat)
      const message = (params['Body'] ?? '').trim().slice(8).trim()
      if (message) {
        await sb.from('special_requests').insert({ customer_id: customer.id, message, status: 'new' })
        await sb.from('concierge_messages').insert({
          customer_id: customer.id,
          direction: 'inbound',
          message,
          category: 'special_request',
          context: 'Special request',
        })
        if (customer.concierge_status !== 'open') {
          await sb.from('customers').update({ concierge_status: 'open' }).eq('id', customer.id)
        }
        const name = customer.first_name ?? customer.phone
        await notifyAdmin(`New wine request from ${name}`, `Message: ${message}\nPhone: ${customer.phone}`)
        await sendSms(from, `Got it — I'll look into that. If I can get hold of it, I'll run it as a drop.`, { trigger: 'keyword:request', customerId: customer.id })
        return twimlOk()
      }
      // Empty after 'request ' - fall through to bare-word handler below
    }

    if (body === 'request') {
      await sb.from('customers').update({ sms_awaiting: 'request' }).eq('id', customer.id)
      await sendSms(
        from,
        `What would you like us to feature? Tell us about it - e.g. 'something from Georgia' or 'Chateau Musar'.\n\nReply EXIT to go back.`,
        { trigger: 'keyword:request', customerId: customer.id }
      )
      return twimlOk()
    }

    // ── QUESTION ─────────────────────────────────────────────────────────
    if (body.startsWith('question ')) {
      // Inline content — process immediately (backward compat)
      const message = (params['Body'] ?? '').trim().slice(9).trim()
      if (message) {
        await sb.from('concierge_messages').insert({ customer_id: customer.id, direction: 'inbound', message })
        const name = customer.first_name ?? customer.phone
        // Reopen closed concierge thread if needed
        if (customer.concierge_status === 'closed') {
          await sb.from('customers').update({ concierge_status: 'open' }).eq('id', customer.id)
          await notifyAdmin(
            `Concierge thread reopened — ${name}`,
            `${name} sent a new message after their thread was closed.\n\nMessage: ${message}\nPhone: ${customer.phone}`
          )
        } else {
          await notifyAdmin(`New question from ${name}`, `Message: ${message}\nPhone: ${customer.phone}`)
        }
        await sendSms(from, `Got it — I'll get back to you shortly.`, { trigger: 'keyword:question', customerId: customer.id })
        return twimlOk()
      }
      // Empty after 'question ' - fall through to bare-word handler below
    }

    if (body === 'question') {
      await sb.from('customers').update({ sms_awaiting: 'question' }).eq('id', customer.id)
      await sendSms(
        from,
        `What's on your mind? Ask us anything - e.g. 'can you help me find a wine gift?' or 'how long does shipping take?'.\n\nReply EXIT to go back.`,
        { trigger: 'keyword:question', customerId: customer.id }
      )
      return twimlOk()
    }

    // ── CHANGE (update delivery address on pending shipment) ──────────────
    if (keyword === 'change') {
      const { data: pending } = await sb
        .from('shipments')
        .select('token')
        .eq('customer_id', customer.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (pending?.token) {
        await sendSms(from, `Update your delivery address here: ${APP_URL}/ship?token=${pending.token}`, { trigger: 'keyword:change', customerId: customer.id })
      } else {
        await sendSms(from, `You don't have a pending shipment to update.`, { trigger: 'keyword:change', customerId: customer.id })
      }
      return twimlOk()
    }

    // ── OFFER ─────────────────────────────────────────────────────────────
    if (keyword === 'offer') {
      void logInbound({ sb, phone: from, raw: rawBody, customerId: customer.id, parseKind: 'keyword:offer' })
      return await handleOffer(from, customer, sb)
    }

    // ── YES → charge pending order ────────────────────────────────────────
    if (keyword === 'yes') {
      void logInbound({ sb, phone: from, raw: rawBody, customerId: customer.id, parseKind: 'keyword:yes' })
      return await handleYes(from, customer, sb)
    }

    // ── BALANCE / CARD → credit-aware order confirmation ───────────────────
    if (keyword === 'card' || keyword === 'balance') {
      const { data: pendingForCredit } = await sb
        .from('orders')
        .select('id')
        .eq('customer_id', customer.id)
        .in('order_status', ['awaiting_confirmation', 'payment_failed'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (pendingForCredit) {
        void logInbound({ sb, phone: from, raw: rawBody, customerId: customer.id, parseKind: `keyword:${keyword}` })

        if (keyword === 'card') {
          return await handleYes(from, customer, sb, 'card')
        }

        const balance = await getBalance(sb, customer.id)
        if (balance > 0) {
          return await handleYes(from, customer, sb, 'balance')
        }
        // Edge case: balance was spent in the gap between the YES prompt and this
        // reply — behave exactly as CARD, with a one-line note explaining why.
        return await handleYes(
          from, customer, sb, 'card',
          `No credit was available, so this was charged to your card in full.`
        )
      }

      if (keyword === 'balance') {
        // ── Standalone BALANCE — no pending order ────────────────────────────
        const balance = await getBalance(sb, customer.id)
        void logInbound({ sb, phone: from, raw: rawBody, customerId: customer.id, parseKind: 'keyword:balance' })
        await sendSms(
          from,
          `Your Cellar Club credit balance is £${(balance / 100).toFixed(2)}.`,
          { trigger: 'keyword:balance', customerId: customer.id }
        )
        return twimlOk()
      }
      // keyword === 'card' with no pending order → fall through to the rest of the router
    }

    // ── NO / CANCEL → cancel pending order ───────────────────────────────
    if (keyword === 'no' || keyword === 'cancel') {
      void logInbound({ sb, phone: from, raw: rawBody, customerId: customer.id, parseKind: 'keyword:no' })

      const { data: latestTextForNo } = await sb
        .from('texts')
        .select('id, wine_id, wines(stock_bottles)')
        .eq('is_active', true)
        .maybeSingle() as { data: { id: string; wine_id: string; wines: { stock_bottles: number } } | null }

      if (latestTextForNo) {
        const { data: pendingToCancel } = await sb
          .from('orders')
          .select('id, quantity')
          .eq('customer_id', customer.id)
          .eq('text_id', latestTextForNo.id)
          .eq('order_status', 'awaiting_confirmation')
          .maybeSingle()

        if (pendingToCancel) {
          await sb.from('wines').update({ stock_bottles: latestTextForNo.wines.stock_bottles + pendingToCancel.quantity }).eq('id', latestTextForNo.wine_id)
          await sb.from('orders').update({ order_status: 'cancelled' }).eq('id', pendingToCancel.id)
          await sendSms(from, `No problem — your order's been cancelled. Reply with a number if you change your mind.`, { trigger: 'keyword:no', customerId: customer.id })
          return twimlOk()
        }
      }

      // No pending order to cancel — fall through to quantity parse / menu
    }

    // ── QUANTITY REPLY → pending order ────────────────────────────────────
    const parseResult = parseOrderReply(rawBody)
    if (parseResult.kind === 'quantity') {
      void logInbound({
        sb, phone: from, raw: rawBody, customerId: customer.id,
        parseKind: 'quantity', parseQuantity: parseResult.quantity,
        ambiguous: parseResult.ambiguous ?? false,
      })
      return await handlePendingOrder(from, customer, parseResult.quantity, sb)
    }
    if (parseResult.kind === 'unparseable') {
      void logInbound({ sb, phone: from, raw: rawBody, customerId: customer.id, parseKind: 'unparseable' })

      const rawMessage = (params['Body'] ?? '').trim()

      await sb.from('concierge_messages').insert({
        customer_id: customer.id,
        direction: 'inbound',
        message: rawMessage,
        category: 'general',
      })

      if (customer.concierge_status === 'closed') {
        await sb.from('customers').update({ concierge_status: 'open' }).eq('id', customer.id)
      }

      return twimlOk()
    }

    // ── Continuation of any open thread ──────────────────────────────────
    const conciergeOpen = customer.concierge_status === 'open'

    let openRequest: { id: string } | null = null
    if (!conciergeOpen) {
      const { data: openReqData } = await sb
        .from('special_requests')
        .select('id')
        .eq('customer_id', customer.id)
        .neq('status', 'resolved')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      openRequest = openReqData ?? null
    }

    if (conciergeOpen || openRequest) {
      const rawMessage = (params['Body'] ?? '').trim()
      const name = customer.first_name ?? customer.phone

      // Only ack if the last message in the thread was outbound (Daniel replied)
      // or there are no prior messages — avoids repeating the ack while Daniel is
      // working on a reply.
      const { data: lastMsg } = await sb
        .from('concierge_messages')
        .select('direction')
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      const shouldAck = !lastMsg || lastMsg.direction === 'outbound'

      await sb.from('concierge_messages').insert({
        customer_id: customer.id,
        direction: 'inbound',
        message: rawMessage,
        category: openRequest ? 'request_followup' : 'general',
        context: openRequest ? `Re: special request` : null,
      })

      if (openRequest) {
        await sb
          .from('special_requests')
          .update({ status: 'in_progress' })
          .eq('id', openRequest.id)
      }

      if (!conciergeOpen) {
        await sb
          .from('customers')
          .update({ concierge_status: 'open' })
          .eq('id', customer.id)
      }

      await notifyAdmin(
        `Inbox follow-up from ${name}`,
        `Message: ${rawMessage}\nPhone: ${customer.phone}`
      )

      if (shouldAck) {
        await sendSms(from, `Got it — I'll be in touch soon.`, { trigger: 'concierge:ack', customerId: customer.id })
      }
      return twimlOk()
    }

    // ── Anything else → inbox + email, no SMS ────────────────────────────
    const name = customer.first_name ?? customer.phone

    await sb.from('concierge_messages').insert({
      customer_id: customer.id,
      direction: 'inbound',
      message: rawBody,
      category: 'general',
    })

    if (customer.concierge_status === 'closed') {
      await sb.from('customers').update({ concierge_status: 'open' }).eq('id', customer.id)
    }

    await notifyAdmin(
      `Message from ${name}`,
      `${name} sent an unrecognised message.\n\nMessage: ${rawBody}\nPhone: ${customer.phone}`
    )

    return twimlOk()
  } catch (err) {
    console.error('[twilio/inbound] unexpected error', err)
    // Always return valid TwiML even on error
    return twimlOk()
  }
}
