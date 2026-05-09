import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireAdminSession } from '@/lib/adminAuth'

export async function GET() {
  const auth = await requireAdminSession()
  if (!auth.ok) return auth.response

  const sb = createServiceClient()
  const { data, error } = await sb
    .from('admin_users')
    .select('id, name, email')
    .order('name')

  if (error) {
    console.error('[admin/users] GET error', error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}
