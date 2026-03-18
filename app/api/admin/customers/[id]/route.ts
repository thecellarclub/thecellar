import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireAdminSession } from '@/lib/adminAuth'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession()
  if (!auth.ok) return auth.response

  const { id } = await params
  const sb = createServiceClient()

  const [{ data: customer }, { data: orders }, { data: cellar }] = await Promise.all([
    sb
      .from('customers')
      .select('*')
      .eq('id', id)
      .maybeSingle(),
    sb
      .from('orders')
      .select('id, quantity, price_pence, total_pence, stripe_charge_status, created_at, wines(name)')
      .eq('customer_id', id)
      .order('created_at', { ascending: false }),
    sb
      .from('cellar')
      .select('id, quantity, added_at, shipped_at, wines(name)')
      .eq('customer_id', id)
      .order('added_at', { ascending: false }),
  ])

  if (!customer) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
  }

  return NextResponse.json({ customer, orders: orders ?? [], cellar: cellar ?? [] })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession()
  if (!auth.ok) return auth.response

  const { id } = await params
  const body = await req.json()
  const sb = createServiceClient()

  // Only allow updating active status (deactivation)
  const updates: Record<string, unknown> = {}
  if (typeof body.active === 'boolean') {
    updates.active = body.active
    if (!body.active) updates.unsubscribed_at = new Date().toISOString()
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { error } = await sb.from('customers').update(updates).eq('id', id)
  if (error) {
    console.error('[admin/customers/[id]] PATCH error', error)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
