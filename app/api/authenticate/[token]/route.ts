import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'
import { isAuthTokenExpired } from '@/lib/tokens'

/**
 * GET /api/authenticate/[token]
 * Validates a 3DS auth token and returns the PaymentIntent client_secret
 * so the /authenticate page can complete 3DS via Stripe Elements.
 * Enforces 15-minute expiry.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  if (!token || token.length < 10) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 })
  }

  const sb = createServiceClient()

  const { data: order } = await sb
    .from('orders')
    .select('id, stripe_payment_intent_id, stripe_charge_status, created_at, customer_id')
    .eq('auth_token', token)
    .maybeSingle()

  if (!order) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
  }

  // Enforce 15-minute expiry
  if (isAuthTokenExpired(order.created_at)) {
    return NextResponse.json(
      {
        error:
          'This payment link has expired (15-minute limit). ' +
          'Reply with your quantity again to place a new order.',
      },
      { status: 410 }
    )
  }

  if (order.stripe_charge_status !== 'requires_action') {
    // Already completed or failed
    return NextResponse.json(
      { error: 'This payment has already been processed.' },
      { status: 409 }
    )
  }

  if (!order.stripe_payment_intent_id) {
    return NextResponse.json({ error: 'Payment reference missing' }, { status: 500 })
  }

  // Retrieve PaymentIntent to get the client_secret for Stripe Elements
  const pi = await stripe.paymentIntents.retrieve(order.stripe_payment_intent_id)

  return NextResponse.json({
    orderId: order.id,
    clientSecret: pi.client_secret,
    amount: pi.amount,
    currency: pi.currency,
  })
}
