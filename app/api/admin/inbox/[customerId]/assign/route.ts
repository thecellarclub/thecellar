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
  const body = await req.json().catch(() => null) as { assignedTo: string | null } | null
  if (!body || !('assignedTo' in body)) {
    return NextResponse.json({ error: 'Missing assignedTo' }, { status: 400 })
  }

  const sb = createServiceClient()

  const { error } = await sb
    .from('customers')
    .update({
      inbox_assigned_to: body.assignedTo ?? null,
      inbox_assigned_at: body.assignedTo ? new Date().toISOString() : null,
    })
    .eq('id', customerId)

  if (error) {
    console.error('[admin/inbox/assign] update error', error)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  // Log activity
  let assigneeName = 'Unassigned'
  if (body.assignedTo) {
    const { data: user } = await sb
      .from('admin_users')
      .select('name')
      .eq('id', body.assignedTo)
      .maybeSingle()
    if (user?.name) assigneeName = user.name
  }

  await sb.from('inbox_activity').insert({
    customer_id: customerId,
    actor_id: auth.session.user.id,
    action: 'assigned',
    detail: assigneeName,
  })

  console.log(`[admin/inbox/assign] ${auth.session.user.name} assigned ${customerId} to ${assigneeName}`)

  return NextResponse.json({ ok: true, assignedTo: body.assignedTo, assignedAt: new Date().toISOString() })
}
