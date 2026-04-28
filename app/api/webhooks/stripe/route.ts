import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase'
import { twilioClient, sanitiseGsm7 } from '@/lib/twilio'
import { handlePostCharge } from '@/lib/post-charge'
import { checkAndApplyTierUpgrade } from '@/lib/tiers'

/**
 * POST /api/webhooks/stripe
 *
 * Handles async Stripe events. Raw body is read via req.text() — Next.js App Router
 * does not auto-parse bodies, so signature verification works without any config.
 *
 * payment_intent.succeeded     → guard on order_status, update order to 'confirmed',
 *                                 call handlePostCharge (inserts cellar + sends SMS).
 *                                 Stock was already decremented when the pending order
 *                                 was created — do NOT decrement again here.
 *
 * payment_intent.payment_failed → guard on order_status, update to 'cancelled',
 *                                  release reserved stock, SMS customer with /billing link.
 *
 * Both handlers are idempotent.
 * Unhandled event types → 200 (never error on events we don't care about).
 */
export async function POST(req: NextRequest) {
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
      .select('id, customer_id, wine_id, quantity, stripe_charge_status, order_status')
      .eq('stripe_payment_intent_id', pi.id)
      .maybeSingle()

    if (!order) return NextResponse.json({ received: true })

    // Guard: skip if already processed or cancelled
    if (order.order_status === 'confirmed' || order.order_status === 'cancelled') {
      return NextResponse.json({ received: true })
    }

    // Update order
    await sb
      .from('orders')
      .update({ stripe_charge_status: 'succeeded', order_status: 'confirmed' })
      .eq('id', order.id)

    // Only SMS via handlePostCharge if this was a 3DS completion (requires_action → succeeded).
    // If the charge was inline (pending → succeeded via the YES handler), handlePostCharge
    // was already called in the webhook. We only reach here for async Stripe events.
    if (order.stripe_charge_status === 'requires_action') {
      const { data: customer } = await sb
        .from('customers')
        .select('phone')
        .eq('id', order.customer_id)
        .maybeSingle()

      const { data: wine } = await sb
        .from('wines')
        .select('name')
        .eq('id', order.wine_id)
        .maybeSingle()

      if (customer?.phone) {
        await handlePostCharge({
          orderId: order.id,
          customerId: order.customer_id,
          wineId: order.wine_id,
          wineName: wine?.name ?? 'your wine',
          quantityJustBought: order.quantity,
          customerPhone: customer.phone,
          sb,
        })

        // Tier upgrade check for 3DS completions
        await checkAndApplyTierUpgrade(order.customer_id, sb).catch((e) =>
          console.error('[stripe-webhook] tier upgrade check failed:', e)
        )
      }
    }

  // ── payment_intent.payment_failed ────────────────────────────────────────
  } else if (event.type === 'payment_intent.payment_failed') {
    const pi = event.data.object as Stripe.PaymentIntent

    const { data: order } = await sb
      .from('orders')
      .select('id, customer_id, wine_id, quantity, stripe_charge_status, order_status')
      .eq('stripe_payment_intent_id', pi.id)
      .maybeSingle()

    if (!order) return NextResponse.json({ received: true })

    // Guard: only process awaiting_confirmation orders
    if (order.order_status !== 'awaiting_confirmation') {
      return NextResponse.json({ received: true })
    }

    // Update order to cancelled
    await sb
      .from('orders')
      .update({ stripe_charge_status: 'failed', order_status: 'cancelled' })
      .eq('id', order.id)

    // Release reserved stock
    const { data: wine } = await sb
      .from('wines')
      .select('stock_bottles')
      .eq('id', order.wine_id)
      .maybeSingle()

    if (wine) {
      await sb
        .from('wines')
        .update({ stock_bottles: wine.stock_bottles + order.quantity })
        .eq('id', order.wine_id)
    }

    const { data: customer } = await sb
      .from('customers')
      .select('phone')
      .eq('id', order.customer_id)
      .maybeSingle()

    if (customer?.phone) {
      const billingToken = crypto.randomUUID()
      await sb
        .from('customers')
        .update({
          billing_token: billingToken,
          billing_token_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        })
        .eq('id', order.customer_id)

      await twilioClient.messages.create({
        body: sanitiseGsm7(`Card didn't go through on that one. Update your details at ${appUrl}/billing?token=${billingToken} and we'll get it sorted.`),
        from: process.env.TWILIO_PHONE_NUMBER!,
        to: customer.phone,
      })
    }
  }

  return NextResponse.json({ received: true })
}
