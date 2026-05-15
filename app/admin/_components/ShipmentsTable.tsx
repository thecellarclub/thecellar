'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import ShipmentActions from './ShipmentActions'

export type ShipmentRow = {
  id: string
  status: string
  type: string
  tracking_number: string | null
  shipping_address: { line1?: string; line2?: string | null; city?: string; postcode?: string } | null
  created_at: string
  dispatched_at: string | null
  delivered_at: string | null
  courier_collection_date: string | null
  courier_collection_location: string | null
  collection_date: string | null
  collection_venue: string | null
  bottle_count: number
  customers: { id: string; first_name: string; phone: string } | null
}

export type CellarContents = Record<string, { name: string; quantity: number }[]>

type SortKey = 'customer' | 'status' | 'created' | 'collection'
type SortDir = 'asc' | 'desc'
type TypeFilter = 'all' | 'delivery' | 'collection'

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700',
    collection_booked: 'bg-purple-100 text-purple-700',
    confirmed: 'bg-purple-100 text-purple-700',
    dispatched: 'bg-blue-100 text-blue-700',
    delivered: 'bg-green-100 text-green-700',
  }
  const labels: Record<string, string> = {
    collection_booked: 'collection booked',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded font-medium ${styles[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {labels[status] ?? status}
    </span>
  )
}

function formatShortDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getDate()} ${d.toLocaleDateString('en-GB', { month: 'short' })}`
}

function getCollectionDateStyle(dateStr: string | null, status: string): string {
  if (!dateStr) return 'text-gray-400'
  const date = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  date.setHours(0, 0, 0, 0)
  const diffDays = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  const isActive = status === 'pending' || status === 'collection_booked'
  if (isActive && diffDays <= 0) return 'text-red-600 font-semibold'
  if (isActive && diffDays <= 3) return 'text-amber-600 font-medium'
  return 'text-gray-600'
}

function Contents({ items, bottleCount }: { items: { name: string; quantity: number }[] | undefined; bottleCount: number }) {
  if (!items || items.length === 0) return <span className="text-gray-400">—</span>
  return (
    <div>
      <div className="text-gray-700 text-xs space-y-0.5">
        {items.map((i, idx) => (
          <div key={idx}>{i.name} ×{i.quantity}</div>
        ))}
      </div>
      <div className="text-gray-400 text-xs mt-1">({bottleCount} bottle{bottleCount !== 1 ? 's' : ''})</div>
    </div>
  )
}

function SortHeader({
  label, sortKey, activeKey, dir, onSort,
}: {
  label: string
  sortKey: SortKey
  activeKey: SortKey
  dir: SortDir
  onSort: (k: SortKey) => void
}) {
  const active = activeKey === sortKey
  return (
    <th
      className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide border-b border-gray-200 px-4 py-2 bg-gray-50 cursor-pointer select-none hover:text-gray-700 whitespace-nowrap"
      onClick={() => onSort(sortKey)}
    >
      {label}
      <span className="ml-1 text-gray-400">{active ? (dir === 'asc' ? '▲' : '▼') : '⇅'}</span>
    </th>
  )
}

function StaticHeader({ label }: { label: string }) {
  return (
    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide border-b border-gray-200 px-4 py-2 bg-gray-50 whitespace-nowrap">
      {label}
    </th>
  )
}

export default function ShipmentsTable({
  shipments,
  contents,
}: {
  shipments: ShipmentRow[]
  contents: CellarContents
}) {
  const [sortKey, setSortKey] = useState<SortKey>('collection')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const filtered = useMemo(
    () => (typeFilter === 'all' ? shipments : shipments.filter((s) => s.type === typeFilter)),
    [shipments, typeFilter]
  )

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'customer') {
        cmp = (a.customers?.first_name ?? '').localeCompare(b.customers?.first_name ?? '')
      } else if (sortKey === 'status') {
        cmp = a.status.localeCompare(b.status)
      } else if (sortKey === 'created') {
        cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      } else if (sortKey === 'collection') {
        const aDate = a.type === 'collection' ? a.collection_date : a.courier_collection_date
        const bDate = b.type === 'collection' ? b.collection_date : b.courier_collection_date
        if (!aDate && !bDate) cmp = 0
        else if (!aDate) cmp = 1
        else if (!bDate) cmp = -1
        else cmp = new Date(aDate).getTime() - new Date(bDate).getTime()
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

  const filterBtnCls = (active: boolean) =>
    `text-xs px-3 py-1 rounded border transition-colors ${
      active
        ? 'bg-gray-900 text-white border-gray-900'
        : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
    }`

  return (
    <div>
      {/* Type filter */}
      <div className="flex gap-2 mb-4">
        {(['all', 'delivery', 'collection'] as TypeFilter[]).map((f) => (
          <button key={f} className={filterBtnCls(typeFilter === f)} onClick={() => setTypeFilter(f)}>
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1) + 's'}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <SortHeader label="Customer" sortKey="customer" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                <StaticHeader label="Contents" />
                <StaticHeader label="Address" />
                <SortHeader label="Status" sortKey="status" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                <SortHeader label="Created" sortKey="created" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                <SortHeader label="Collection" sortKey="collection" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                <StaticHeader label="Actions" />
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-gray-500">
                    No shipments
                  </td>
                </tr>
              ) : (
                sorted.map((s) => {
                  const c = s.customers
                  const addr = s.shipping_address
                  const isCollection = s.type === 'collection'

                  // Address cell — full address for deliveries, venue for collections
                  let addressCell: React.ReactNode
                  if (isCollection) {
                    addressCell = s.collection_venue ?? 'Collection'
                  } else if (addr) {
                    const parts = [addr.line1, addr.line2, addr.city, addr.postcode].filter(Boolean)
                    addressCell = parts.length > 0 ? parts.join(', ') : '—'
                  } else {
                    addressCell = '—'
                  }

                  // Collection date cell
                  const collectionDateStr = isCollection ? s.collection_date : s.courier_collection_date
                  const collectionVenue = isCollection ? s.collection_venue : s.courier_collection_location
                  const collectionStyle = getCollectionDateStyle(collectionDateStr, s.status)

                  return (
                    <tr key={s.id} className="hover:bg-gray-50 align-top">
                      {/* Customer */}
                      <td className="px-4 py-3 border-b border-gray-100">
                        <Link href={`/admin/shipments/${s.id}`} className="hover:underline font-medium text-gray-900">
                          {c ? c.first_name : '—'}
                        </Link>
                        {c && <div className="text-gray-600 text-xs">{c.phone}</div>}
                      </td>

                      {/* Contents — widest column, one wine per line */}
                      <td className="px-4 py-3 border-b border-gray-100 w-64 max-w-xs">
                        <Contents items={contents[s.id]} bottleCount={s.bottle_count} />
                      </td>

                      {/* Address */}
                      <td className="px-4 py-3 border-b border-gray-100 text-xs text-gray-600">
                        {addressCell}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 border-b border-gray-100">
                        {isCollection && (
                          <div className="text-xs text-gray-500 mb-1">Collection</div>
                        )}
                        {!isCollection && (
                          <div className="text-xs text-gray-500 mb-1">Delivery</div>
                        )}
                        <StatusBadge status={s.status} />
                      </td>

                      {/* Created */}
                      <td className="px-4 py-3 border-b border-gray-100 text-xs text-gray-600 whitespace-nowrap">
                        {formatShortDate(s.created_at)}
                      </td>

                      {/* Collection date */}
                      <td className="px-4 py-3 border-b border-gray-100 text-xs whitespace-nowrap">
                        {collectionDateStr ? (
                          <div>
                            <span className={collectionStyle}>{formatShortDate(collectionDateStr)}</span>
                            {collectionVenue && (
                              <div className="text-gray-400 text-xs">{collectionVenue}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 border-b border-gray-100">
                        <ShipmentActions
                          shipmentId={s.id}
                          status={s.status}
                          type={s.type}
                          courierCollectionDate={s.courier_collection_date}
                          courierCollectionLocation={s.courier_collection_location}
                          trackingNumber={s.tracking_number}
                        />
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
