import { NextRequest, NextResponse } from 'next/server'
import { getSignupSession } from '@/lib/session'
import { createServiceClient } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'
import { normaliseUKPhone } from '@/lib/phone'
import { sendSms } from '@/lib/twilio'

function calculateAge(dob: Date): number {
  const today = new Date()
  let age = today.getFullYear() - dob.getFullYear()
  const m = today.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--
  return age
}

export async function POST(req: NextRequest) {
  try {
    const { firstName, dobDay, dobMonth, dobYear, ageConsent, marketingConsent } =
      await req.json()

    // Validate required fields
    if (!firstName?.trim()) {
      return NextResponse.json({ error: 'First name is required' }, { status: 400 })
    }
    if (!dobDay || !dobMonth || !dobYear) {
      return NextResponse.json({ error: 'Date of birth is required' }, { status: 400 })
    }
    if (!ageConsent) {
      return NextResponse.json({ error: 'You must confirm you are 18 or over' }, { status: 400 })
    }
    if (!marketingConsent) {
      return NextResponse.json({ error: 'SMS marketing consent is required to sign up' }, { status: 400 })
    }

    // Build and validate DOB
    const dob = new Date(
      parseInt(dobYear),
      parseInt(dobMonth) - 1,
      parseInt(dobDay)
    )
    if (isNaN(dob.getTime())) {
      return NextResponse.json({ error: 'Invalid date of birth' }, { status: 400 })
    }
    if (calculateAge(dob) < 18) {
      return NextResponse.json(
        { error: 'under_18' },
        { status: 400 }
      )
    }

    // Check session is complete
    const session = await getSignupSession()
    if (!session.phone || !session.phoneVerified || !session.stripeCustomerId) {
      return NextResponse.json({ error: 'Session expired. Please start again.' }, { status: 400 })
    }

    let normalisedPhone: string
    try {
      normalisedPhone = normaliseUKPhone(session.phone)
    } catch {
      return NextResponse.json({ error: 'Invalid phone in session. Please start again.' }, { status: 400 })
    }

    // Get payment method — prefer one stored in session, else retrieve from SetupIntent
    let paymentMethodId = session.paymentMethodId
    if (!paymentMethodId && session.setupIntentId) {
      const si = await stripe.setupIntents.retrieve(session.setupIntentId)
      paymentMethodId = typeof si.payment_method === 'string'
        ? si.payment_method
        : si.payment_method?.id
    }

    if (!paymentMethodId) {
      return NextResponse.json({ error: 'No payment method found. Please add your card again.' }, { status: 400 })
    }

    // Get email from Stripe customer
    const stripeCustomer = await stripe.customers.retrieve(session.stripeCustomerId)
    if (stripeCustomer.deleted) {
      return NextResponse.json({ error: 'Stripe customer not found. Please start again.' }, { status: 400 })
    }
    const email = stripeCustomer.email

    if (!email) {
      return NextResponse.json({ error: 'Email not found. Please start again.' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Check phone/email not already taken (race condition guard)
    const { data: existingPhone } = await supabase
      .from('customers')
      .select('id')
      .eq('phone', normalisedPhone)
      .single()

    if (existingPhone) {
      return NextResponse.json({ error: 'looks_like_already_signed_up' }, { status: 409 })
    }

    // Create customer record
    const dobString = `${dobYear}-${String(dobMonth).padStart(2, '0')}-${String(dobDay).padStart(2, '0')}`

    const { error: insertError } = await supabase.from('customers').insert({
      phone: normalisedPhone,
      email,
      first_name: firstName.trim(),
      stripe_customer_id: session.stripeCustomerId,
      stripe_payment_method_id: paymentMethodId,
      dob: dobString,
      age_verified: true,
      active: true,
      gdpr_marketing_consent: true,
      gdpr_consent_at: new Date().toISOString(),
    })

    if (insertError) {
      // Unique constraint violation on email
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: 'An account with this email already exists.' },
          { status: 409 }
        )
      }
      throw insertError
    }

    // Set the payment method as default on the Stripe customer
    await stripe.customers.update(session.stripeCustomerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    })

    // Send welcome SMS — non-blocking, don't fail signup if this errors
    sendSms(
      normalisedPhone,
      `Welcome to The Cellar Club, ${firstName.trim()}! Save this number as "The Cellar Club" so you recognise it when we text. Daniel will be in touch with your first drop soon.`
    ).catch((err) => console.error('[complete] welcome SMS failed', err))

    // Clear session
    session.destroy()

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[complete]', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
