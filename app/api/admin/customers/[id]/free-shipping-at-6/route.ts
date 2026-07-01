import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireAdminSession } from '@/lib/adminAuth'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession()
  if (!auth.ok) return auth.response

  const { id } = await params
  const body = await req.json().catch(() => null) as { enabled: boolean } | null
  if (!body || typeof body.enabled !== 'boolean') {
    return NextResponse.json({ error: 'Missing enabled field' }, { status: 400 })
  }

  const sb = createServiceClient()
  const { error } = await sb
    .from('customers')
    .update({ free_shipping_at_6: body.enabled })
    .eq('id', id)

  if (error) {
    console.error('[admin/customers/free-shipping-at-6] update error', error)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  await sb.from('inbox_activity').insert({
    customer_id: id,
    actor_id: auth.session.user.id,
    action: body.enabled ? 'free_shipping_at_6_set' : 'free_shipping_at_6_cleared',
    detail: body.enabled ? null : 'cancelled by admin',
  })

  return NextResponse.json({ ok: true })
}
