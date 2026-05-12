import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/adminAuth'
import { createServiceClient } from '@/lib/supabase'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^\d{2}:\d{2}$/

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession()
  if (!auth.ok) return auth.response

  const { id: customerId } = await params
  const body = await req.json()
  const { cellarIds, venue, date, time } = body

  if (!Array.isArray(cellarIds) || cellarIds.length === 0) {
    return NextResponse.json({ error: 'cellarIds must be a non-empty array' }, { status: 400 })
  }
  if (!cellarIds.every((id: unknown) => typeof id === 'string' && UUID_RE.test(id))) {
    return NextResponse.json({ error: 'cellarIds must be valid UUIDs' }, { status: 400 })
  }
  if (venue !== 'crush' && venue !== 'norse') {
    return NextResponse.json({ error: 'venue must be crush or norse' }, { status: 400 })
  }
  if (!date || !DATE_RE.test(date)) {
    return NextResponse.json({ error: 'date must be a valid ISO date' }, { status: 400 })
  }
  const today = new Date().toISOString().slice(0, 10)
  if (date < today) {
    return NextResponse.json({ error: 'date must be today or later' }, { status: 400 })
  }
  if (time !== null && time !== undefined && !TIME_RE.test(time)) {
    return NextResponse.json({ error: 'time must be HH:MM or null' }, { status: 400 })
  }

  const sb = createServiceClient()

  const { data: rows } = await sb
    .from('cellar')
    .select('id, quantity, shipped_at, shipment_id, customer_id')
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
  if (rows.some((r) => r.shipment_id !== null)) {
    return NextResponse.json({ error: 'One or more entries are already reserved for a collection' }, { status: 409 })
  }

  const bottleCount = rows.reduce((s, r) => s + r.quantity, 0)

  const { data: shipment, error: shipErr } = await sb
    .from('shipments')
    .insert({
      customer_id: customerId,
      status: 'pending',
      type: 'collection',
      bottle_count: bottleCount,
      shipping_address: null,
      shipping_fee_pence: 0,
      collection_venue: venue,
      collection_date: date,
      collection_time: time ?? null,
    })
    .select('id')
    .single()

  if (shipErr || !shipment) {
    console.error('[collect] shipment insert error', shipErr)
    return NextResponse.json({ error: 'Failed to create shipment record' }, { status: 500 })
  }

  // Reserve bottles — set shipment_id but NOT shipped_at (set on completion)
  const { error: cellarErr } = await sb
    .from('cellar')
    .update({ shipment_id: shipment.id })
    .in('id', cellarIds)

  if (cellarErr) {
    console.error('[collect] cellar update error', cellarErr)
    return NextResponse.json({ error: 'Shipment created but failed to update cellar rows' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, shipmentId: shipment.id })
}
