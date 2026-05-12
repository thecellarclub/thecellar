import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireAdminSession } from '@/lib/adminAuth'
import { twilioClient, sanitiseGsm7 } from '@/lib/twilio'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  const auth = await requireAdminSession()
  if (!auth.ok) return auth.response

  const { customerId } = await params

  const body = await req.json().catch(() => null)
  if (!body || !body.message || !String(body.message).trim()) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 })
  }

  const message = String(body.message).trim()

  const sb = createServiceClient()

  // Get customer phone
  const { data: customer, error: customerError } = await sb
    .from('customers')
    .select('phone')
    .eq('id', customerId)
    .maybeSingle()

  if (customerError) {
    console.error('[admin/concierge/reply] customer lookup error', customerError)
    return NextResponse.json({ error: 'Failed to fetch customer' }, { status: 500 })
  }

  if (!customer) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
  }

  // Send SMS
  try {
    await twilioClient.messages.create({
      body: sanitiseGsm7(message),
      from: process.env.TWILIO_PHONE_NUMBER,
      to: customer.phone,
    })
  } catch (err) {
    console.error('[admin/concierge/reply] Twilio error', err)
    return NextResponse.json({ error: 'Failed to send SMS' }, { status: 500 })
  }

  // Record outbound message
  const { error: insertError } = await sb.from('concierge_messages').insert({
    customer_id: customerId,
    direction: 'outbound',
    message,
  })

  if (insertError) {
    console.error('[admin/concierge/reply] insert error', insertError)
    return NextResponse.json({ error: 'SMS sent but failed to record message' }, { status: 500 })
  }

  // Log activity (fire-and-forget — don't fail the reply on log error)
  sb.from('inbox_activity').insert({
    customer_id: customerId,
    actor_id: auth.session.user.id,
    action: 'replied',
    detail: message.slice(0, 80),
  }).then(({ error }) => {
    if (error) console.error('[admin/concierge/reply] activity log error', error)
  })

  return NextResponse.json({ ok: true })
}
