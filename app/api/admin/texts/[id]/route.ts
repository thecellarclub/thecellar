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

  const [{ data: text }, { data: orders }] = await Promise.all([
    sb
      .from('texts')
      .select('id, body, sent_at, recipient_count, is_active, wines(id, name, region, country, price_pence)')
      .eq('id', id)
      .maybeSingle(),
    sb
      .from('orders')
      .select(
        'id, quantity, price_pence, total_pence, stripe_charge_status, created_at, customers(id, first_name, phone)'
      )
      .eq('text_id', id)
      .order('created_at', { ascending: false }),
  ])

  if (!text) {
    return NextResponse.json({ error: 'Text not found' }, { status: 404 })
  }

  return NextResponse.json({ text, orders: orders ?? [] })
}
