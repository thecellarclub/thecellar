import { NextRequest, NextResponse } from 'next/server'
import { getSignupSession } from '@/lib/session'
import { createServiceClient } from '@/lib/supabase'
import { twilioClient, sanitiseGsm7 } from '@/lib/twilio'
import { normaliseUKPhone } from '@/lib/phone'
import { isAllowed, getClientIp } from '@/lib/rateLimit'

const ONE_HOUR_MS = 60 * 60 * 1000

export async function POST(req: NextRequest) {
  try {
    // ── IP-based rate limit: 10 requests per IP per hour ─────────────────
    const ip = getClientIp(req)
    if (!isAllowed(`ip:${ip}`, 10, ONE_HOUR_MS)) {
      return NextResponse.json(
        { error: 'Too many requests from this device. Please try again later.' },
        { status: 429 }
      )
    }

    const { phone: rawPhone } = await req.json()

    if (!rawPhone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })
    }

    let phone: string
    try {
      phone = normaliseUKPhone(rawPhone)
    } catch (e: unknown) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : 'Invalid phone number' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    // ── Phone-based rate limit: 3 SMS sends per phone per hour ───────────
    // Uses the database as backing store — persists across restarts and works
    // correctly across multiple serverless instances (unlike in-memory).
    const oneHourAgo = new Date(Date.now() - ONE_HOUR_MS).toISOString()

    const { count } = await supabase
      .from('verification_codes')
      .select('id', { count: 'exact', head: true })
      .eq('phone', phone)
      .gte('created_at', oneHourAgo)

    if ((count ?? 0) >= 3) {
      return NextResponse.json(
        { error: 'Too many codes sent to this number. Please wait an hour before trying again.' },
        { status: 429 }
      )
    }

    // Only block fully signed-up customers (card on file). Partial rows from a
    // previous abandoned Step 1 should not prevent re-sending a code.
    const { data: existing } = await supabase
      .from('customers')
      .select('stripe_payment_method_id')
      .eq('phone', phone)
      .maybeSingle()

    if (existing?.stripe_payment_method_id) {
      return NextResponse.json(
        { error: 'looks_like_already_signed_up' },
        { status: 409 }
      )
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    const { error: insertError } = await supabase
      .from('verification_codes')
      .insert({ phone, code, expires_at: expiresAt })

    if (insertError) throw insertError

    // Send SMS
    try {
      await twilioClient.messages.create({
        body: sanitiseGsm7(`Your The Cellar Club verification code is: ${code}`),
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phone,
      })
    } catch (twilioErr: unknown) {
      console.error('[send-code] Twilio error:', twilioErr)
      const msg = twilioErr instanceof Error ? twilioErr.message : 'Failed to send SMS'
      return NextResponse.json({ error: `Could not send SMS: ${msg}` }, { status: 502 })
    }

    // Store phone in session (unverified)
    const session = await getSignupSession()
    session.phone = phone
    session.phoneVerified = false
    await session.save()

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[send-code]', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
