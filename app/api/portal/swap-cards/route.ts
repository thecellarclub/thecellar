import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getPortalSession } from '@/lib/portal-auth'
import { stripe } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  const session = await getPortalSession(req)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const sb = createServiceClient()

  const { data: customer } = await sb
    .from('customers')
    .select('id, stripe_customer_id, stripe_payment_method_id, backup_payment_method_id')
    .eq('id', session.customerId)
    .maybeSingle()

  if (!customer) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
  }

  if (!customer.backup_payment_method_id) {
    return NextResponse.json({ error: 'No backup card to swap with' }, { status: 400 })
  }

  // Swap primary <-> backup
  const newPrimary = customer.backup_payment_method_id
  const newBackup = customer.stripe_payment_method_id

  // Update default on Stripe customer
  await stripe.customers.update(customer.stripe_customer_id, {
    invoice_settings: { default_payment_method: newPrimary },
  })

  // Update DB
  await sb
    .from('customers')
    .update({
      stripe_payment_method_id: newPrimary,
      backup_payment_method_id: newBackup,
    })
    .eq('id', session.customerId)

  return NextResponse.json({ ok: true })
}
