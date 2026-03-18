import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase'
import { twilioClient } from '@/lib/twilio'

/**
 * POST /api/webhooks/stripe
 *
 * Handles async Stripe events. Must read the raw body for signature verification —
 * Next.js App Router does NOT auto-parse the body, so req.text() gives us the raw string.
 *
 * Handled events:
 *   payment_intent.succeeded     → update order, insert cellar, decrement stock, SMS if 3DS flow
 *   payment_intent.payment_failed → update order, SMS customer with /billing link
 *
 * All other event types → 200 received:true (never error on unknown events)
 */
export async function POST(req: NextRequest) {
  // Raw body required for Stripe signature verification
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 })
  }

  const sb = createServiceClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  // ── payment_intent.succeeded ─────────────────────────────────────────────
  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object as Stripe.PaymentIntent

    const { data: order } = await sb
      .from('orders')
      .select('id, customer_id, wine_id, quantity, stripe_charge_status')
      .eq('stripe_payment_intent_id', pi.id)
      .maybeSingle()

    // Unknown PI (not from this app) — ignore
    if (!order) return NextResponse.json({ received: true })

    // Idempotent — the inbound webhook may have already processed this
    if (order.stripe_charge_status === 'succeeded') {
      return NextResponse.json({ received: true })
    }

    const previousStatus = order.stripe_charge_status

    // Update order
    await sb
      .from('orders')
      .update({ stripe_charge_status: 'succeeded' })
      .eq('id', order.id)

    // Insert cellar entry
    await sb.from('cellar').insert({
      customer_id: order.customer_id,
      wine_id: order.wine_id,
      order_id: order.id,
      quantity: order.quantity,
    })

    // Decrement stock (fetch-then-update is fine at this scale)
    const { data: wine } = await sb
      .from('wines')
      .select('name, stock_bottles')
      .eq('id', order.wine_id)
      .maybeSingle()

    if (wine && wine.stock_bottles >= order.quantity) {
      await sb
        .from('wines')
        .update({ stock_bottles: wine.stock_bottles - order.quantity })
        .eq('id', order.wine_id)
    }

    // Only send SMS if the order was previously requires_action (3DS just completed).
    // If it was pending, the inbound webhook already sent a confirmation message.
    if (previousStatus === 'requires_action') {
      const { data: customer } = await sb
        .from('customers')
        .select('phone')
        .eq('id', order.customer_id)
        .maybeSingle()

      if (customer) {
        // Get new cellar total (cellar row just inserted, so view reflects it)
        const { data: cellarTotal } = await sb
          .from('customer_cellar_totals')
          .select('total_bottles')
          .eq('customer_id', order.customer_id)
          .maybeSingle()

        const newTotal = Number(cellarTotal?.total_bottles ?? 0)
        const oldTotal = newTotal - order.quantity

        let message =
          `Payment confirmed — ${order.quantity} bottle${order.quantity !== 1 ? 's' : ''} ` +
          `of ${wine?.name ?? 'wine'} added to your cellar. You now have ${newTotal} stored.`

        // 12-bottle auto-notification
        if (oldTotal < 12 && newTotal >= 12) {
          message += ` You've hit 12 bottles! Reply SHIP to arrange your free case delivery.`
        }

        await twilioClient.messages.create({
          body: message,
          from: process.env.TWILIO_PHONE_NUMBER!,
          to: customer.phone,
        })
      }
    }

  // ── payment_intent.payment_failed ────────────────────────────────────────
  } else if (event.type === 'payment_intent.payment_failed') {
    const pi = event.data.object as Stripe.PaymentIntent

    const { data: order } = await sb
      .from('orders')
      .select('id, customer_id, stripe_charge_status')
      .eq('stripe_payment_intent_id', pi.id)
      .maybeSingle()

    if (!order) return NextResponse.json({ received: true })

    // Idempotent
    if (order.stripe_charge_status === 'failed') {
      return NextResponse.json({ received: true })
    }

    await sb
      .from('orders')
      .update({ stripe_charge_status: 'failed' })
      .eq('id', order.id)

    const { data: customer } = await sb
      .from('customers')
      .select('phone')
      .eq('id', order.customer_id)
      .maybeSingle()

    if (customer) {
      await twilioClient.messages.create({
        body: `Your payment didn't go through. Update your card at ${appUrl}/billing and try again.`,
        from: process.env.TWILIO_PHONE_NUMBER!,
        to: customer.phone,
      })
    }
  }

  // Always return 200 for handled and unhandled event types
  return NextResponse.json({ received: true })
}
