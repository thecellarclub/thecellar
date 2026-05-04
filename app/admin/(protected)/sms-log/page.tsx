import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase'
import SmsLogClientView from './_components/SmsLogClientView'

export default async function SmsLogPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/admin/login')

  const sb = createServiceClient()
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [{ data: logs }, { data: failedOrders }] = await Promise.all([
    sb
      .from('sms_parse_log')
      .select('id, inbound_phone, raw_message, parse_kind, parse_quantity, ambiguous, matched_text_id, created_at, customer_id, customers(id, first_name, phone)')
      .order('created_at', { ascending: false })
      .limit(500),
    sb
      .from('orders')
      .select('id, quantity, total_pence, created_at, payment_failed_at, payment_failed_attempts, customer_id, wine_id, customers(id, first_name, phone), wines(name)')
      .eq('order_status', 'payment_failed')
      .order('payment_failed_at', { ascending: false }),
  ])

  // 24h summary counts
  const recent = (logs ?? []).filter((r) => r.created_at >= since24h)
  const summary = {
    total: recent.length,
    byKind: recent.reduce<Record<string, number>>((acc, r) => {
      acc[r.parse_kind] = (acc[r.parse_kind] ?? 0) + 1
      return acc
    }, {}),
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <h1 className="text-xl font-semibold text-gray-900 mb-1">SMS log</h1>
      <p className="text-sm text-gray-500 mb-6">All inbound messages · last 500 rows</p>

      <SmsLogClientView
        logs={(logs ?? []) as unknown as SmsLogRow[]}
        failedOrders={(failedOrders ?? []) as unknown as FailedOrderRow[]}
        summary={summary}
      />
    </div>
  )
}

// Types shared with client component
export type SmsLogRow = {
  id: string
  inbound_phone: string
  raw_message: string
  parse_kind: string
  parse_quantity: number | null
  ambiguous: boolean
  matched_text_id: string | null
  created_at: string
  customer_id: string | null
  customers: { id: string; first_name: string | null; phone: string | null } | null
}

export type FailedOrderRow = {
  id: string
  quantity: number
  total_pence: number
  created_at: string
  payment_failed_at: string | null
  payment_failed_attempts: number
  customer_id: string
  wine_id: string
  customers: { id: string; first_name: string | null; phone: string | null } | null
  wines: { name: string } | null
}
