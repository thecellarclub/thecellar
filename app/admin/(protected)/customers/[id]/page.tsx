import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase'
import { penceToGbp, formatDate, formatDateTime } from '@/lib/format'
import DeactivateButton from '../../../_components/DeactivateButton'
import RefundButton from '../../../_components/RefundButton'
import AddBottlesForm from '../../../_components/AddBottlesForm'
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

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/admin/login')

  const { id } = await params
  const sb = createServiceClient()

  const [{ data: customer }, { data: orders }, { data: cellar }, { data: activeWines }] = await Promise.all([
    sb.from('customers').select('*').eq('id', id).maybeSingle(),
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
    sb.from('wines').select('id, name').eq('active', true).order('name'),
  ])

  if (!customer) notFound()

  const unshippedBottles = (cellar ?? [])
    .filter((c) => !c.shipped_at)
    .reduce((s, c) => s + c.quantity, 0)

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/admin/customers" className="text-xs text-gray-400 hover:text-gray-600 mb-2 block">← Customers</Link>
          <h1 className="text-xl font-semibold text-gray-900">{customer.first_name ?? 'Unknown'}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{customer.email} · {customer.phone}</p>
        </div>
        <DeactivateButton customerId={customer.id} active={customer.active} />
      </div>

      {/* Customer details */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Status</p>
          <span className={`text-xs px-2 py-0.5 rounded font-medium ${customer.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {customer.active ? 'Active' : 'Inactive'}
          </span>
        </div>
        <div>
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Joined</p>
          <p className="font-medium">{formatDate(customer.subscribed_at)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Bottles in cellar</p>
          <p className="font-medium text-lg">{unshippedBottles}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">DOB</p>
          <p className="font-medium">{customer.dob ? formatDate(customer.dob) : '—'}</p>
        </div>
      </div>

      {/* Orders */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">Orders ({(orders ?? []).length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                {['Wine', 'Qty', 'Amount', 'Status', 'Date'].map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide border-b border-gray-200 px-4 py-2 bg-gray-50">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(orders ?? []).length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">No orders</td></tr>
              ) : (
                (orders ?? []).map((o) => {
                  const wine = o.wines as unknown as { name: string } | null
                  return (
                    <tr key={o.id} className="hover:bg-gray-50">
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

      {/* Cellar */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">Cellar ({(cellar ?? []).length} entries · {unshippedBottles} unshipped)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                {['Wine', 'Qty', 'Added', 'Shipped', ''].map((h, i) => (
                  <th key={i} className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide border-b border-gray-200 px-4 py-2 bg-gray-50">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(cellar ?? []).length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Cellar empty</td></tr>
              ) : (
                (cellar ?? []).map((c) => {
                  const wine = c.wines as unknown as { name: string } | null
                  return (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 border-b border-gray-100">{wine?.name ?? '—'}</td>
                      <td className="px-4 py-2.5 border-b border-gray-100">{c.quantity}</td>
                      <td className="px-4 py-2.5 border-b border-gray-100 text-gray-500 text-xs">{formatDateTime(c.added_at)}</td>
                      <td className="px-4 py-2.5 border-b border-gray-100 text-xs">
                        {c.shipped_at
                          ? <span className="text-green-600">{formatDate(c.shipped_at)}</span>
                          : <span className="text-gray-400">In cellar</span>}
                      </td>
                      <td className="px-4 py-2.5 border-b border-gray-100">
                        {!c.shipped_at && (
                          <RefundButton
                            cellarId={c.id}
                            customerId={id}
                            maxQuantity={c.quantity}
                            wineName={wine?.name ?? 'Unknown wine'}
                          />
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Manually add bottles */}
        <div className="border-t border-gray-200">
          <div className="px-4 pt-3 pb-1">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Manually add bottles</h3>
          </div>
          <AddBottlesForm customerId={id} wines={activeWines ?? []} />
        </div>
      </div>
    </div>
  )
}
