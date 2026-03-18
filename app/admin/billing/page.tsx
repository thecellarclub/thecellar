import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase'
import { penceToGbp, formatDateTime } from '@/lib/format'
import Link from 'next/link'
import RetryChargeButton from '@/app/admin/_components/RetryChargeButton'

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    failed: 'bg-red-100 text-red-700',
    requires_action: 'bg-amber-100 text-amber-700',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded font-medium ${styles[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status === 'requires_action' ? 'Needs 3DS' : status}
    </span>
  )
}

export default async function BillingPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/admin/login')

  const sb = createServiceClient()

  const { data: orders } = await sb
    .from('orders')
    .select('id, quantity, total_pence, stripe_charge_status, stripe_payment_intent_id, created_at, customers(id, first_name, last_name, phone, stripe_customer_id), wines(name)')
    .in('stripe_charge_status', ['failed', 'requires_action'])
    .order('created_at', { ascending: false })

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Billing issues</h1>
          {(orders ?? []).length > 0 && (
            <p className="text-sm text-gray-500 mt-0.5">
              {(orders ?? []).length} order{(orders ?? []).length !== 1 ? 's' : ''} need attention
            </p>
          )}
        </div>
      </div>

      {(orders ?? []).length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-400">
          <p className="text-lg mb-1">✓</p>
          <p className="text-sm">No billing issues — all payments are up to date.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  {['Customer', 'Wine', 'Qty', 'Amount', 'Status', 'Date', 'Actions'].map((h) => (
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
                {(orders ?? []).map((o) => {
                  const customer = o.customers as unknown as {
                    id: string
                    first_name: string
                    last_name: string
                    phone: string
                    stripe_customer_id: string | null
                  } | null
                  const wine = o.wines as unknown as { name: string } | null

                  return (
                    <tr key={o.id} className="hover:bg-gray-50 align-top">
                      <td className="px-4 py-3 border-b border-gray-100">
                        {customer ? (
                          <Link
                            href={`/admin/customers/${customer.id}`}
                            className="hover:underline font-medium"
                          >
                            {customer.first_name} {customer.last_name}
                          </Link>
                        ) : (
                          '—'
                        )}
                        <br />
                        <span className="text-gray-400 text-xs">{customer?.phone}</span>
                        {customer?.stripe_customer_id && (
                          <>
                            <br />
                            <a
                              href={`https://dashboard.stripe.com/customers/${customer.stripe_customer_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline"
                            >
                              Stripe →
                            </a>
                          </>
                        )}
                      </td>
                      <td className="px-4 py-3 border-b border-gray-100">{wine?.name ?? '—'}</td>
                      <td className="px-4 py-3 border-b border-gray-100">{o.quantity}</td>
                      <td className="px-4 py-3 border-b border-gray-100">{penceToGbp(o.total_pence)}</td>
                      <td className="px-4 py-3 border-b border-gray-100">
                        <StatusBadge status={o.stripe_charge_status} />
                        {o.stripe_payment_intent_id && (
                          <>
                            <br />
                            <a
                              href={`https://dashboard.stripe.com/payments/${o.stripe_payment_intent_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline mt-1 inline-block"
                            >
                              View payment →
                            </a>
                          </>
                        )}
                      </td>
                      <td className="px-4 py-3 border-b border-gray-100 text-gray-500 text-xs whitespace-nowrap">
                        {formatDateTime(o.created_at)}
                      </td>
                      <td className="px-4 py-3 border-b border-gray-100">
                        <RetryChargeButton orderId={o.id} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
