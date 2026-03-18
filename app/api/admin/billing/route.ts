import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireAdminSession } from '@/lib/adminAuth'

export async function GET() {
  const auth = await requireAdminSession()
  if (!auth.ok) return auth.response

  const sb = createServiceClient()

  // Orders that are failed or still require action, joined with customer + wine
  const { data, error } = await sb
    .from('orders')
    .select(
      'id, quantity, total_pence, stripe_charge_status, stripe_payment_intent_id, created_at, ' +
      'customers(id, first_name, phone, email, stripe_customer_id), wines(id, name)'
    )
    .in('stripe_charge_status', ['failed', 'requires_action'])
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[admin/billing] GET error', error)
    return NextResponse.json({ error: 'Failed to fetch billing issues' }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}
