import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireAdminSession } from '@/lib/adminAuth'

export async function GET() {
  const auth = await requireAdminSession()
  if (!auth.ok) return auth.response

  const sb = createServiceClient()

  const { data: customers, error } = await sb
    .from('customers')
    .select('id, first_name, phone, email, active, subscribed_at, stripe_customer_id')
    .order('subscribed_at', { ascending: false })

  if (error) {
    console.error('[admin/customers] GET error', error)
    return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 })
  }

  // Fetch cellar totals
  const { data: cellarTotals } = await sb
    .from('customer_cellar_totals')
    .select('customer_id, total_bottles')

  const totalsMap = new Map(
    (cellarTotals ?? []).map((r) => [r.customer_id, Number(r.total_bottles ?? 0)])
  )

  const result = (customers ?? []).map((c) => ({
    ...c,
    cellar_total: totalsMap.get(c.id) ?? 0,
  }))

  return NextResponse.json(result)
}
