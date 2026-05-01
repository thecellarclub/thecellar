import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'
import { sendSms } from '@/lib/twilio'
import { generateShortToken } from '@/lib/token'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://thecellar.club'
const TOKEN_TTL_DAYS = 7

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  let body: string
  try {
    const json = await req.json()
    body = (json.body ?? '').trim()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body) {
    return NextResponse.json({ error: 'Message body is required' }, { status: 400 })
  }

  const sb = createServiceClient()

  const { data: customers, error } = await sb
    .from('customers')
    .select('id, phone, stripe_payment_method_id')
    .eq('active', true)

  if (error) throw error
  if (!customers || customers.length === 0) {
    return NextResponse.json({ error: 'No active customers' }, { status: 400 })
  }

  let sent = 0
  let failed = 0

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + TOKEN_TTL_DAYS)

  for (const customer of customers) {
    try {
      let message = body

      // Customers without a card get a personalised add-card link
      if (!customer.stripe_payment_method_id) {
        const token = generateShortToken()
        await sb
          .from('customers')
          .update({
            billing_token: token,
            billing_token_expires_at: expiresAt.toISOString(),
          })
          .eq('id', customer.id)

        message = `${body}\n\nAdd your card here so you're ready to order: ${SITE_URL}/b/${token}`
      }

      await sendSms(customer.phone, message)
      sent++
    } catch (err) {
      console.error(`[broadcast] failed for customer ${customer.id}:`, err)
      failed++
    }
  }

  return NextResponse.json({ ok: true, sent, failed })
}
