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
  const body = await req.json()
  const sb = createServiceClient()

  const updates: Record<string, unknown> = {}

  if (body.status === 'dispatched') {
    if (!body.tracking_number?.trim()) {
      return NextResponse.json({ error: 'Tracking number is required to mark as dispatched' }, { status: 400 })
    }
    updates.status = 'dispatched'
    updates.tracking_number = body.tracking_number.trim()
    updates.dispatched_at = new Date().toISOString()
  } else if (body.status === 'delivered') {
    updates.status = 'delivered'
  } else {
    return NextResponse.json({ error: 'status must be "dispatched" or "delivered"' }, { status: 400 })
  }

  const { error } = await sb.from('shipments').update(updates).eq('id', id)
  if (error) {
    console.error('[admin/shipments/[id]] PATCH error', error)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
