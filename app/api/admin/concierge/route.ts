import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireAdminSession } from '@/lib/adminAuth'

export async function GET() {
  const auth = await requireAdminSession()
  if (!auth.ok) return auth.response

  const sb = createServiceClient()

  const { data, error } = await sb
    .from('concierge_messages')
    .select('id, message, direction, created_at, customers(first_name, phone)')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[admin/concierge] GET error', error)
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}
