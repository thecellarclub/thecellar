import { NextRequest, NextResponse } from 'next/server'
import { getSignupSession } from '@/lib/session'
import { createServiceClient } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'
import { normaliseUKPhone } from '@/lib/phone'
import { sendSms } from '@/lib/twilio'

export async function POST(req: NextRequest) {
  try {
    // Read address from request body (submitted by AddressForm)
    const { line1, line2, city, postcode } = await req.json()

    if (!line1?.trim() || !city?.trim() || !postcode?.trim()) {
      return NextResponse.json({ error: 'Please fill in your address, city and postcode.' }, { status: 400 })
    }

    // Read everything else from session (saved by save-details)
    const session = await getSignupSession()

    if (
      !session.phone ||
      !session.phoneVerified ||
      !session.stripeCustomerId ||
      !session.paymentMethodId ||
      !session.firstName ||
      !session.lastName ||
      !session.email ||
      !session.dobDay ||
      !session.dobMonth ||
      !session.dobYear
    ) {
      return NextResponse.json({ error: 'Session expired. Please start again.' }, { status: 400 })
    }

    let normalisedPhone: string
    try {
      normalisedPhone = normaliseUKPhone(session.phone)
    } catch {
      return NextResponse.json({ error: 'Invalid phone in session. Please start again.' }, { status: 400 })
    }

    const paymentMethodId = session.paymentMethodId

    const supabase = createServiceClient()

    // Race condition guard: phone already registered
    const { data: existingPhone } = await supabase
      .from('customers').select('id').eq('phone', normalisedPhone).maybeSingle()
    if (existingPhone) {
      return NextResponse.json({ error: 'looks_like_already_signed_up' }, { status: 409 })
    }

    const dobString = `${session.dobYear}-${String(session.dobMonth).padStart(2, '0')}-${String(session.dobDay).padStart(2, '0')}`

    // Create customer record with default_address from this request
    const { error: insertError } = await supabase.from('customers').insert({
      phone: normalisedPhone,
      email: session.email,
      first_name: session.firstName,
      last_name: session.lastName,
      stripe_customer_id: session.stripeCustomerId,
      stripe_payment_method_id: paymentMethodId,
      dob: dobString,
      age_verified: true,
      active: true,
      gdpr_marketing_consent: true,
      gdpr_consent_at: new Date().toISOString(),
      default_address: {
        line1: line1.trim(),
        line2: line2?.trim() || null,
        city: city.trim(),
        postcode: postcode.trim().toUpperCase(),
      },
    })

    if (insertError) {
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: 'An account with this email already exists.' },
          { status: 409 }
        )
      }
      throw insertError
    }

    // Set payment method as default on Stripe customer
    await stripe.customers.update(session.stripeCustomerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    })

    // Send welcome SMS — awaited so it completes before the serverless function exits
    try {
      await sendSms(
        normalisedPhone,
        `A hearty welcome to The Cellar Club, ${session.firstName}! Save this number so you know it's us.\n\nDaniel will send two hand-picked offers each week. If you fancy one, just tell us how many bottles.\n\nWe'll store it all until you've filled a case of 12 - then deliver it to you for free.`
      )
    } catch (err) {
      console.error('[complete] welcome SMS failed', err)
    }

    // Clear session
    session.destroy()

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[complete]', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
