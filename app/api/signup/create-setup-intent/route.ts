import { NextRequest, NextResponse } from 'next/server'
import { getSignupSession } from '@/lib/session'
import { createServiceClient } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 })
    }

    const session = await getSignupSession()

    if (!session.phone || !session.phoneVerified || !session.firstName || !session.stripeCustomerId) {
      return NextResponse.json({ error: 'Session expired. Please start again.' }, { status: 400 })
    }

    // Guard: email already registered by another customer
    const sb = createServiceClient()
    const { data: existingEmail } = await sb
      .from('customers').select('id').eq('email', email).maybeSingle()
    if (existingEmail) {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 })
    }

    // Reuse the Stripe customer created at Step 2 — do not create a second one
    const setupIntent = await stripe.setupIntents.create({
      customer: session.stripeCustomerId,
      usage: 'off_session',
    })

    session.setupIntentId = setupIntent.id
    session.email = email
    await session.save()

    return NextResponse.json({ clientSecret: setupIntent.client_secret })
  } catch (err) {
    console.error('[create-setup-intent]', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
