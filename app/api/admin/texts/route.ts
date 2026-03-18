import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireAdminSession } from '@/lib/adminAuth'

export async function GET() {
  const auth = await requireAdminSession()
  if (!auth.ok) return auth.response

  const sb = createServiceClient()

  const { data: texts, error } = await sb
    .from('texts')
    .select('id, body, sent_at, recipient_count, is_active, wines(id, name, region, country), orders(id)')
    .order('sent_at', { ascending: false })

  if (error) {
    console.error('[admin/texts] GET error', error)
    return NextResponse.json({ error: 'Failed to fetch texts' }, { status: 500 })
  }

  const result = (texts ?? []).map((t) => ({
    ...t,
    order_count: Array.isArray(t.orders) ? t.orders.length : 0,
    conversion_rate:
      t.recipient_count && t.recipient_count > 0
        ? Math.round(
            ((Array.isArray(t.orders) ? t.orders.length : 0) / t.recipient_count) * 100
          )
        : 0,
    orders: undefined, // strip raw orders array from list response
  }))

  return NextResponse.json(result)
}
