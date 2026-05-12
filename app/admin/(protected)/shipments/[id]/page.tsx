import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase'
import { formatDate, formatDateTime } from '@/lib/format'
import Link from 'next/link'
import ShipmentDispatchForm from '@/app/admin/_components/ShipmentDispatchForm'
import CollectionActions from '@/app/admin/_components/CollectionActions'

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  collection_booked: 'Collection booked',
  dispatched: 'Dispatched',
  delivered: 'Delivered',
  paused: 'Paused',
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700',
    confirmed: 'bg-purple-100 text-purple-700',
    collection_booked: 'bg-indigo-100 text-indigo-700',
    dispatched: 'bg-blue-100 text-blue-700',
    delivered: 'bg-green-100 text-green-700',
    paused: 'bg-gray-100 text-gray-600',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded font-medium ${styles[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {STATUS_LABELS[status] ?? status}
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

  const { data: shipment, error: shipmentError } = await sb
    .from('shipments')
    .select('id, status, type, tracking_number, tracking_provider, shipping_address, bottle_count, shipping_fee_pence, created_at, dispatched_at, delivered_at, collection_venue, collection_date, collection_time, courier_collection_date, courier_collection_location, customers(id, first_name, phone)')
    .eq('id', id)
    .maybeSingle()

  if (shipmentError) {
    console.error('[admin/shipments/detail] query error', shipmentError)
  }

  if (!shipment) notFound()

  const customer = shipment.customers as unknown as { id: string; first_name: string | null; phone: string | null } | null
  const sType = (shipment as unknown as { type?: string | null }).type
  const collectionVenue = (shipment as unknown as { collection_venue?: string | null }).collection_venue
  const collectionDate = (shipment as unknown as { collection_date?: string | null }).collection_date
  const collectionTime = (shipment as unknown as { collection_time?: string | null }).collection_time
  const isCollection = sType === 'collection'
  const courierDate = (shipment as unknown as { courier_collection_date?: string | null }).courier_collection_date
  const courierLocation = (shipment as unknown as { courier_collection_location?: string | null }).courier_collection_location

  function formatCollectionDate(dateStr: string): string {
    const d = new Date(dateStr + 'T12:00:00')
    const s = ['th', 'st', 'nd', 'rd']
    const n = d.getDate()
    const v = n % 100
    const ord = n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
    const weekday = d.toLocaleDateString('en-GB', { weekday: 'short' })
    const month = d.toLocaleDateString('en-GB', { month: 'long' })
    return `${weekday} ${ord} ${month}`
  }

  function formatTime(t: string): string {
    const [h, m] = t.split(':').map(Number)
    const ampm = h >= 12 ? 'pm' : 'am'
    const hour = h % 12 === 0 ? 12 : h % 12
    return `${hour}:${String(m).padStart(2, '0')}${ampm}`
  }

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
        <Link href="/admin/shipments" className="text-xs text-gray-500 hover:text-gray-600 mb-2 block">← Shipments</Link>
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
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{isCollection ? 'Collection' : 'Address'}</p>
          {isCollection ? (
            <div>
              <p className="font-medium text-gray-900">{collectionVenue === 'crush' ? 'Crush' : collectionVenue === 'norse' ? 'Norse' : collectionVenue ?? '—'}</p>
              {collectionDate && (
                <p className="text-sm text-gray-600 mt-0.5">
                  {formatCollectionDate(collectionDate)}
                  {collectionTime ? ` at ${formatTime(collectionTime)}` : ' · no time set'}
                </p>
              )}
            </div>
          ) : (
            <p className="font-medium text-gray-900">{addressParts.length > 0 ? addressParts.join(', ') : '—'}</p>
          )}
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
        {courierDate && (
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Courier collection</p>
            <p className="font-medium text-gray-900">
              {courierLocation === 'crush' ? 'Crush' : courierLocation === 'norse' ? 'Norse' : courierLocation ?? '—'}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">{formatCollectionDate(courierDate)}</p>
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

      {/* Dispatch / tracking form — hidden for collection shipments */}
      {isCollection ? (
        shipment.status === 'pending' && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm font-semibold text-gray-900 mb-3">Collection actions</p>
            <CollectionActions shipmentId={id} />
          </div>
        )
      ) : (
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
      )}

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
                  <td colSpan={3} className="px-4 py-6 text-center text-gray-500">
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
