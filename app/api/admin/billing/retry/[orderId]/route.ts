import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'
import { requireAdminSession } from '@/lib/adminAuth'
import Stripe from 'stripe'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const auth = await requireAdminSession()
  if (!auth.ok) return auth.response

  const { orderId } = await params
  const sb = createServiceClient()

  // Fetch the order and customer
  const { data: order } = await sb
    .from('orders')
    .select('id, wine_id, text_id, quantity, price_pence, total_pence, stripe_charge_status, customers(*)')
    .eq('id', orderId)
    .maybeSingle()

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  if (!['failed', 'requires_action'].includes(order.stripe_charge_status)) {
    return NextResponse.json({ error: 'Order is not in a retryable state' }, { status: 400 })
  }

  const customer = order.customers as unknown as Record<string, string>

  if (!customer?.stripe_customer_id || !customer?.stripe_payment_method_id) {
    return NextResponse.json({ error: 'Customer has no saved payment method' }, { status: 400 })
  }

  // Check cellar not already populated for this order (idempotency)
  const { data: existingCellar } = await sb
    .from('cellar')
    .select('id')
    .eq('order_id', orderId)
    .maybeSingle()

  if (existingCellar) {
    return NextResponse.json({ error: 'Cellar entry already exists for this order' }, { status: 409 })
  }

  let paymentIntent: Stripe.PaymentIntent

  try {
    paymentIntent = await stripe.paymentIntents.create({
      amount: order.total_pence,
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
        await sb.from('orders').update({
          stripe_charge_status: 'requires_action',
          stripe_payment_intent_id: pi?.id ?? null,
          auth_token: token,
        }).eq('id', orderId)

        return NextResponse.json({
          ok: false,
          status: 'requires_action',
          authenticateUrl: `${process.env.NEXT_PUBLIC_APP_URL}/authenticate?token=${token}`,
        })
      }

      await sb.from('orders').update({
        stripe_charge_status: 'failed',
        stripe_payment_intent_id: pi?.id ?? null,
      }).eq('id', orderId)

      return NextResponse.json({ ok: false, status: 'failed', error: err.message })
    }

    console.error('[billing/retry] Stripe error', err)
    return NextResponse.json({ error: 'Payment error' }, { status: 500 })
  }

  if (paymentIntent.status === 'succeeded') {
    // Update order
    await sb.from('orders').update({
      stripe_charge_status: 'succeeded',
      stripe_payment_intent_id: paymentIntent.id,
    }).eq('id', orderId)

    // Add to cellar
    await sb.from('cellar').insert({
      customer_id: customer.id,
      wine_id: order.wine_id,
      order_id: orderId,
      quantity: order.quantity,
    })

    // Decrement stock
    const { data: wine } = await sb.from('wines').select('stock_bottles').eq('id', order.wine_id).maybeSingle()
    if (wine) {
      await sb.from('wines').update({ stock_bottles: Math.max(0, wine.stock_bottles - order.quantity) }).eq('id', order.wine_id)
    }

    return NextResponse.json({ ok: true, status: 'succeeded' })
  }

  // requires_action returned (not thrown)
  if (paymentIntent.status === 'requires_action') {
    const token = crypto.randomUUID()
    await sb.from('orders').update({
      stripe_charge_status: 'requires_action',
      stripe_payment_intent_id: paymentIntent.id,
      auth_token: token,
    }).eq('id', orderId)

    return NextResponse.json({
      ok: false,
      status: 'requires_action',
      authenticateUrl: `${process.env.NEXT_PUBLIC_APP_URL}/authenticate?token=${token}`,
    })
  }

  await sb.from('orders').update({ stripe_charge_status: 'failed' }).eq('id', orderId)
  return NextResponse.json({ ok: false, status: 'failed' })
}
