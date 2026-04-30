import { NextRequest, NextResponse } from 'next/server'
import { getSignupSession } from '@/lib/session'
import { createServiceClient } from '@/lib/supabase'

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

    if (!session.phone || !session.phoneVerified || !session.customerId) {
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
    const dobString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

    // Update the existing customers row created at Step 1
    const { error: updateError } = await sb
      .from('customers')
      .update({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        dob: dobString,
        age_verified: true,
        gdpr_marketing_consent: true,
        gdpr_consent_at: new Date().toISOString(),
        welcome_pending_at: new Date().toISOString(),
      })
      .eq('id', session.customerId)

    if (updateError) {
      if (updateError.code === '23505') {
        return NextResponse.json({ error: 'looks_like_already_signed_up' }, { status: 409 })
      }
      throw updateError
    }

    // Stash name + DOB in session for downstream steps
    session.firstName = firstName.trim()
    session.lastName = lastName.trim()
    session.dobDay = day
    session.dobMonth = month
    session.dobYear = year
    await session.save()

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[save-details]', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
