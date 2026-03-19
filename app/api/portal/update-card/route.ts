import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getPortalSession } from '@/lib/portal-auth'
import { stripe } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  const session = await getPortalSession(req)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { setupIntentId } = await req.json()
  if (!setupIntentId) {
    return NextResponse.json({ error: 'setupIntentId required' }, { status: 400 })
  }

  const sb = createServiceClient()

  // Fetch customer for stripe_customer_id
  const { data: customer } = await sb
    .from('customers')
    .select('id, stripe_customer_id, stripe_payment_method_id')
    .eq('id', session.customerId)
    .maybeSingle()

  if (!customer) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
  }

  // Retrieve the SetupIntent to get the new payment method
  const si = await stripe.setupIntents.retrieve(setupIntentId)
  if (si.status !== 'succeeded' || !si.payment_method) {
    return NextResponse.json({ error: 'Setup intent not completed' }, { status: 400 })
  }

  const newPmId = typeof si.payment_method === 'string' ? si.payment_method : si.payment_method.id

  // Attach to Stripe customer if needed
  await stripe.paymentMethods.attach(newPmId, { customer: customer.stripe_customer_id }).catch(() => {
    // Already attached — safe to ignore
  })

  // Set as default payment method on Stripe customer
  await stripe.customers.update(customer.stripe_customer_id, {
    invoice_settings: { default_payment_method: newPmId },
  })

  // Update DB — new card becomes primary
  await sb
    .from('customers')
    .update({ stripe_payment_method_id: newPmId })
    .eq('id', session.customerId)

  return NextResponse.json({ ok: true })
}
