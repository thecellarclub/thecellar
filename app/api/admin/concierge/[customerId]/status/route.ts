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
  const body = await req.json() as { status: 'open' | 'closed' }

  if (body.status !== 'open' && body.status !== 'closed') {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const sb = createServiceClient()
  const { error } = await sb
    .from('customers')
    .update({ concierge_status: body.status })
    .eq('id', customerId)

  if (error) {
    console.error('[admin/concierge/status] update error', error)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
