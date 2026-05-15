import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase'
import ShipmentsTable, { type ShipmentRow, type CellarContents } from '@/app/admin/_components/ShipmentsTable'

export default async function ShipmentsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/admin/login')

  const sb = createServiceClient()

  const [{ data: shipments, error: shipmentsError }, { data: cellarRows }] = await Promise.all([
    sb
      .from('shipments')
      .select(
        'id, status, type, tracking_number, shipping_address, created_at, dispatched_at, delivered_at, ' +
        'bottle_count, courier_collection_date, courier_collection_location, collection_date, collection_venue, collection_time, ' +
        'customers(id, first_name, last_name, phone, email)'
      )
      .not('status', 'in', '("delivered","dispatched")')
      .order('created_at', { ascending: false }),
    sb
      .from('cellar')
      .select('shipment_id, quantity, wines(name)')
      .not('shipment_id', 'is', null),
  ])

  if (shipmentsError) {
    console.error('[admin/shipments] query error', shipmentsError)
  }

  // Group cellar rows by shipment_id
  const contents: CellarContents = {}
  for (const row of cellarRows ?? []) {
    const sid = row.shipment_id as string
    const wineName = (row.wines as unknown as { name: string } | null)?.name ?? 'Unknown'
    if (!contents[sid]) contents[sid] = []
    const existing = contents[sid].find((w) => w.name === wineName)
    if (existing) {
      existing.quantity += row.quantity
    } else {
      contents[sid].push({ name: wineName, quantity: row.quantity })
    }
  }

  const allShipments = (shipments ?? []) as unknown as ShipmentRow[]

  const pending = allShipments.filter((s) => s.status === 'pending').length
  const collectionBooked = allShipments.filter((s) => s.status === 'collection_booked').length
  const summaryParts: React.ReactNode[] = []
  if (pending > 0) summaryParts.push(<span key="p" className="text-amber-700 font-medium">{pending} pending</span>)
  if (collectionBooked > 0) summaryParts.push(<span key="cb" className="text-purple-700 font-medium">{collectionBooked} collection booked</span>)

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Shipments</h1>
        {summaryParts.length > 0 && (
          <p className="text-sm text-gray-500 mt-0.5">
            {summaryParts.reduce<React.ReactNode[]>((acc, el, i) => {
              if (i > 0) acc.push(<span key={`sep-${i}`}> · </span>)
              acc.push(el)
              return acc
            }, [])}
          </p>
        )}
      </div>

      <ShipmentsTable shipments={allShipments} contents={contents} />
    </div>
  )
}
