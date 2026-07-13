import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireAdminSession } from '@/lib/adminAuth'
import { grantCredit } from '@/lib/credit'
import { sendSms } from '@/lib/twilio'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession()
  if (!auth.ok) return auth.response

  const { id } = await params
  const body = await req.json().catch(() => null) as { amountPence?: unknown; reason?: unknown } | null

  const amountPence = body?.amountPence
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : ''

  if (typeof amountPence !== 'number' || !Number.isInteger(amountPence) || amountPence <= 0) {
    return NextResponse.json({ error: 'amountPence must be a positive integer' }, { status: 400 })
  }
  if (!reason) {
    return NextResponse.json({ error: 'reason is required' }, { status: 400 })
  }

  const sb = createServiceClient()

  const { data: customer } = await sb
    .from('customers')
    .select('id, phone')
    .eq('id', id)
    .maybeSingle()

  if (!customer) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
  }

  let newBalance: number
  try {
    newBalance = await grantCredit(sb, {
      customerId: id,
      amountPence,
      reason,
      adminId: auth.session.user.id,
    })
  } catch (err) {
    console.error('[admin/customers/credit] grant failed', err)
    return NextResponse.json({ error: 'Grant failed' }, { status: 500 })
  }

  await sb.from('inbox_activity').insert({
    customer_id: id,
    actor_id: auth.session.user.id,
    action: 'credit_granted',
    detail: `£${(amountPence / 100).toFixed(2)} — ${reason}`,
  })

  if (customer.phone) {
    await sendSms(
      customer.phone,
      `£${(amountPence / 100).toFixed(2)} credit has been added to your Cellar Club account. It'll be offered against your next order — reply BALANCE any time to check.`,
      { trigger: 'admin:credit-grant', customerId: id }
    ).catch((e) => console.error('[admin/customers/credit] SMS failed', e))
  }

  return NextResponse.json({ ok: true, balancePence: newBalance })
}
