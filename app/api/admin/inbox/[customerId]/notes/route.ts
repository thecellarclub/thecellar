import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireAdminSession } from '@/lib/adminAuth'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  const auth = await requireAdminSession()
  if (!auth.ok) return auth.response

  const { customerId } = await params
  const sb = createServiceClient()

  const { data, error } = await sb
    .from('inbox_notes')
    .select('id, customer_id, author_id, body, created_at, admin_users(name)')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[admin/inbox/notes] GET error', error)
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 })
  }

  const notes = ((data ?? []) as unknown as {
    id: string
    customer_id: string
    author_id: string
    body: string
    created_at: string
    admin_users: { name: string } | null
  }[]).map((row) => ({
    id: row.id,
    customer_id: row.customer_id,
    author_id: row.author_id,
    author_name: row.admin_users?.name ?? 'Unknown',
    body: row.body,
    created_at: row.created_at,
  }))

  return NextResponse.json(notes)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  const auth = await requireAdminSession()
  if (!auth.ok) return auth.response

  const { customerId } = await params
  const body = await req.json().catch(() => null) as { body: string } | null
  if (!body?.body?.trim()) {
    return NextResponse.json({ error: 'Note body is required' }, { status: 400 })
  }

  const sb = createServiceClient()

  const { data: note, error } = await sb
    .from('inbox_notes')
    .insert({
      customer_id: customerId,
      author_id: auth.session.user.id,
      body: body.body.trim(),
    })
    .select('id, customer_id, author_id, body, created_at')
    .single()

  if (error) {
    console.error('[admin/inbox/notes] POST error', error)
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 })
  }

  // Log activity
  await sb.from('inbox_activity').insert({
    customer_id: customerId,
    actor_id: auth.session.user.id,
    action: 'note_added',
    detail: body.body.trim().slice(0, 80),
  })

  return NextResponse.json({
    ...note,
    author_name: auth.session.user.name,
  })
}
