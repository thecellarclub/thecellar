import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { isShipTokenExpired } from '@/lib/tokens'

/**
 * POST /api/ship/confirm
 *
 * Called by the /ship page when the customer submits their delivery address.
 *
 * Uses a pre-link approach: handleShip pre-links unshipped cellar rows to the
 * shipment when it's created. This route then marks those pre-linked rows as
 * shipped. A legacy fallback handles old shipments without pre-linking.
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

  // Mark pre-linked cellar rows as shipped (new flow: handleShip pre-links rows)
  const { error: cellarError } = await sb
    .from('cellar')
    .update({ shipped_at: new Date().toISOString() })
    .eq('shipment_id', shipment.id)
    .is('shipped_at', null)

  if (cellarError) {
    console.error('cellar pre-link update error', cellarError)
  }

  // Legacy fallback: if no rows were pre-linked, link all unshipped rows now
  const { count } = await sb
    .from('cellar')
    .select('*', { count: 'exact', head: true })
    .eq('shipment_id', shipment.id)

  if ((count ?? 0) === 0) {
    const { error: legacyError } = await sb
      .from('cellar')
      .update({
        shipment_id: shipment.id,
        shipped_at: new Date().toISOString(),
      })
      .eq('customer_id', shipment.customer_id)
      .is('shipped_at', null)

    if (legacyError) {
      console.error('cellar legacy update error', legacyError)
    }
  }

  return NextResponse.json({ ok: true })
}
