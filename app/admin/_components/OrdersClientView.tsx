'use client'

import { useState, useMemo } from 'react'
import { formatDateTime, penceToGbp } from '@/lib/format'

type Order = {
  id: string
  quantity: number
  price_pence: number
  total_pence: number
  stripe_charge_status: string
  order_status: string
  created_at: string
  wine_id: string
  customer_id: string
  wines: { name: string } | null
  customers: { first_name: string; phone: string } | null
}

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'succeeded', label: 'Succeeded' },
  { value: 'failed', label: 'Failed' },
  { value: 'pending', label: 'Pending' },
  { value: 'requires_action', label: 'Requires action' },
  { value: 'awaiting_confirmation', label: 'Awaiting confirmation' },
  { value: 'expired', label: 'Expired' },
]

const STATUS_STYLES: Record<string, string> = {
  succeeded: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  requires_action: 'bg-amber-100 text-amber-700',
  pending: 'bg-gray-100 text-gray-600',
  refunded: 'bg-gray-100 text-gray-600',
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status.replace('_', ' ')}
    </span>
  )
}

export default function OrdersClientView({ orders }: { orders: Order[] }) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return orders.filter((o) => {
      if (q) {
        const wineName = o.wines?.name?.toLowerCase() ?? ''
        const firstName = o.customers?.first_name?.toLowerCase() ?? ''
        const phone = o.customers?.phone?.toLowerCase() ?? ''
        if (!wineName.includes(q) && !firstName.includes(q) && !phone.includes(q)) return false
      }

      if (statusFilter) {
        const effectiveStatus =
          o.order_status === 'expired' ? 'expired' :
          o.order_status === 'awaiting_confirmation' && statusFilter === 'awaiting_confirmation'
            ? 'awaiting_confirmation'
            : o.stripe_charge_status
        if (effectiveStatus !== statusFilter) return false
      }

      if (dateFrom) {
        if (new Date(o.created_at) < new Date(dateFrom)) return false
      }
      if (dateTo) {
        const to = new Date(dateTo)
        to.setDate(to.getDate() + 1)
        if (new Date(o.created_at) >= to) return false
      }

      return true
    })
  }, [orders, search, statusFilter, dateFrom, dateTo])

  const inputCls = 'text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-400 bg-white'

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 items-end">
        <input
          type="search"
          placeholder="Search wine, customer…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${inputCls} w-56`}
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={inputCls}>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <div className="flex items-center gap-1">
          <label className="text-xs text-gray-500">From</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputCls} />
        </div>
        <div className="flex items-center gap-1">
          <label className="text-xs text-gray-500">To</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputCls} />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 py-2 border-b border-gray-200">
          <p className="text-sm text-gray-500">
            Orders{' '}
            <span className="font-medium text-gray-900">
              ({filtered.length}{filtered.length !== orders.length ? ` / ${orders.length}` : ''})
            </span>
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                {['Date', 'Customer', 'Wine', 'Qty', 'Amount', 'Status'].map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide border-b border-gray-200 px-4 py-2 bg-gray-50">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-500">No orders match</td>
                </tr>
              ) : (
                filtered.map((o) => {
                  const isAwaitingOrExpired =
                    o.order_status === 'awaiting_confirmation' || o.order_status === 'expired'
                  return (
                    <tr key={o.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 border-b border-gray-100 text-gray-600 text-xs whitespace-nowrap">
                        {formatDateTime(o.created_at)}
                      </td>
                      <td className="px-4 py-2.5 border-b border-gray-100">
                        <span className="font-medium text-gray-900">{o.customers?.first_name ?? '—'}</span>
                        {o.customers?.phone && (
                          <span className="block text-xs text-gray-600">{o.customers.phone}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 border-b border-gray-100 text-gray-700">{o.wines?.name ?? '—'}</td>
                      <td className="px-4 py-2.5 border-b border-gray-100 text-gray-700">{o.quantity}</td>
                      <td className="px-4 py-2.5 border-b border-gray-100 text-gray-700">{penceToGbp(o.total_pence)}</td>
                      <td className="px-4 py-2.5 border-b border-gray-100">
                        <StatusBadge status={o.stripe_charge_status} />
                        {isAwaitingOrExpired && (
                          <span className="block text-xs text-gray-500 mt-0.5">{o.order_status.replace('_', ' ')}</span>
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
    </div>
  )
}
