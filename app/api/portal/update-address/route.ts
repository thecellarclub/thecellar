import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getPortalSession } from '@/lib/portal-auth'

export async function POST(req: NextRequest) {
  const session = await getPortalSession(req)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { line1, line2, city, postcode } = await req.json()

  if (!line1 || !city || !postcode) {
    return NextResponse.json({ error: 'line1, city and postcode are required' }, { status: 400 })
  }

  const sb = createServiceClient()

  await sb
    .from('customers')
    .update({
      default_address: {
        line1: String(line1).trim(),
        line2: line2 ? String(line2).trim() : null,
        city: String(city).trim(),
        postcode: String(postcode).trim().toUpperCase(),
      },
    })
    .eq('id', session.customerId)

  return NextResponse.json({ ok: true })
}
