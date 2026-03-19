import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireAdminSession } from '@/lib/adminAuth'

export async function GET() {
  const auth = await requireAdminSession()
  if (!auth.ok) return auth.response

  const sb = createServiceClient()

  const { data, error } = await sb
    .from('special_requests')
    .select('id, message, status, created_at, customers(first_name, phone)')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[admin/requests] GET error', error)
    return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdminSession()
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => null)
  if (!body || !body.id || !body.status) {
    return NextResponse.json({ error: 'Missing id or status' }, { status: 400 })
  }

  const sb = createServiceClient()

  const { error } = await sb
    .from('special_requests')
    .update({ status: body.status })
    .eq('id', body.id)

  if (error) {
    console.error('[admin/requests] PATCH error', error)
    return NextResponse.json({ error: 'Failed to update request' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
