'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { SmsLogRow, FailedOrderRow } from '../page'

type Filter = 'all' | 'unparseable' | 'ambiguous' | 'quantity' | 'keyword'

export default function SmsLogClientView({
  logs,
  failedOrders,
  summary,
}: {
  logs: SmsLogRow[]
  failedOrders: FailedOrderRow[]
  summary: { total: number; byKind: Record<string, number> }
}) {
  const [filter, setFilter] = useState<Filter>('all')

  const filtered = logs.filter((row) => {
    if (filter === 'all') return true
    if (filter === 'unparseable') return row.parse_kind === 'unparseable'
    if (filter === 'ambiguous') return row.ambiguous === true
    if (filter === 'quantity') return row.parse_kind === 'quantity'
    if (filter === 'keyword') return row.parse_kind.startsWith('keyword:')
    return true
  })

  const chips: { label: string; value: Filter }[] = [
    { label: 'All', value: 'all' },
    { label: 'Unparseable', value: 'unparseable' },
    { label: 'Ambiguous', value: 'ambiguous' },
    { label: 'Quantity', value: 'quantity' },
    { label: 'Keyword', value: 'keyword' },
  ]

  return (
    <>
      {/* 24h summary */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-sm font-medium text-gray-700 mb-2">Last 24 hours — {summary.total} inbound</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(summary.byKind).map(([kind, count]) => (
            <span key={kind} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-gray-300 text-xs text-gray-700">
              <span className="font-mono">{kind}</span>
              <span className="font-semibold">{count}</span>
            </span>
          ))}
          {Object.keys(summary.byKind).length === 0 && (
            <span className="text-xs text-gray-400">No messages in the last 24h</span>
          )}
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        {chips.map((chip) => (
          <button
            key={chip.value}
            onClick={() => setFilter(chip.value)}
            className={
              'px-3 py-1 rounded-full text-sm font-medium border transition-colors ' +
              (filter === chip.value
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400')
            }
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Inbound log table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 mb-10">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Time</th>
              <th className="px-3 py-2 text-left font-medium">Phone</th>
              <th className="px-3 py-2 text-left font-medium">Raw message</th>
              <th className="px-3 py-2 text-left font-medium">Outcome</th>
              <th className="px-3 py-2 text-left font-medium">Qty</th>
              <th className="px-3 py-2 text-left font-medium">Offer</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-gray-400 text-sm">
                  No rows match this filter.
                </td>
              </tr>
            )}
            {filtered.map((row) => (
              <tr key={row.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-500 whitespace-nowrap font-mono text-xs">
                  {new Date(row.created_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {row.customers ? (
                    <Link
                      href={`/admin/customers/${row.customers.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {row.customers.first_name ?? row.inbound_phone}
                    </Link>
                  ) : (
                    <span className="text-gray-500 font-mono text-xs">{row.inbound_phone}</span>
                  )}
                </td>
                <td className="px-3 py-2 max-w-xs truncate text-gray-800" title={row.raw_message}>
                  {row.raw_message}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <span className={
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ' +
                    (row.parse_kind === 'unparseable'
                      ? 'bg-red-100 text-red-700'
                      : row.parse_kind === 'quantity'
                      ? 'bg-green-100 text-green-700'
                      : row.parse_kind.startsWith('keyword:')
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-700')
                  }>
                    {row.parse_kind}
                    {row.ambiguous && (
                      <span className="ml-1 text-orange-500 font-bold" title="Ambiguous parse">⚠</span>
                    )}
                  </span>
                </td>
                <td className="px-3 py-2 text-gray-700">
                  {row.parse_quantity ?? '—'}
                </td>
                <td className="px-3 py-2 text-gray-500 text-xs">
                  {row.matched_text_id ? (
                    <span className="font-mono">{row.matched_text_id.slice(0, 8)}…</span>
                  ) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Open payment_failed orders */}
      <h2 className="text-base font-semibold text-gray-900 mb-3">
        Open failed payments{' '}
        {failedOrders.length > 0 && (
          <span className="text-sm font-normal text-red-600">({failedOrders.length})</span>
        )}
      </h2>

      {failedOrders.length === 0 ? (
        <p className="text-sm text-gray-400">No open failed payments.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Customer</th>
                <th className="px-3 py-2 text-left font-medium">Wine</th>
                <th className="px-3 py-2 text-left font-medium">Qty</th>
                <th className="px-3 py-2 text-left font-medium">Total</th>
                <th className="px-3 py-2 text-left font-medium">Failed at</th>
                <th className="px-3 py-2 text-left font-medium">Attempts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {failedOrders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 whitespace-nowrap">
                    {order.customers ? (
                      <Link
                        href={`/admin/customers/${order.customers.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {order.customers.first_name ?? order.customers.phone ?? order.customer_id}
                      </Link>
                    ) : (
                      <span className="text-gray-500 font-mono text-xs">{order.customer_id}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-800">{order.wines?.name ?? '—'}</td>
                  <td className="px-3 py-2 text-gray-700">{order.quantity}</td>
                  <td className="px-3 py-2 text-gray-700">£{(order.total_pence / 100).toFixed(2)}</td>
                  <td className="px-3 py-2 text-gray-500 whitespace-nowrap font-mono text-xs">
                    {order.payment_failed_at
                      ? new Date(order.payment_failed_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })
                      : '—'}
                  </td>
                  <td className="px-3 py-2 text-gray-700">{order.payment_failed_attempts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
