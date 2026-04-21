import { NextRequest, NextResponse } from 'next/server'
import { getPortalSession } from '@/lib/portal-auth'
import { createServiceClient } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  const session = await getPortalSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const sb = createServiceClient()
  const { data: customer } = await sb
    .from('customers')
    .select('stripe_customer_id')
    .eq('id', session.customerId)
    .maybeSingle()

  if (!customer?.stripe_customer_id) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
  }

  const setupIntent = await stripe.setupIntents.create({
    customer: customer.stripe_customer_id,
    usage: 'off_session',
  })

  return NextResponse.json({ clientSecret: setupIntent.client_secret })
}
