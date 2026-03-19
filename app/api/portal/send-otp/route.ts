import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { twilioClient } from '@/lib/twilio'
import { normaliseUKPhone } from '@/lib/phone'

export async function POST(req: NextRequest) {
  const { phone } = await req.json()

  if (!phone) {
    return NextResponse.json({ error: 'Phone number required' }, { status: 400 })
  }

  const normalised = normaliseUKPhone(phone)
  if (!normalised) {
    return NextResponse.json({ error: 'Invalid UK phone number' }, { status: 400 })
  }

  const sb = createServiceClient()

  // Only allow existing customers to log in
  const { data: customer } = await sb
    .from('customers')
    .select('id')
    .eq('phone', normalised)
    .maybeSingle()

  if (!customer) {
    // Don't reveal whether number exists — just say code sent
    return NextResponse.json({ ok: true })
  }

  // Rate limit: max 3 OTPs per phone per hour
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count } = await sb
    .from('verification_codes')
    .select('*', { count: 'exact', head: true })
    .eq('phone', normalised)
    .gte('created_at', since)

  if ((count ?? 0) >= 3) {
    return NextResponse.json({ error: 'Too many attempts. Try again in an hour.' }, { status: 429 })
  }

  // Generate 6-digit code
  const code = String(Math.floor(100000 + Math.random() * 900000))
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

  await sb.from('verification_codes').insert({
    phone: normalised,
    code,
    expires_at: expiresAt,
    used: false,
    attempt_count: 0,
  })

  await twilioClient.messages.create({
    to: normalised,
    from: process.env.TWILIO_PHONE_NUMBER!,
    body: `Your Cellar Club login code is ${code}. It expires in 10 minutes.`,
  })

  return NextResponse.json({ ok: true })
}
