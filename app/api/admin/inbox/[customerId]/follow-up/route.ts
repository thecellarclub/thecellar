import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireAdminSession } from '@/lib/adminAuth'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  const auth = await requireAdminSession()
  if (!auth.ok) return auth.response

  const { customerId } = await params
  const body = await req.json().catch(() => null) as { date: string | null; note: string | null } | null
  if (!body || !('date' in body)) {
    return NextResponse.json({ error: 'Missing date field' }, { status: 400 })
  }

  const sb = createServiceClient()

  if (body.date === null) {
    // Clear follow-up
    const { error } = await sb
      .from('customers')
      .update({
        inbox_follow_up_date: null,
        inbox_follow_up_note: null,
        inbox_follow_up_set_by: null,
      })
      .eq('id', customerId)

    if (error) {
      console.error('[admin/inbox/follow-up] clear error', error)
      return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    }

    await sb.from('inbox_activity').insert({
      customer_id: customerId,
      actor_id: auth.session.user.id,
      action: 'follow_up_cleared',
      detail: null,
    })
  } else {
    const { error } = await sb
      .from('customers')
      .update({
        inbox_follow_up_date: body.date,
        inbox_follow_up_note: body.note ?? null,
        inbox_follow_up_set_by: auth.session.user.id,
      })
      .eq('id', customerId)

    if (error) {
      console.error('[admin/inbox/follow-up] set error', error)
      return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    }

    await sb.from('inbox_activity').insert({
      customer_id: customerId,
      actor_id: auth.session.user.id,
      action: 'follow_up_set',
      detail: body.note ? `${body.date} — ${body.note}` : body.date,
    })
  }

  return NextResponse.json({ ok: true })
}
