import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireAdminSession } from '@/lib/adminAuth'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

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

  if (body.status === 'collection_booked') {
    const { courier_collection_location: loc, courier_collection_date: date, tracking_number } = body

    if (loc !== 'crush' && loc !== 'norse') {
      return NextResponse.json({ error: 'courier_collection_location must be crush or norse' }, { status: 400 })
    }
    if (!date || !DATE_RE.test(date)) {
      return NextResponse.json({ error: 'courier_collection_date must be a valid ISO date' }, { status: 400 })
    }

    // Validate transition — only from pending or confirmed
    const { data: current } = await sb
      .from('shipments')
      .select('status, type')
      .eq('id', id)
      .maybeSingle()

    if (!current) return NextResponse.json({ error: 'Shipment not found' }, { status: 404 })
    if (current.type === 'collection') {
      return NextResponse.json({ error: 'collection_booked is not valid for bar pickup shipments' }, { status: 400 })
    }
    if (current.status !== 'pending' && current.status !== 'confirmed') {
      return NextResponse.json({ error: 'Can only book collection from pending or confirmed status' }, { status: 409 })
    }

    updates.status = 'collection_booked'
    updates.courier_collection_location = loc
    updates.courier_collection_date = date
    if (tracking_number?.trim()) updates.tracking_number = tracking_number.trim()

  } else if (body.status === 'dispatched') {
    if (!body.tracking_number?.trim()) {
      return NextResponse.json({ error: 'Tracking number is required to mark as dispatched' }, { status: 400 })
    }
    updates.status = 'dispatched'
    updates.tracking_number = body.tracking_number.trim()
    updates.dispatched_at = new Date().toISOString()

  } else if (body.status === 'delivered') {
    updates.status = 'delivered'

  } else {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const { error } = await sb.from('shipments').update(updates).eq('id', id)
  if (error) {
    console.error('[admin/shipments/[id]] PATCH error', error)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
