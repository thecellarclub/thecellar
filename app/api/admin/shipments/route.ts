import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireAdminSession } from '@/lib/adminAuth'

export async function GET() {
  const auth = await requireAdminSession()
  if (!auth.ok) return auth.response

  const sb = createServiceClient()

  const { data, error } = await sb
    .from('shipments')
    .select(
      'id, bottle_count, shipping_address, status, tracking_number, created_at, dispatched_at, customers(id, first_name, phone, email)'
    )
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[admin/shipments] GET error', error)
    return NextResponse.json({ error: 'Failed to fetch shipments' }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}
