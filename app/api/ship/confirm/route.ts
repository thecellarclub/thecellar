import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { isShipTokenExpired } from '@/lib/tokens'

/**
 * POST /api/ship/confirm
 *
 * Called by the /ship page when the customer submits their delivery address.
 *
 * Validates the token, updates the shipment with the address and status 'confirmed',
 * then marks all unshipped cellar rows for this customer with the shipment_id
 * and shipped_at = now() — resetting their cellar count to 0.
 */
export async function POST(req: NextRequest) {
  let body: {
    token: string
    line1: string
    line2?: string
    city: string
    postcode: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { token, line1, line2, city, postcode } = body

  if (!token || !line1?.trim() || !city?.trim() || !postcode?.trim()) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const sb = createServiceClient()

  // Validate token
  const { data: shipment } = await sb
    .from('shipments')
    .select('id, customer_id, status, created_at')
    .eq('token', token)
    .maybeSingle()

  if (!shipment) {
    return NextResponse.json({ error: 'Invalid link.' }, { status: 404 })
  }

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

  // Update shipment: save address + mark confirmed
  const { error: updateError } = await sb
    .from('shipments')
    .update({
      shipping_address: {
        line1: line1.trim(),
        line2: line2?.trim() || null,
        city: city.trim(),
        postcode: postcode.trim().toUpperCase(),
      },
      status: 'confirmed',
    })
    .eq('id', shipment.id)

  if (updateError) {
    console.error('shipment update error', updateError)
    return NextResponse.json({ error: 'Failed to save address.' }, { status: 500 })
  }

  // Mark all unshipped cellar rows for this customer as shipped
  const { error: cellarError } = await sb
    .from('cellar')
    .update({
      shipment_id: shipment.id,
      shipped_at: new Date().toISOString(),
    })
    .eq('customer_id', shipment.customer_id)
    .is('shipped_at', null)

  if (cellarError) {
    console.error('cellar update error', cellarError)
    // Shipment is already confirmed — don't surface this error to the customer
  }

  return NextResponse.json({ ok: true })
}
