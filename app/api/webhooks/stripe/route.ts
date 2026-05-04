import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase'
import { twilioClient, sanitiseGsm7 } from '@/lib/twilio'
import { handlePostCharge } from '@/lib/post-charge'
import { checkAndApplyTierUpgrade } from '@/lib/tiers'
import { notifyAdmin } from '@/lib/resend'
import { generateShortToken } from '@/lib/token'
import {
  paymentFailedT0,
  cardSavedOrderRecap,
  cardSavedNoOrder,
} from '@/lib/sms-templates'

/**
 * POST /api/webhooks/stripe
 *
 * Handles async Stripe events. Raw body is read via req.text() — Next.js App Router
 * does not auto-parse bodies, so signature verification works without any config.
 *
 * payment_intent.succeeded       → guard on order_status, update order to 'confirmed',
 *                                   call handlePostCharge (inserts cellar + sends SMS).
 * payment_intent.payment_failed  → move order to 'payment_failed' (stock stays reserved),
 *                                   send paymentFailedT0 SMS, notifyAdmin.
 * setup_intent.succeeded         → idempotent fallback for tab-close after card save.
 *
 * All handlers are idempotent.
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
      .select('id, customer_id, wine_id, quantity, total_pence, stripe_charge_status, order_status')
      .eq('stripe_payment_intent_id', pi.id)
      .maybeSingle()

    if (!order) return NextResponse.json({ received: true })

    // Guard: only process awaiting_confirmation orders
    if (order.order_status !== 'awaiting_confirmation') {
      return NextResponse.json({ received: true })
    }

    // Move to payment_failed — stock stays reserved for the retry window
    const now = new Date().toISOString()
    await sb
      .from('orders')
      .update({
        stripe_charge_status: 'failed',
        order_status: 'payment_failed',
        payment_failed_at: now,
        payment_failed_attempts: 1,
        payment_failed_last_message_at: now,
      })
      .eq('id', order.id)

    const { data: customer } = await sb
      .from('customers')
      .select('phone, first_name')
      .eq('id', order.customer_id)
      .maybeSingle()

    const { data: wine } = await sb
      .from('wines')
      .select('name')
      .eq('id', order.wine_id)
      .maybeSingle()

    if (customer?.phone) {
      const billingToken = generateShortToken()
      await sb
        .from('customers')
        .update({
          billing_token: billingToken,
          billing_token_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq('id', order.customer_id)

      await twilioClient.messages.create({
        body: sanitiseGsm7(paymentFailedT0(order.quantity, appUrl, billingToken)),
        from: process.env.TWILIO_PHONE_NUMBER!,
        to: customer.phone,
      })

      void notifyAdmin(
        `Payment failed — ${customer.first_name ?? customer.phone} — ${order.quantity} x ${wine?.name ?? 'wine'}`,
        `Customer: ${customer.first_name ?? ''} ${customer.phone}\nOrder: ${order.id}\nWine: ${wine?.name ?? ''}\nQty: ${order.quantity}\nTotal: £${(order.total_pence / 100).toFixed(2)}`,
        'members@thecellar.club'
      )
    }

  // ── setup_intent.succeeded ───────────────────────────────────────────────
  // Fallback for when the browser tab is closed before /api/billing/update-card fires.
  } else if (event.type === 'setup_intent.succeeded') {
    const si = event.data.object as Stripe.SetupIntent

    if (!si.customer || !si.payment_method) {
      return NextResponse.json({ received: true })
    }

    const stripeCustomerId = typeof si.customer === 'string' ? si.customer : si.customer.id
    const paymentMethodId = typeof si.payment_method === 'string' ? si.payment_method : si.payment_method.id

    const { data: customer } = await sb
      .from('customers')
      .select('id, phone, stripe_payment_method_id')
      .eq('stripe_customer_id', stripeCustomerId)
      .maybeSingle()

    if (!customer) {
      // Orphan setup intent — no customer record found
      void notifyAdmin(
        'Orphan setup intent',
        `setup_intent.succeeded fired but no customer found for stripe_customer_id=${stripeCustomerId}. SetupIntent: ${si.id}`,
        'members@thecellar.club'
      )
      return NextResponse.json({ received: true })
    }

    // Gate: if update-card already ran (PM already set), skip to avoid double SMS
    if (customer.stripe_payment_method_id) {
      return NextResponse.json({ received: true })
    }

    // Run the same DB updates as /api/billing/update-card
    await stripe.customers.update(stripeCustomerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    })

    await sb
      .from('customers')
      .update({
        stripe_payment_method_id: paymentMethodId,
        billing_token: null,
        billing_token_expires_at: null,
      })
      .eq('id', customer.id)

    // Get last4 for the recap SMS
    const pm = await stripe.paymentMethods.retrieve(paymentMethodId)
    const last4 = pm.card?.last4 ?? '????'

    // Look for a pending or failed order to recap
    const { data: pendingOrder } = await sb
      .from('orders')
      .select('id, quantity, total_pence, wine_id, wines(name)')
      .eq('customer_id', customer.id)
      .in('order_status', ['awaiting_confirmation', 'payment_failed'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle() as { data: { id: string; quantity: number; total_pence: number; wine_id: string; wines: { name: string } | null } | null }

    const smsBody = pendingOrder
      ? cardSavedOrderRecap(
          pendingOrder.quantity,
          pendingOrder.wines?.name ?? 'your wine',
          (pendingOrder.total_pence / 100).toFixed(2),
          last4
        )
      : cardSavedNoOrder()

    if (customer.phone) {
      await twilioClient.messages.create({
        body: sanitiseGsm7(smsBody),
        from: process.env.TWILIO_PHONE_NUMBER!,
        to: customer.phone,
      })
    }
  }

  return NextResponse.json({ received: true })
}
