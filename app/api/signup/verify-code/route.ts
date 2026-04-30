import { NextRequest, NextResponse } from 'next/server'
import { getSignupSession } from '@/lib/session'
import { createServiceClient } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json()

    if (!code || !/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: 'Please enter the 6-digit code' }, { status: 400 })
    }

    const session = await getSignupSession()

    if (!session.phone) {
      return NextResponse.json({ error: 'Session expired. Please start again.' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const now = new Date().toISOString()

    // Find the most recent valid code for this phone
    const { data: record, error: fetchError } = await supabase
      .from('verification_codes')
      .select('id, code, used, expires_at, attempt_count')
      .eq('phone', session.phone)
      .eq('used', false)
      .gte('expires_at', now)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (fetchError || !record) {
      return NextResponse.json(
        { error: 'Code not found or expired. Please request a new one.' },
        { status: 400 }
      )
    }

    // Check attempt count before comparing (block at 3+)
    if (record.attempt_count >= 3) {
      return NextResponse.json(
        { error: 'too_many_attempts' },
        { status: 429 }
      )
    }

    if (record.code !== code) {
      // Increment attempt count
      await supabase
        .from('verification_codes')
        .update({ attempt_count: record.attempt_count + 1 })
        .eq('id', record.id)

      const attemptsLeft = 2 - record.attempt_count
      if (attemptsLeft <= 0) {
        return NextResponse.json({ error: 'too_many_attempts' }, { status: 429 })
      }

      return NextResponse.json(
        { error: `Incorrect code. ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} remaining.` },
        { status: 400 }
      )
    }

    // Valid — mark as used
    await supabase
      .from('verification_codes')
      .update({ used: true })
      .eq('id', record.id)

    // Create or reuse the customers row — idempotent on phone
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('id, stripe_customer_id')
      .eq('phone', session.phone)
      .maybeSingle()

    let customerId: string
    let stripeCustomerId: string

    if (existingCustomer) {
      customerId = existingCustomer.id
      stripeCustomerId = existingCustomer.stripe_customer_id
    } else {
      const stripeCustomer = await stripe.customers.create({
        phone: session.phone,
        metadata: { signup_source: 'cellar_club_web' },
      })
      stripeCustomerId = stripeCustomer.id

      const { data: newCustomer, error: insertError } = await supabase
        .from('customers')
        .insert({ phone: session.phone, stripe_customer_id: stripeCustomerId, active: true })
        .select('id')
        .single()

      if (insertError) throw insertError
      customerId = newCustomer.id
    }

    // Mark phone as verified in session and stash customer IDs
    session.phoneVerified = true
    session.customerId = customerId
    session.stripeCustomerId = stripeCustomerId
    await session.save()

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[verify-code]', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
