import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'
import { twilioClient, sanitiseGsm7 } from '@/lib/twilio'

/**
 * POST /api/billing/update-card
 *
 * Token-based (no auth required). Called by BillingForm after Stripe SetupIntent
 * succeeds. Attaches the new payment method to the Stripe customer, sets it as
 * the default, clears the billing token on the customer row, and sends a
 * confirmation SMS.
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
    .select('id, phone, stripe_customer_id, billing_token_expires_at')
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

  // Update Supabase — save new PM, clear billing token
  await sb
    .from('customers')
    .update({
      stripe_payment_method_id: paymentMethodId,
      billing_token: null,
      billing_token_expires_at: null,
    })
    .eq('id', customer.id)

  // Send confirmation SMS
  await twilioClient.messages.create({
    body: sanitiseGsm7(`Card updated - text us again to complete your order.`),
    from: process.env.TWILIO_PHONE_NUMBER!,
    to: customer.phone,
  })

  return NextResponse.json({ ok: true })
}
