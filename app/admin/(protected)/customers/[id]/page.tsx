import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase'
import { penceToGbp, formatDate, formatDateTime } from '@/lib/format'
import DeactivateButton from '../../../_components/DeactivateButton'
import RefundButton from '../../../_components/RefundButton'
import AddBottlesForm from '../../../_components/AddBottlesForm'
import Link from 'next/link'

type WineDetail = {
  name: string
  producer: string | null
  region: string | null
  country: string | null
  vintage: number | null
  price_pence: number
}

type CellarEntry = {
  id: string
  quantity: number
  added_at: string
  shipped_at: string | null
  shipment_id: string | null
  order_id: string | null
  wines: WineDetail | null
}

type OrderRow = {
  id: string
  quantity: number
  price_pence: number
  total_pence: number
  stripe_charge_status: string
  created_at: string
  wine_id: string
  wines: { name: string } | null
}

type ShipmentRow = {
  id: string
  status: string
  tracking_number: string | null
  tracking_provider: string | null
  created_at: string
  dispatched_at: string | null
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    succeeded: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
    requires_action: 'bg-amber-100 text-amber-700',
    pending: 'bg-gray-100 text-gray-600',
    refunded: 'bg-gray-100 text-gray-600',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded font-medium ${styles[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  )
}

function ShipStatusBadge({ status }: { status: string }) {
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

function SectionHead({ title, count }: { title: string; count?: number | string }) {
  return (
    <div className="px-4 py-3 border-b border-gray-200 flex items-baseline gap-2">
      <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      {count !== undefined && (
        <span className="text-xs text-gray-500 font-normal">({count})</span>
      )}
    </div>
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

  const [
    { data: customer },
    { data: orders },
    { data: cellarRaw },
    { data: activeWines },
    { data: shipments },
  ] = await Promise.all([
    sb.from('customers').select('*').eq('id', id).maybeSingle(),
    sb
      .from('orders')
      .select('id, quantity, price_pence, total_pence, stripe_charge_status, created_at, wine_id, wines(name)')
      .eq('customer_id', id)
      .order('created_at', { ascending: false }),
    sb
      .from('cellar')
      .select('id, quantity, added_at, shipped_at, shipment_id, order_id, wines(name, producer, region, country, vintage, price_pence)')
      .eq('customer_id', id)
      .order('added_at', { ascending: false }),
    sb.from('wines').select('id, name').eq('active', true).order('name'),
    sb
      .from('shipments')
      .select('id, status, tracking_number, tracking_provider, created_at, dispatched_at')
      .eq('customer_id', id)
      .order('created_at', { ascending: false }),
  ])

  if (!customer) notFound()

  const cellar = (cellarRaw ?? []) as unknown as CellarEntry[]
  const orderRows = (orders ?? []) as unknown as OrderRow[]
  const shipmentRows = (shipments ?? []) as unknown as ShipmentRow[]

  const unshipped = cellar.filter((c) => !c.shipped_at)
  const shipped = cellar.filter((c) => c.shipped_at)
  const unshippedBottles = unshipped.reduce((s, c) => s + c.quantity, 0)

  // Map order_id → cellar entry (oldest unshipped first) for refund buttons
  const cellarByOrderId = new Map<string, CellarEntry>()
  for (const c of [...cellar].reverse()) {
    if (c.order_id && !c.shipped_at) {
      cellarByOrderId.set(c.order_id, c)
    }
  }

  // Group shipped cellar rows by shipment_id for the Shipped section
  const cellarByShipment = new Map<string, CellarEntry[]>()
  for (const c of shipped) {
    const key = c.shipment_id ?? '__unlinked__'
    if (!cellarByShipment.has(key)) cellarByShipment.set(key, [])
    cellarByShipment.get(key)!.push(c)
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/admin/customers" className="text-xs text-gray-400 hover:text-gray-600 mb-2 block">← Customers</Link>
          <h1 className="text-xl font-semibold text-gray-900">{customer.first_name ?? 'Unknown'}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{customer.email} · {customer.phone}</p>
        </div>
      </div>

      {/* Customer summary strip */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <p className="text-xs text-gray-600 font-medium uppercase tracking-wide mb-1">Status</p>
          <span className={`text-xs px-2 py-0.5 rounded font-medium ${customer.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {customer.active ? 'Active' : 'Inactive'}
          </span>
        </div>
        <div>
          <p className="text-xs text-gray-600 font-medium uppercase tracking-wide mb-1">Joined</p>
          <p className="font-medium">{formatDate(customer.subscribed_at)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-600 font-medium uppercase tracking-wide mb-1">Cellar</p>
          <p className="font-medium text-lg">{unshippedBottles} <span className="text-xs text-gray-500 font-normal">bottles</span></p>
        </div>
        <div>
          <p className="text-xs text-gray-600 font-medium uppercase tracking-wide mb-1">Tier</p>
          <p className="font-medium capitalize">{customer.tier ?? 'Bailey'}</p>
        </div>
      </div>

      {/* ── Section 1: Current Cellar ───────────────────────────────────────────── */}
      <div className="bg-white rounded-lg border border-gray-200">
        <SectionHead title="Current Cellar" count={`${unshipped.length} entries · ${unshippedBottles} unshipped`} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                {['Wine', 'Qty', 'Added', ''].map((h, i) => (
                  <th key={i} className="text-left text-xs font-medium text-gray-600 uppercase tracking-wide border-b border-gray-200 px-4 py-2 bg-gray-50">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {unshipped.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">Cellar empty</td></tr>
              ) : (
                unshipped.map((c) => {
                  const wine = c.wines
                  return (
                    <tr key={c.id} className="hover:bg-gray-50 align-top">
                      <td className="px-4 py-2.5 border-b border-gray-100">
                        <p className="font-medium text-gray-900">{wine?.name ?? '—'}</p>
                        {(wine?.producer || wine?.region || wine?.vintage) && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            {[wine?.producer, wine?.region, wine?.vintage].filter(Boolean).join(' · ')}
                          </p>
                        )}
                        {wine?.price_pence ? (
                          <p className="text-xs text-gray-400">£{(wine.price_pence / 100).toFixed(0)}/bottle</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-2.5 border-b border-gray-100 text-gray-700">{c.quantity}</td>
                      <td className="px-4 py-2.5 border-b border-gray-100 text-gray-500 text-xs whitespace-nowrap">{formatDateTime(c.added_at)}</td>
                      <td className="px-4 py-2.5 border-b border-gray-100">
                        {c.order_id && cellarByOrderId.has(c.order_id) && (
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
            <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Manually add bottles</h3>
          </div>
          <AddBottlesForm customerId={id} wines={activeWines ?? []} />
        </div>
      </div>

      {/* ── Section 2: Shipped ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-lg border border-gray-200">
        <SectionHead title="Shipped" count={shipmentRows.length} />
        {shipmentRows.length === 0 ? (
          <p className="px-4 py-6 text-center text-gray-400 text-sm">No shipments yet</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {shipmentRows.map((ship) => {
              const rows = cellarByShipment.get(ship.id) ?? []
              const date = ship.dispatched_at ?? ship.created_at
              return (
                <div key={ship.id} className="px-4 py-4">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <ShipStatusBadge status={ship.status} />
                    <span className="text-xs text-gray-600">{formatDate(date)}</span>
                    {ship.tracking_number ? (
                      <span className="text-xs text-gray-500 font-mono">
                        {ship.tracking_provider ? `${ship.tracking_provider} · ` : ''}{ship.tracking_number}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">No tracking</span>
                    )}
                    <Link href={`/admin/shipments/${ship.id}`} className="text-xs text-blue-600 hover:underline ml-auto">
                      View shipment →
                    </Link>
                  </div>
                  {rows.length > 0 ? (
                    <ul className="space-y-1 pl-1">
                      {rows.map((c) => {
                        const wine = c.wines
                        return (
                          <li key={c.id} className="text-sm text-gray-700 flex items-baseline gap-2">
                            <span className="text-gray-400 text-xs shrink-0">{c.quantity}×</span>
                            <span>{wine?.name ?? '—'}</span>
                            {(wine?.producer || wine?.region || wine?.vintage) && (
                              <span className="text-xs text-gray-400">{[wine?.producer, wine?.region, wine?.vintage].filter(Boolean).join(' · ')}</span>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  ) : (
                    <p className="text-xs text-gray-400 pl-1">No bottle records linked</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Section 3: Payments ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-lg border border-gray-200">
        <SectionHead title="Payments" count={orderRows.length} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                {['Wine', 'Qty', 'Amount', 'Status', 'Date', ''].map((h, i) => (
                  <th key={i} className="text-left text-xs font-medium text-gray-600 uppercase tracking-wide border-b border-gray-200 px-4 py-2 bg-gray-50">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orderRows.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">No payments</td></tr>
              ) : (
                orderRows.map((o) => {
                  const wine = o.wines
                  const cellarEntry = cellarByOrderId.get(o.id)
                  return (
                    <tr key={o.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 border-b border-gray-100 text-gray-900">{wine?.name ?? '—'}</td>
                      <td className="px-4 py-2.5 border-b border-gray-100 text-gray-700">{o.quantity}</td>
                      <td className="px-4 py-2.5 border-b border-gray-100 text-gray-700">{penceToGbp(o.total_pence)}</td>
                      <td className="px-4 py-2.5 border-b border-gray-100"><StatusBadge status={o.stripe_charge_status} /></td>
                      <td className="px-4 py-2.5 border-b border-gray-100 text-gray-500 text-xs whitespace-nowrap">{formatDateTime(o.created_at)}</td>
                      <td className="px-4 py-2.5 border-b border-gray-100">
                        {o.stripe_charge_status === 'succeeded' && cellarEntry && (
                          <RefundButton
                            cellarId={cellarEntry.id}
                            customerId={id}
                            maxQuantity={cellarEntry.quantity}
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
      </div>

      {/* ── Section 4: Admin tools ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <p className="text-xs text-gray-600 font-medium uppercase tracking-wide mb-3">Admin tools</p>
        <div className="flex items-center gap-4">
          <DeactivateButton customerId={customer.id} active={customer.active} />
        </div>
      </div>
    </div>
  )
}
