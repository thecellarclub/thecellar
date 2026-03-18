import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase'
import { twilioClient } from '@/lib/twilio'

/**
 * POST /api/webhooks/stripe
 *
 * Handles async Stripe events. Raw body is read via req.text() — Next.js App Router
 * does not auto-parse bodies, so signature verification works without any config.
 *
 * payment_intent.succeeded     → update order, insert cellar, decrement stock.
 *                                 If the order was previously requires_action (3DS just
 *                                 completed), send a payment confirmation SMS. If this
 *                                 pushed the customer's cellar to ≥12 for the first time,
 *                                 send the 12-bottle notification as a second message.
 *
 * payment_intent.payment_failed → update order to failed, SMS customer with /billing link.
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
      .select('id, customer_id, wine_id, quantity, stripe_charge_status')
      .eq('stripe_payment_intent_id', pi.id)
      .maybeSingle()

    if (!order) return NextResponse.json({ received: true })

    // Idempotent — inbound webhook may have already processed this synchronously
    if (order.stripe_charge_status === 'succeeded') {
      return NextResponse.json({ received: true })
    }

    const previousStatus = order.stripe_charge_status

    // 1. Update order
    await sb
      .from('orders')
      .update({ stripe_charge_status: 'succeeded' })
      .eq('id', order.id)

    // 2. Insert cellar entry
    await sb.from('cellar').insert({
      customer_id: order.customer_id,
      wine_id: order.wine_id,
      order_id: order.id,
      quantity: order.quantity,
    })

    // 3. Decrement stock
    const { data: wine } = await sb
      .from('wines')
      .select('name, price_pence, stock_bottles')
      .eq('id', order.wine_id)
      .maybeSingle()

    if (wine && wine.stock_bottles >= order.quantity) {
      await sb
        .from('wines')
        .update({ stock_bottles: wine.stock_bottles - order.quantity })
        .eq('id', order.wine_id)
    }

    // 4. Only SMS if this was a 3DS completion (requires_action → succeeded).
    //    If it was inline (pending → succeeded), the inbound webhook already messaged them.
    if (previousStatus === 'requires_action') {
      const { data: customer } = await sb
        .from('customers')
        .select('phone')
        .eq('id', order.customer_id)
        .maybeSingle()

      if (customer) {
        // Current cellar total (view reflects the row we just inserted)
        const { data: cellarTotal } = await sb
          .from('customer_cellar_totals')
          .select('total_bottles')
          .eq('customer_id', order.customer_id)
          .maybeSingle()

        const newTotal = Number(cellarTotal?.total_bottles ?? 0)
        const oldTotal = newTotal - order.quantity

        // Payment confirmation
        await twilioClient.messages.create({
          body:
            `Sorted — your card's been verified and ${order.quantity} bottle${order.quantity !== 1 ? 's' : ''} ` +
            `of ${wine?.name ?? 'your wine'} ${order.quantity !== 1 ? 'are' : 'is'} in your cellar. ` +
            `You've got ${newTotal} stored now.`,
          from: process.env.TWILIO_PHONE_NUMBER!,
          to: customer.phone,
        })

        // 5. 12-bottle auto-notification (separate message, only fires once — first time ≥12)
        if (oldTotal < 12 && newTotal >= 12) {
          // Fetch full cellar contents to build the wine list
          const { data: cellarRows } = await sb
            .from('cellar')
            .select('quantity, wines(name, price_pence)')
            .eq('customer_id', order.customer_id)
            .is('shipped_at', null)

          // Aggregate by wine name
          const wineMap = new Map<string, { qty: number; pricePence: number }>()
          for (const row of cellarRows ?? []) {
            const w = row.wines as unknown as { name: string; price_pence: number } | null
            if (!w) continue
            const existing = wineMap.get(w.name)
            if (existing) {
              existing.qty += row.quantity
            } else {
              wineMap.set(w.name, { qty: row.quantity, pricePence: w.price_pence })
            }
          }

          const wineList = Array.from(wineMap.entries())
            .map(([name, { qty, pricePence }]) => `- ${qty}x ${name} (£${(pricePence / 100).toFixed(0)}/bottle)`)
            .join('\n')

          await twilioClient.messages.create({
            body:
              `Your cellar just hit 12 bottles — nice work. Here's what you've got:\n` +
              `${wineList}\n` +
              `We'll ship your case tomorrow, free of charge. Reply PAUSE if you'd like to hold it.`,
            from: process.env.TWILIO_PHONE_NUMBER!,
            to: customer.phone,
          })
        }
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
        body: `Card didn't go through on that one. Update your details at ${appUrl}/billing and we'll get it sorted.`,
        from: process.env.TWILIO_PHONE_NUMBER!,
        to: customer.phone,
      })
    }
  }

  return NextResponse.json({ received: true })
}
