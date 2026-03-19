import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase'
import { formatDate } from '@/lib/format'
import Link from 'next/link'
import ShipmentActions from '@/app/admin/_components/ShipmentActions'

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700',
    confirmed: 'bg-purple-100 text-purple-700',
    dispatched: 'bg-blue-100 text-blue-700',
    delivered: 'bg-green-100 text-green-700',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded font-medium ${styles[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  )
}

export default async function ShipmentsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/admin/login')

  const sb = createServiceClient()

  const { data: shipments } = await sb
    .from('shipments')
    .select('id, status, tracking_number, shipping_address, created_at, dispatched_at, delivered_at, customers(id, first_name, phone)')
    .order('created_at', { ascending: false })

  const pending = (shipments ?? []).filter((s) => s.status === 'pending').length
  const dispatched = (shipments ?? []).filter((s) => s.status === 'dispatched').length

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Shipments</h1>
          {(pending > 0 || dispatched > 0) && (
            <p className="text-sm text-gray-500 mt-0.5">
              {pending > 0 && <span className="text-amber-700 font-medium">{pending} pending</span>}
              {pending > 0 && dispatched > 0 && ' · '}
              {dispatched > 0 && <span className="text-blue-700 font-medium">{dispatched} in transit</span>}
            </p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                {['Customer', 'Address', 'Status', 'Tracking', 'Created', 'Actions'].map((h) => (
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
              {(shipments ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                    No shipments yet
                  </td>
                </tr>
              ) : (
                (shipments ?? []).map((s) => {
                  const c = s.customers as unknown as {
                    id: string
                    first_name: string
                    phone: string
                  } | null

                  const addr = s.shipping_address as {
                    line1?: string
                    line2?: string | null
                    city?: string
                    postcode?: string
                  } | null

                  const addressParts = [
                    addr?.line1,
                    addr?.line2,
                    addr?.city,
                    addr?.postcode,
                  ].filter(Boolean)

                  return (
                    <tr key={s.id} className="hover:bg-gray-50 align-top">
                      <td className="px-4 py-3 border-b border-gray-100">
                        <Link href={`/admin/shipments/${s.id}`} className="hover:underline font-medium text-gray-900">
                          {c ? c.first_name : '—'}
                        </Link>
                        {c && (
                          <>
                            <br />
                            <span className="text-gray-500 text-xs">{c.phone}</span>
                          </>
                        )}
                      </td>
                      <td className="px-4 py-3 border-b border-gray-100 text-gray-600 text-xs">
                        {addressParts.length > 0 ? addressParts.join(', ') : '—'}
                      </td>
                      <td className="px-4 py-3 border-b border-gray-100">
                        <StatusBadge status={s.status} />
                        {s.dispatched_at && (
                          <p className="text-xs text-gray-400 mt-1">Sent {formatDate(s.dispatched_at)}</p>
                        )}
                        {s.delivered_at && (
                          <p className="text-xs text-gray-400 mt-1">Delivered {formatDate(s.delivered_at)}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 border-b border-gray-100 text-xs text-gray-600 font-mono">
                        {s.tracking_number ?? '—'}
                      </td>
                      <td className="px-4 py-3 border-b border-gray-100 text-xs text-gray-500 whitespace-nowrap">
                        {formatDate(s.created_at)}
                      </td>
                      <td className="px-4 py-3 border-b border-gray-100">
                        <ShipmentActions shipmentId={s.id} status={s.status} />
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
