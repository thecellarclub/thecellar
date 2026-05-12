import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/adminAuth'
import { createServiceClient } from '@/lib/supabase'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession()
  if (!auth.ok) return auth.response

  const { id: shipmentId } = await params
  const sb = createServiceClient()

  const { data: shipment, error: fetchErr } = await sb
    .from('shipments')
    .select('id, type, status')
    .eq('id', shipmentId)
    .maybeSingle()

  if (fetchErr || !shipment) {
    return NextResponse.json({ error: 'Shipment not found' }, { status: 404 })
  }
  if (shipment.type !== 'collection') {
    return NextResponse.json({ error: 'Not a collection shipment' }, { status: 400 })
  }
  if (shipment.status !== 'pending') {
    return NextResponse.json({ error: 'Shipment is not pending' }, { status: 409 })
  }

  const now = new Date().toISOString()

  const { error: shipErr } = await sb
    .from('shipments')
    .update({ status: 'delivered', dispatched_at: now, delivered_at: now })
    .eq('id', shipmentId)

  if (shipErr) {
    console.error('[complete-collection] shipment update error', shipErr)
    return NextResponse.json({ error: 'Failed to update shipment' }, { status: 500 })
  }

  const { error: cellarErr } = await sb
    .from('cellar')
    .update({ shipped_at: now })
    .eq('shipment_id', shipmentId)

  if (cellarErr) {
    console.error('[complete-collection] cellar update error', cellarErr)
    return NextResponse.json({ error: 'Shipment marked collected but failed to update cellar rows' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
