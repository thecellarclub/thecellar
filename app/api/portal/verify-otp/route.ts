import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { signPortalToken, COOKIE_NAME } from '@/lib/portal-auth'
import { normaliseUKPhone } from '@/lib/phone'

const COOKIE_MAX_AGE = 30 * 24 * 60 * 60 // 30 days in seconds

export async function POST(req: NextRequest) {
  const { phone, code } = await req.json()

  if (!phone || !code) {
    return NextResponse.json({ error: 'Phone and code required' }, { status: 400 })
  }

  const normalised = normaliseUKPhone(phone)
  if (!normalised) {
    return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
  }

  const sb = createServiceClient()

  // Find the most recent unused, unexpired code for this phone
  const { data: record } = await sb
    .from('verification_codes')
    .select('id, code, expires_at, used, attempt_count')
    .eq('phone', normalised)
    .eq('used', false)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!record) {
    return NextResponse.json({ error: 'Code expired or not found. Request a new one.' }, { status: 400 })
  }

  // Increment attempt count
  const attempts = (record.attempt_count ?? 0) + 1
  await sb
    .from('verification_codes')
    .update({ attempt_count: attempts })
    .eq('id', record.id)

  if (attempts > 5) {
    return NextResponse.json({ error: 'Too many attempts. Request a new code.' }, { status: 429 })
  }

  if (record.code !== String(code)) {
    return NextResponse.json({ error: 'Incorrect code.' }, { status: 400 })
  }

  // Mark code as used
  await sb.from('verification_codes').update({ used: true }).eq('id', record.id)

  // Fetch customer
  const { data: customer } = await sb
    .from('customers')
    .select('id, phone')
    .eq('phone', normalised)
    .maybeSingle()

  if (!customer) {
    return NextResponse.json({ error: 'Account not found.' }, { status: 404 })
  }

  // Sign JWT and set cookie
  const token = await signPortalToken(customer.id, customer.phone)

  const response = NextResponse.json({ ok: true })
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  })

  return response
}
