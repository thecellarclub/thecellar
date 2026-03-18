import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase'
import { penceToGbp, formatDateTime } from '@/lib/format'
import Link from 'next/link'

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    succeeded: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
    requires_action: 'bg-amber-100 text-amber-700',
    pending: 'bg-gray-100 text-gray-600',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded font-medium ${styles[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  )
}

export default async function AdminDashboard() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/admin/login')

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
    sb.from('texts').select('sent_at, wines(name)').order('sent_at', { ascending: false }).limit(1).maybeSingle(),
    sb.from('shipments').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    sb
      .from('orders')
      .select('id, quantity, total_pence, stripe_charge_status, created_at, customers(first_name, phone), wines(name)')
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const totalBottles = cellarData?.reduce((s, r) => s + Number(r.total_bottles ?? 0), 0) ?? 0

  const stats = [
    { label: 'Active subscribers', value: activeCustomers ?? 0 },
    { label: 'Bottles in cellar', value: totalBottles },
    { label: 'Pending shipments', value: pendingShipments ?? 0, href: '/admin/shipments' },
    {
      label: 'Last text sent',
      value: lastText
        ? `${(lastText.wines as unknown as { name: string } | null)?.name ?? 'Unknown'} — ${formatDateTime(lastText.sent_at)}`
        : 'None yet',
    },
  ]

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Dashboard</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">{s.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1 truncate">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Recent orders */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Recent orders</h2>
          <Link href="/admin/customers" className="text-xs text-gray-500 hover:text-gray-800">View all customers →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                {['Customer', 'Wine', 'Qty', 'Amount', 'Status', 'Date'].map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide border-b border-gray-200 px-4 py-2 bg-gray-50">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(recentOrders ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-400 text-sm">No orders yet</td>
                </tr>
              ) : (
                (recentOrders ?? []).map((o) => {
                  const customer = o.customers as unknown as { first_name: string; phone: string } | null
                  const wine = o.wines as unknown as { name: string } | null
                  return (
                    <tr key={o.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 border-b border-gray-100">
                        {customer?.first_name ?? '—'} <span className="text-gray-400 text-xs">{customer?.phone}</span>
                      </td>
                      <td className="px-4 py-2.5 border-b border-gray-100">{wine?.name ?? '—'}</td>
                      <td className="px-4 py-2.5 border-b border-gray-100">{o.quantity}</td>
                      <td className="px-4 py-2.5 border-b border-gray-100">{penceToGbp(o.total_pence)}</td>
                      <td className="px-4 py-2.5 border-b border-gray-100"><StatusBadge status={o.stripe_charge_status} /></td>
                      <td className="px-4 py-2.5 border-b border-gray-100 text-gray-500 text-xs">{formatDateTime(o.created_at)}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
