import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase'
import { formatDate, formatDateTime } from '@/lib/format'
import Link from 'next/link'
import ShipmentDispatchForm from '@/app/admin/_components/ShipmentDispatchForm'

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700',
    confirmed: 'bg-purple-100 text-purple-700',
    dispatched: 'bg-blue-100 text-blue-700',
    delivered: 'bg-green-100 text-green-700',
    paused: 'bg-gray-100 text-gray-600',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded font-medium ${styles[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  )
}

export default async function ShipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/admin/login')

  const { id } = await params
  const sb = createServiceClient()

  const { data: shipment } = await sb
    .from('shipments')
    .select('id, status, tracking_number, tracking_provider, shipping_address, bottle_count, shipping_fee_pence, created_at, dispatched_at, delivered_at, stripe_payment_intent_id, customers(id, first_name, phone)')
    .eq('id', id)
    .maybeSingle()

  if (!shipment) notFound()

  const customer = shipment.customers as unknown as { id: string; first_name: string | null; phone: string | null } | null

  const addr = shipment.shipping_address as {
    line1?: string
    line2?: string | null
    city?: string
    postcode?: string
  } | null

  const addressParts = [addr?.line1, addr?.line2, addr?.city, addr?.postcode].filter(Boolean)

  // Fetch cellar rows linked to this shipment
  const { data: cellarRows } = await sb
    .from('cellar')
    .select('id, quantity, shipped_at, wines(name)')
    .eq('shipment_id', id)

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <Link href="/admin/shipments" className="text-xs text-gray-400 hover:text-gray-600 mb-2 block">← Shipments</Link>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-gray-900">Shipment</h1>
          <StatusBadge status={shipment.status} />
        </div>
        <p className="text-sm text-gray-500 mt-0.5">Created {formatDateTime(shipment.created_at)}</p>
      </div>

      {/* Summary */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Customer</p>
          {customer ? (
            <Link href={`/admin/customers/${customer.id}`} className="font-medium hover:underline text-gray-900">
              {customer.first_name ?? 'Unknown'}
            </Link>
          ) : (
            <p className="font-medium text-gray-900">—</p>
          )}
          {customer?.phone && (
            <p className="text-xs text-gray-500 mt-0.5">{customer.phone}</p>
          )}
        </div>
        <div>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Address</p>
          <p className="font-medium text-gray-900">{addressParts.length > 0 ? addressParts.join(', ') : '—'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Bottles</p>
          <p className="font-medium text-lg text-gray-900">{shipment.bottle_count ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Shipping fee</p>
          <p className="font-medium text-gray-900">
            {shipment.shipping_fee_pence != null
              ? shipment.shipping_fee_pence === 0 ? 'Free' : `£${(shipment.shipping_fee_pence / 100).toFixed(2)}`
              : '—'}
          </p>
        </div>
        {shipment.dispatched_at && (
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Dispatched</p>
            <p className="font-medium text-gray-900">{formatDate(shipment.dispatched_at)}</p>
          </div>
        )}
        {shipment.delivered_at && (
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Delivered</p>
            <p className="font-medium text-gray-900">{formatDate(shipment.delivered_at)}</p>
          </div>
        )}
        {shipment.tracking_number && (
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Tracking</p>
            <p className="font-mono text-sm text-gray-900">{shipment.tracking_number}</p>
            {shipment.tracking_provider && (
              <p className="text-xs text-gray-500">{shipment.tracking_provider}</p>
            )}
          </div>
        )}
      </div>

      {/* Dispatch / tracking form */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">Tracking &amp; dispatch</h2>
        </div>
        <div className="px-4 py-4">
          <ShipmentDispatchForm
            shipmentId={id}
            status={shipment.status}
            initialCarrier={shipment.tracking_provider ?? ''}
            initialTracking={shipment.tracking_number ?? ''}
          />
        </div>
      </div>

      {/* Cellar contents */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">
            Bottles in shipment ({(cellarRows ?? []).length} lines)
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                {['Wine', 'Qty', 'Shipped'].map((h) => (
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
              {(cellarRows ?? []).length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-gray-400">
                    No cellar rows linked to this shipment
                  </td>
                </tr>
              ) : (
                (cellarRows ?? []).map((row) => {
                  const wine = row.wines as unknown as { name: string } | null
                  return (
                    <tr key={row.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 border-b border-gray-100">{wine?.name ?? '—'}</td>
                      <td className="px-4 py-2.5 border-b border-gray-100">{row.quantity}</td>
                      <td className="px-4 py-2.5 border-b border-gray-100 text-xs text-gray-500">
                        {row.shipped_at ? formatDateTime(row.shipped_at) : 'Not yet'}
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
