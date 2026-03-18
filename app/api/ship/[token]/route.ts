import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { isShipTokenExpired } from '@/lib/tokens'

/**
 * GET /api/ship/[token]
 * Validates a ship token and returns shipment + customer info for the /ship page.
 * Enforces 7-day expiry.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  if (!token || token.length < 10) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 })
  }

  const sb = createServiceClient()

  const { data: shipment } = await sb
    .from('shipments')
    .select('id, customer_id, bottle_count, status, created_at, customers(first_name, email, phone)')
    .eq('token', token)
    .maybeSingle()

  if (!shipment) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
  }

  // Enforce 7-day expiry
  if (isShipTokenExpired(shipment.created_at)) {
    return NextResponse.json(
      { error: 'This link has expired. Reply SHIP to your last text to get a fresh one.' },
      { status: 410 }
    )
  }

  if (shipment.status !== 'pending') {
    return NextResponse.json(
      { error: 'This shipment has already been confirmed.' },
      { status: 409 }
    )
  }

  return NextResponse.json({
    shipmentId: shipment.id,
    bottleCount: shipment.bottle_count,
    customer: shipment.customers,
  })
}
