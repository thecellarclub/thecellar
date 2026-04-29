import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/adminAuth'
import { sendSms } from '@/lib/twilio'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: Request) {
  const result = await requireAdminSession()
  if (!result.ok) return result.response

  const { phone, message } = await req.json()

  if (!phone || !message?.trim()) {
    return NextResponse.json({ error: 'phone and message are required' }, { status: 400 })
  }

  try {
    await sendSms(phone, message.trim())

    const sb = createServiceClient()
    const { data: customer } = await sb
      .from('customers')
      .select('id')
      .eq('phone', phone)
      .maybeSingle()

    if (customer) {
      await sb.from('concierge_messages').insert({
        customer_id: customer.id,
        direction: 'outbound',
        message: message.trim(),
        category: 'adhoc',
      })
      await sb.from('customers').update({ concierge_status: 'open' }).eq('id', customer.id)
      return NextResponse.json({ ok: true, customerFound: true })
    }

    return NextResponse.json({ ok: true, customerFound: false })
  } catch (err) {
    console.error('Ad hoc SMS error', err)
    return NextResponse.json({ error: 'Failed to send SMS' }, { status: 500 })
  }
}
