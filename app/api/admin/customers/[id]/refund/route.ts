import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'
import { twilioClient } from '@/lib/twilio'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { cellarId, quantity } = body as { cellarId: string; quantity: number }

  if (!cellarId || !quantity || !Number.isInteger(quantity) || quantity < 1) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const sb = createServiceClient()

  // 1. Fetch cellar row, scoped to this customer
  const { data: cellarRow } = await sb
    .from('cellar')
    .select('id, order_id, customer_id, quantity, wine_id, shipped_at')
    .eq('id', cellarId)
    .eq('customer_id', id)
    .maybeSingle()

  if (!cellarRow) {
    return NextResponse.json({ error: 'Cellar entry not found' }, { status: 404 })
  }

  // 2. Quantity guard
  if (quantity > cellarRow.quantity) {
    return NextResponse.json(
      { error: 'Cannot refund more bottles than in cellar' },
      { status: 400 }
    )
  }

  // 3. Fetch order for price + payment intent
  let price_pence = 0
  let stripe_payment_intent_id: string | null = null
  let order_id: string | null = cellarRow.order_id ?? null

  if (cellarRow.order_id) {
    const { data: order } = await sb
      .from('orders')
      .select('price_pence, stripe_payment_intent_id')
      .eq('id', cellarRow.order_id)
      .maybeSingle()

    if (order) {
      price_pence = order.price_pence ?? 0
      stripe_payment_intent_id = order.stripe_payment_intent_id ?? null
    }
  }

  const refund_amount = quantity * price_pence

  // 4. Issue Stripe refund (wrapped in try/catch — Stripe throws on failure)
  let stripeRefundId: string | null = null
  if (stripe_payment_intent_id && refund_amount > 0) {
    try {
      const stripeRefund = await stripe.refunds.create({
        payment_intent: stripe_payment_intent_id,
        amount: refund_amount,
      })
      stripeRefundId = stripeRefund.id
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Stripe refund failed'
      return NextResponse.json({ error: message }, { status: 400 })
    }
  }

  // 5. Record refund in DB
  await sb.from('refunds').insert({
    order_id: order_id,
    customer_id: id,
    cellar_id: cellarId,
    quantity,
    amount_pence: refund_amount,
    stripe_refund_id: stripeRefundId,
    reason: 'admin_refund',
  })

  // 6. Remove or decrement cellar entry — only if not yet shipped (preserve shipment history)
  if (!cellarRow.shipped_at) {
    if (quantity === cellarRow.quantity) {
      await sb.from('cellar').delete().eq('id', cellarId)
    } else {
      await sb
        .from('cellar')
        .update({ quantity: cellarRow.quantity - quantity })
        .eq('id', cellarId)
    }
  }

  // 7. Send SMS to customer if a refund amount was issued
  if (refund_amount > 0) {
    const { data: customer } = await sb
      .from('customers')
      .select('phone')
      .eq('id', id)
      .maybeSingle()

    if (customer?.phone) {
      const amountStr = (refund_amount / 100).toFixed(2)
      await twilioClient.messages.create({
        to: customer.phone,
        from: process.env.TWILIO_PHONE_NUMBER!,
        body: `Your refund of £${amountStr} is on its way — expect it back in 3–5 working days. Thanks for your patience.`,
      }).catch((e) => console.error('SMS send failed after refund:', e))
    }
  }

  return NextResponse.json({ ok: true, refundedPence: refund_amount })
}
