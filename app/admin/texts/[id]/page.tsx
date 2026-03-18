import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
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

export default async function TextDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/admin/login')

  const { id } = await params
  const sb = createServiceClient()

  const [{ data: text }, { data: orders }] = await Promise.all([
    sb
      .from('texts')
      .select('id, body, sent_at, recipient_count, is_active, wines(name, price_pence)')
      .eq('id', id)
      .maybeSingle(),
    sb
      .from('orders')
      .select('id, quantity, total_pence, stripe_charge_status, created_at, customers(id, first_name, phone)')
      .eq('text_id', id)
      .order('created_at', { ascending: false }),
  ])

  if (!text) notFound()

  const wine = text.wines as unknown as { name: string; price_pence: number } | null
  const succeeded = (orders ?? []).filter((o) => o.stripe_charge_status === 'succeeded')
  const revenue = succeeded.reduce((s, o) => s + o.total_pence, 0)
  const totalBottles = succeeded.reduce((s, o) => s + o.quantity, 0)
  const conversionRate =
    text.recipient_count > 0
      ? ((succeeded.length / text.recipient_count) * 100).toFixed(1)
      : '0.0'

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <Link href="/admin/texts" className="text-sm text-gray-500 hover:text-gray-800">
          ← Back to texts
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            {wine?.name ?? 'Unknown wine'}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{formatDateTime(text.sent_at)}</p>
        </div>
        {text.is_active ? (
          <span className="text-xs px-2 py-1 rounded font-medium bg-green-100 text-green-700">Active offer</span>
        ) : (
          <span className="text-xs px-2 py-1 rounded font-medium bg-gray-100 text-gray-500">Closed</span>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Recipients', value: text.recipient_count ?? 0 },
          { label: 'Orders', value: succeeded.length },
          { label: 'Conversion', value: `${conversionRate}%` },
          { label: 'Revenue', value: penceToGbp(revenue) },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">{s.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Message body */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 mb-6">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Message</p>
        <p className="text-sm whitespace-pre-wrap text-gray-900">{text.body}</p>
        <p className="text-xs text-gray-400 mt-2">{text.body.length} characters</p>
      </div>

      {/* Orders table */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">
            Orders ({(orders ?? []).length})
            {totalBottles > 0 && (
              <span className="text-gray-500 font-normal ml-2">· {totalBottles} bottles total</span>
            )}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                {['Customer', 'Qty', 'Amount', 'Status', 'Date'].map((h) => (
                  <th
                    key={h}
                    className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide border-b border-gray-200 px-4 py-2 bg-gray-50"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(orders ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                    No orders for this blast
                  </td>
                </tr>
              ) : (
                (orders ?? []).map((o) => {
                  const customer = o.customers as unknown as { id: string; first_name: string; phone: string } | null
                  return (
                    <tr key={o.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 border-b border-gray-100">
                        {customer ? (
                          <Link
                            href={`/admin/customers/${customer.id}`}
                            className="hover:underline font-medium"
                          >
                            {customer.first_name}
                          </Link>
                        ) : (
                          '—'
                        )}{' '}
                        <span className="text-gray-400 text-xs">{customer?.phone}</span>
                      </td>
                      <td className="px-4 py-2.5 border-b border-gray-100">{o.quantity}</td>
                      <td className="px-4 py-2.5 border-b border-gray-100">{penceToGbp(o.total_pence)}</td>
                      <td className="px-4 py-2.5 border-b border-gray-100">
                        <StatusBadge status={o.stripe_charge_status} />
                      </td>
                      <td className="px-4 py-2.5 border-b border-gray-100 text-gray-500 text-xs whitespace-nowrap">
                        {formatDateTime(o.created_at)}
                      </td>
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
