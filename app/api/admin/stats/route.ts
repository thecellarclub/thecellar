import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireAdminSession } from '@/lib/adminAuth'

export async function GET() {
  const auth = await requireAdminSession()
  if (!auth.ok) return auth.response

  const sb = createServiceClient()

  const [
    { count: activeCustomers },
    { data: cellarData },
    { data: lastText },
    { count: pendingShipments },
    { data: recentOrders },
  ] = await Promise.all([
    sb.from('customers').select('*', { count: 'exact', head: true }).eq('active', true),
    sb.from('customer_cellar_totals').select('total_bottles'),
    sb
      .from('texts')
      .select('sent_at, wines(name)')
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb.from('shipments').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    sb
      .from('orders')
      .select(
        'id, quantity, total_pence, stripe_charge_status, created_at, customers(first_name, phone), wines(name)'
      )
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const totalBottles =
    cellarData?.reduce((sum, row) => sum + Number(row.total_bottles ?? 0), 0) ?? 0

  return NextResponse.json({
    activeCustomers: activeCustomers ?? 0,
    totalBottlesInCellar: totalBottles,
    lastText,
    pendingShipments: pendingShipments ?? 0,
    recentOrders: recentOrders ?? [],
  })
}
