import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireAdminSession } from '@/lib/adminAuth'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession()
  if (!auth.ok) return auth.response

  const { id } = await params
  const body = await req.json()
  const sb = createServiceClient()

  const updates: Record<string, unknown> = {}

  if (body.name !== undefined) updates.name = String(body.name).trim()
  if (body.producer !== undefined) updates.producer = body.producer?.trim() || null
  if (body.region !== undefined) updates.region = body.region?.trim() || null
  if (body.country !== undefined) updates.country = body.country?.trim() || null
  if (body.vintage !== undefined) updates.vintage = body.vintage ? parseInt(body.vintage) : null
  if (body.description !== undefined) updates.description = body.description?.trim() || null
  if (body.price_pounds !== undefined) {
    updates.price_pence = Math.round(parseFloat(body.price_pounds) * 100)
  }
  if (body.stock_bottles !== undefined) updates.stock_bottles = parseInt(body.stock_bottles)
  if (typeof body.active === 'boolean') updates.active = body.active

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { error } = await sb.from('wines').update(updates).eq('id', id)
  if (error) {
    console.error('[admin/wines/[id]] PATCH error', error)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
