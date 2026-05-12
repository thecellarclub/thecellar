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

  // Unlink cellar rows so bottles return to available cellar
  const { error: cellarErr } = await sb
    .from('cellar')
    .update({ shipment_id: null })
    .eq('shipment_id', shipmentId)

  if (cellarErr) {
    console.error('[cancel-collection] cellar unlink error', cellarErr)
    return NextResponse.json({ error: 'Failed to unlink cellar rows' }, { status: 500 })
  }

  // Delete the shipment
  const { error: deleteErr } = await sb
    .from('shipments')
    .delete()
    .eq('id', shipmentId)

  if (deleteErr) {
    console.error('[cancel-collection] shipment delete error', deleteErr)
    return NextResponse.json({ error: 'Cellar rows unlinked but failed to delete shipment' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
