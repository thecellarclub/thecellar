import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/adminAuth'
import { createServiceClient } from '@/lib/supabase'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession()
  if (!auth.ok) return auth.response

  const { id: customerId } = await params
  const body = await req.json()
  const { cellarIds } = body

  if (!Array.isArray(cellarIds) || cellarIds.length === 0) {
    return NextResponse.json({ error: 'cellarIds must be a non-empty array' }, { status: 400 })
  }
  if (!cellarIds.every((id: unknown) => typeof id === 'string' && UUID_RE.test(id))) {
    return NextResponse.json({ error: 'cellarIds must be valid UUIDs' }, { status: 400 })
  }

  const sb = createServiceClient()

  const { data: rows } = await sb
    .from('cellar')
    .select('id, quantity, shipped_at, customer_id')
    .in('id', cellarIds)

  if (!rows || rows.length !== cellarIds.length) {
    return NextResponse.json({ error: 'One or more cellar entries not found' }, { status: 404 })
  }
  if (rows.some((r) => r.customer_id !== customerId)) {
    return NextResponse.json({ error: 'Cellar entries do not belong to this customer' }, { status: 403 })
  }
  if (rows.some((r) => r.shipped_at !== null)) {
    return NextResponse.json({ error: 'One or more entries are already shipped' }, { status: 409 })
  }

  const bottleCount = rows.reduce((s, r) => s + r.quantity, 0)
  const now = new Date().toISOString()

  const { data: shipment, error: shipErr } = await sb
    .from('shipments')
    .insert({
      customer_id: customerId,
      status: 'delivered',
      type: 'collection',
      bottle_count: bottleCount,
      shipping_address: null,
      shipping_fee_pence: 0,
      dispatched_at: now,
      delivered_at: now,
    })
    .select('id')
    .single()

  if (shipErr || !shipment) {
    console.error('[collect] shipment insert error', shipErr)
    return NextResponse.json({ error: 'Failed to create shipment record' }, { status: 500 })
  }

  const { error: cellarErr } = await sb
    .from('cellar')
    .update({ shipment_id: shipment.id, shipped_at: now })
    .in('id', cellarIds)

  if (cellarErr) {
    console.error('[collect] cellar update error', cellarErr)
    return NextResponse.json({ error: 'Shipment created but failed to update cellar rows' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, shipmentId: shipment.id })
}
