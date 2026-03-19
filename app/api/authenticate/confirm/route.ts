import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'
import { handlePostCharge } from '@/lib/post-charge'

/**
 * POST /api/authenticate/confirm
 * Body: { orderId: string }
 *
 * Called by AuthenticateForm after stripe.confirmCardPayment() succeeds (3DS).
 * Verifies the PI status from Stripe (source of truth), marks the order confirmed,
 * and calls handlePostCharge (inserts cellar row + sends SMS).
 *
 * Stock was already decremented when the pending order was created — do NOT
 * decrement again here.
 *
 * Idempotent: guards on order_status === 'awaiting_confirmation'.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { orderId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { orderId } = body
  if (!orderId) {
    return NextResponse.json({ error: 'orderId is required' }, { status: 400 })
  }

  const sb = createServiceClient()

  // ── Fetch order ──────────────────────────────────────────────────────────
  const { data: order } = await sb
    .from('orders')
    .select('id, customer_id, wine_id, quantity, stripe_payment_intent_id, stripe_charge_status, order_status')
    .eq('id', orderId)
    .maybeSingle()

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  // Guard: only process orders awaiting confirmation
  if (order.order_status !== 'awaiting_confirmation') {
    return NextResponse.json({ error: 'Order already processed' }, { status: 409 })
  }

  // ── Verify PI from Stripe (source of truth) ───────────────────────────────
  const pi = await stripe.paymentIntents.retrieve(order.stripe_payment_intent_id)

  if (pi.status !== 'succeeded') {
    return NextResponse.json(
      { error: 'Payment not yet confirmed' },
      { status: 400 }
    )
  }

  // ── Update order status ───────────────────────────────────────────────────
  await sb
    .from('orders')
    .update({ stripe_charge_status: 'succeeded', order_status: 'confirmed' })
    .eq('id', orderId)

  // ── Fetch customer phone and wine name ────────────────────────────────────
  const [{ data: customer }, { data: wine }] = await Promise.all([
    sb.from('customers').select('phone').eq('id', order.customer_id).maybeSingle(),
    sb.from('wines').select('name').eq('id', order.wine_id).maybeSingle(),
  ])

  // ── Post-charge: insert cellar row + send SMS ─────────────────────────────
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
  }

  return NextResponse.json({ ok: true })
}
