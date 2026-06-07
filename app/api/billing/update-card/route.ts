import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'
import { twilioClient, sanitiseGsm7 } from '@/lib/twilio'
import { cardSavedOrderRecap, cardSavedNoOrder } from '@/lib/sms-templates'

/**
 * POST /api/billing/update-card
 *
 * Token-based (no auth required). Called by BillingForm after Stripe SetupIntent
 * succeeds. Attaches the new payment method to the Stripe customer, sets it as
 * the default, clears the billing token on the customer row, and sends either:
 *   - cardSavedOrderRecap (if a pending/failed order exists) — customer replies YES
 *   - cardSavedNoOrder (no pending order)
 *
 * Body: { billingToken: string, paymentMethodId: string }
 */
export async function POST(req: NextRequest) {
  let billingToken: string
  let paymentMethodId: string

  try {
    const body = await req.json()
    billingToken = body.billingToken
    paymentMethodId = body.paymentMethodId
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  if (!billingToken || !paymentMethodId) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
  }

  const sb = createServiceClient()

  // Look up customer by billing token
  const { data: customer } = await sb
    .from('customers')
    .select('id, phone, stripe_customer_id, billing_token_expires_at, welcome_sent_at')
    .eq('billing_token', billingToken)
    .not('billing_token', 'is', null)
    .maybeSingle()

  if (!customer) {
    return NextResponse.json({ error: 'Invalid or expired link.' }, { status: 404 })
  }

  // Check expiry
  if (new Date(customer.billing_token_expires_at) < new Date()) {
    return NextResponse.json(
      { error: 'This link has expired. Reply to your last text to get a fresh one.' },
      { status: 410 }
    )
  }

  // Attach payment method to Stripe customer
  await stripe.paymentMethods.attach(paymentMethodId, {
    customer: customer.stripe_customer_id,
  })

  // Set as default payment method
  await stripe.customers.update(customer.stripe_customer_id, {
    invoice_settings: { default_payment_method: paymentMethodId },
  })

  // Get last4 from the payment method
  const pm = await stripe.paymentMethods.retrieve(paymentMethodId)
  const last4 = pm.card?.last4 ?? '????'

  // Update Supabase — save new PM, clear billing token
  await sb
    .from('customers')
    .update({
      stripe_payment_method_id: paymentMethodId,
      billing_token: null,
      billing_token_expires_at: null,
    })
    .eq('id', customer.id)

  // Look for a pending or failed order to recap
  const { data: pendingOrder } = await sb
    .from('orders')
    .select('id, quantity, price_pence, total_pence, wine_id, wines(name)')
    .eq('customer_id', customer.id)
    .in('order_status', ['awaiting_confirmation', 'payment_failed'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle() as { data: { id: string; quantity: number; price_pence: number; total_pence: number; wine_id: string; wines: { name: string } | null } | null }

  // Only send an SMS if:
  //   a) There's a pending order to recap (always useful), or
  //   b) This is an existing member updating their card (welcome already sent).
  // During initial signup (welcome_sent_at is null) the welcome cron handles
  // the "you're all set" messaging — no need for a redundant card-saved text.
  const isSignup = !customer.welcome_sent_at

  if (pendingOrder) {
    await twilioClient.messages.create({
      body: sanitiseGsm7(cardSavedOrderRecap(
        pendingOrder.quantity,
        pendingOrder.wines?.name ?? 'your wine',
        (pendingOrder.total_pence / 100).toFixed(2),
        last4
      )),
      from: process.env.TWILIO_PHONE_NUMBER!,
      to: customer.phone,
    })
  } else if (!isSignup) {
    await twilioClient.messages.create({
      body: sanitiseGsm7(cardSavedNoOrder()),
      from: process.env.TWILIO_PHONE_NUMBER!,
      to: customer.phone,
    })
  }

  return NextResponse.json({ ok: true })
}
