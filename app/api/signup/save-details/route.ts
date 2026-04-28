import { NextRequest, NextResponse } from 'next/server'
import { getSignupSession } from '@/lib/session'
import { createServiceClient } from '@/lib/supabase'
import { normaliseUKPhone } from '@/lib/phone'
import { stripe } from '@/lib/stripe'
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
    const session = await getSignupSession()

    if (!session.phone || !session.phoneVerified) {
      return NextResponse.json({ error: 'Session expired. Please start again.' }, { status: 400 })
    }

    const { firstName, lastName, dobDay, dobMonth, dobYear, ageConsent, marketingConsent } =
      await req.json()

    if (!firstName?.trim() || !lastName?.trim()) {
      return NextResponse.json({ error: 'Please fill in all required fields.' }, { status: 400 })
    }
    if (!ageConsent) {
      return NextResponse.json({ error: 'You must confirm you are 18 or over.' }, { status: 400 })
    }
    if (!marketingConsent) {
      return NextResponse.json({ error: 'SMS marketing consent is required to sign up.' }, { status: 400 })
    }

    const day = parseInt(dobDay, 10)
    const month = parseInt(dobMonth, 10)
    const year = parseInt(dobYear, 10)

    if (!day || !month || !year || year < 1900 || year > new Date().getFullYear()) {
      return NextResponse.json({ error: 'Please enter a valid date of birth.' }, { status: 400 })
    }

    const dob = new Date(year, month - 1, day)
    if (calculateAge(dob) < 18) {
      return NextResponse.json({ error: 'under_18' }, { status: 400 })
    }

    const sb = createServiceClient()
    const normalisedPhone = normaliseUKPhone(session.phone)

    // Guard: phone already registered
    const { data: existingPhone } = await sb
      .from('customers').select('id').eq('phone', normalisedPhone).maybeSingle()
    if (existingPhone) {
      return NextResponse.json({ error: 'looks_like_already_signed_up' }, { status: 409 })
    }

    // Create Stripe customer (no payment method yet — attached at Step 3)
    const stripeCustomer = await stripe.customers.create({
      phone: normalisedPhone,
      name: `${firstName.trim()} ${lastName.trim()}`,
      metadata: { signup_source: 'cellar_club_web' },
    })

    // Insert customer row with what we know now; email/card/address added at Steps 3 & 4
    const dobString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const { data: inserted, error: insertError } = await sb.from('customers').insert({
      phone: normalisedPhone,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      stripe_customer_id: stripeCustomer.id,
      dob: dobString,
      age_verified: true,
      active: true,
      gdpr_marketing_consent: true,
      gdpr_consent_at: new Date().toISOString(),
    }).select('id').single()

    if (insertError) {
      if (insertError.code === '23505') {
        return NextResponse.json({ error: 'looks_like_already_signed_up' }, { status: 409 })
      }
      throw insertError
    }

    // Persist IDs + name to session so Steps 3 and 4 can enrich the existing row
    session.customerId = inserted.id
    session.stripeCustomerId = stripeCustomer.id
    session.firstName = firstName.trim()
    session.lastName = lastName.trim()
    session.dobDay = day
    session.dobMonth = month
    session.dobYear = year
    await session.save()

    // Persist progress step
    const { error: progressError } = await sb
      .from('signup_progress')
      .upsert(
        {
          phone: session.phone,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          dob: dobString,
          age_verified: true,
          last_step: 'details',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'phone' }
      )
    if (progressError) console.error('[signup_progress] upsert failed:', progressError.message)

    // Send welcome SMS — failure is logged but must not block signup
    try {
      await sendSms(
        normalisedPhone,
        `Welcome, ${firstName.trim()}! It's Daniel from The Cellar Club.\n\nI'll text you whenever I find something special. If you fancy it, reply how many bottles.\n\nI'll store them in the cellar until you fill a case of 12, then deliver free.\n\nAnd if you've got a question or request, text me anytime.`
      )
    } catch (err) {
      console.error('[save-details] welcome SMS failed', err)
    }

    return NextResponse.json({ ok: true, welcomed: true })
  } catch (err) {
    console.error('[save-details]', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
