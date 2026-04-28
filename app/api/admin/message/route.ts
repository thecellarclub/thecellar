import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/adminAuth'
import { sendSms } from '@/lib/twilio'

export async function POST(req: Request) {
  const result = await requireAdminSession()
  if (!result.ok) return result.response

  const { phone, message } = await req.json()

  if (!phone || !message?.trim()) {
    return NextResponse.json({ error: 'phone and message are required' }, { status: 400 })
  }

  try {
    await sendSms(phone, message.trim())
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Ad hoc SMS error', err)
    return NextResponse.json({ error: 'Failed to send SMS' }, { status: 500 })
  }
}
