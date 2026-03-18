import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'
import Stripe from 'stripe'
import { twilioClient } from '@/lib/twilio'
import { createServiceClient } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Customer {
  id: string
  phone: string
  first_name: string | null
  stripe_customer_id: string
  stripe_payment_method_id: string
  active: boolean
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
      `You've got ${total} bottle${total === 1 ? '' : 's'} so far — you need 12 for free shipping!`
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

  // Create new pending shipment with a token
  const token = crypto.randomUUID()
  const { error } = await sb.from('shipments').insert({
    customer_id: customer.id,
    bottle_count: total,
    status: 'pending',
    token,
  })

  if (error) {
    console.error('[twilio/inbound] shipment insert error', error)
    await sendSms(from, `Something went wrong. Please try again.`)
    return twimlOk()
  }

  await sendSms(
    from,
    `Brilliant! Confirm your delivery address at ${APP_URL}/ship?token=${token}`
  )
  return twimlOk()
}

// ─── ORDER flow ───────────────────────────────────────────────────────────────

async function handleOrder(
  from: string,
  customer: Customer,
  qty: number,
  sb: ReturnType<typeof createServiceClient>
): Promise<NextResponse> {
  // Look up the single explicitly-flagged active offer (set by /api/texts/send)
  const { data: latestText } = await sb
    .from('texts')
    .select('id, wine_id, wines(*)')
    .eq('is_active', true)
    .maybeSingle() as { data: TextBlast | null }

  if (!latestText) {
    await sendSms(from, `No wine available yet — watch this space!`)
    return twimlOk()
  }

  const wine = latestText.wines
  const textId = latestText.id

  // Idempotency — one order per customer per blast
  const { data: existingOrder } = await sb
    .from('orders')
    .select('id')
    .eq('customer_id', customer.id)
    .eq('text_id', textId)
    .maybeSingle()

  if (existingOrder) {
    await sendSms(
      from,
      `You've already ordered from this one! Your bottles are safely in the cellar.`
    )
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

  // ── Charge via Stripe ────────────────────────────────────────────────────
  let paymentIntent: Stripe.PaymentIntent

  try {
    paymentIntent = await stripe.paymentIntents.create({
      amount: totalPence,
      currency: 'gbp',
      customer: customer.stripe_customer_id,
      payment_method: customer.stripe_payment_method_id,
      off_session: true,
      confirm: true,
    })
  } catch (err: unknown) {
    // Stripe throws StripeCardError for card-level failures
    if (err instanceof Stripe.errors.StripeCardError) {
      const pi = err.payment_intent

      if (err.code === 'authentication_required') {
        // 3DS required — save order and send authenticate link
        const token = crypto.randomUUID()
        await sb.from('orders').insert({
          customer_id: customer.id,
          wine_id: wine.id,
          text_id: textId,
          quantity: qty,
          price_pence: wine.price_pence,
          total_pence: totalPence,
          stripe_payment_intent_id: pi?.id ?? null,
          stripe_charge_status: 'requires_action',
          auth_token: token,
        })
        await sendSms(
          from,
          `We need you to verify your payment. Visit ${APP_URL}/authenticate?token=${token} to complete your order.`
        )
        return twimlOk()
      }

      // Card declined / other failure
      await sb.from('orders').insert({
        customer_id: customer.id,
        wine_id: wine.id,
        text_id: textId,
        quantity: qty,
        price_pence: wine.price_pence,
        total_pence: totalPence,
        stripe_payment_intent_id: pi?.id ?? null,
        stripe_charge_status: 'failed',
      })
      await sendSms(
        from,
        `Your payment didn't go through. Update your card at ${APP_URL}/billing and try again.`
      )
      return twimlOk()
    }

    // Unexpected Stripe or network error
    console.error('[twilio/inbound] Stripe error', err)
    await sendSms(from, `Something went wrong processing your payment. Please try again.`)
    return twimlOk()
  }

  // ── Payment succeeded ────────────────────────────────────────────────────
  if (paymentIntent.status === 'succeeded') {
    // Insert order
    const { data: newOrder, error: orderErr } = await sb
      .from('orders')
      .insert({
        customer_id: customer.id,
        wine_id: wine.id,
        text_id: textId,
        quantity: qty,
        price_pence: wine.price_pence,
        total_pence: totalPence,
        stripe_payment_intent_id: paymentIntent.id,
        stripe_charge_status: 'succeeded',
      })
      .select('id')
      .single()

    if (orderErr) {
      console.error('[twilio/inbound] order insert error', orderErr)
      await sendSms(from, `Something went wrong. Your payment was taken — please contact us.`)
      return twimlOk()
    }

    // Add to cellar
    await sb.from('cellar').insert({
      customer_id: customer.id,
      wine_id: wine.id,
      order_id: newOrder.id,
      quantity: qty,
    })

    // Decrement stock (only on success)
    await sb
      .from('wines')
      .update({ stock_bottles: wine.stock_bottles - qty })
      .eq('id', wine.id)

    // Fetch new cellar total
    const { data: totals } = await sb
      .from('customer_cellar_totals')
      .select('total_bottles')
      .eq('customer_id', customer.id)
      .maybeSingle()

    const total = Number(totals?.total_bottles ?? qty)
    const bottleWord = qty === 1 ? 'bottle' : 'bottles'

    let reply =
      `Got it — ${qty} ${bottleWord} of ${wine.name} added to your cellar. ` +
      `You now have ${total} stored.`

    if (total >= 12) {
      reply += ` You've hit 12 bottles! Reply SHIP to arrange your free case delivery.`
    }

    await sendSms(from, reply)
    return twimlOk()
  }

  // ── requires_action (returned rather than thrown in some Stripe SDK versions) ──
  if (paymentIntent.status === 'requires_action') {
    const token = crypto.randomUUID()
    await sb.from('orders').insert({
      customer_id: customer.id,
      wine_id: wine.id,
      text_id: textId,
      quantity: qty,
      price_pence: wine.price_pence,
      total_pence: totalPence,
      stripe_payment_intent_id: paymentIntent.id,
      stripe_charge_status: 'requires_action',
      auth_token: token,
    })
    await sendSms(
      from,
      `We need you to verify your payment. Visit ${APP_URL}/authenticate?token=${token} to complete your order.`
    )
    return twimlOk()
  }

  // ── Unexpected status ────────────────────────────────────────────────────
  console.error('[twilio/inbound] unexpected PaymentIntent status', paymentIntent.status)
  await sb.from('orders').insert({
    customer_id: customer.id,
    wine_id: wine.id,
    text_id: textId,
    quantity: qty,
    price_pence: wine.price_pence,
    total_pence: totalPence,
    stripe_payment_intent_id: paymentIntent.id,
    stripe_charge_status: 'failed',
  })
  await sendSms(from, `Your payment didn't go through. Update your card at ${APP_URL}/billing and try again.`)
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

  const from = params['From'] ?? ''
  // Trim and lowercase for consistent keyword matching
  const body = (params['Body'] ?? '').trim().toLowerCase()

  const sb = createServiceClient()

  try {
    // ── Customer lookup ──────────────────────────────────────────────────
    const { data: customer } = await sb
      .from('customers')
      .select('id, phone, first_name, stripe_customer_id, stripe_payment_method_id, active')
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

    // ── SHIP ─────────────────────────────────────────────────────────────
    if (body === 'ship') {
      return await handleShip(from, customer, sb)
    }

    // ── POSITIVE INTEGER → ORDER ─────────────────────────────────────────
    const qty = parseInt(body, 10)
    if (!isNaN(qty) && qty > 0 && /^\d+$/.test(body)) {
      return await handleOrder(from, customer, qty, sb)
    }

    // ── Anything else ────────────────────────────────────────────────────
    await sendSms(
      from,
      `Just reply with a number to order (e.g. '2'). Or reply STOP to unsubscribe.`
    )
    return twimlOk()
  } catch (err) {
    console.error('[twilio/inbound] unexpected error', err)
    // Always return valid TwiML even on error
    return twimlOk()
  }
}
