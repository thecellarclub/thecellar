'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import type { SmsMessageRow } from '../page'

type DirectionFilter = 'all' | 'inbound' | 'outbound'

export default function SmsLogClientView({ messages }: { messages: SmsMessageRow[] }) {
  const [search, setSearch] = useState('')
  const [direction, setDirection] = useState<DirectionFilter>('all')
  const [customerFilter, setCustomerFilter] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  const PAGE_SIZE = 100

  const filtered = useMemo(() => {
    let rows = messages

    if (customerFilter) {
      rows = rows.filter((r) => r.customer_id === customerFilter || r.phone === customerFilter)
    }

    if (direction !== 'all') {
      rows = rows.filter((r) => r.direction === direction)
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      rows = rows.filter(
        (r) =>
          r.body.toLowerCase().includes(q) ||
          r.phone.includes(q) ||
          (r.customers?.first_name?.toLowerCase().includes(q) ?? false)
      )
    }

    return rows
  }, [messages, direction, search, customerFilter])

  const paginated = filtered.slice(0, page * PAGE_SIZE)
  const hasMore = filtered.length > paginated.length

  function handleCustomerClick(row: SmsMessageRow) {
    const key = row.customer_id ?? row.phone
    setCustomerFilter((prev) => (prev === key ? null : key))
    setPage(1)
  }

  return (
    <>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          placeholder="Search messages or names…"
          className="border border-gray-300 rounded px-3 py-1.5 text-sm w-56 focus:outline-none focus:ring-1 focus:ring-gray-400"
        />
        <div className="flex rounded border border-gray-300 overflow-hidden text-sm">
          {(['all', 'inbound', 'outbound'] as DirectionFilter[]).map((d) => (
            <button
              key={d}
              onClick={() => { setDirection(d); setPage(1) }}
              className={`px-3 py-1.5 capitalize ${direction === d ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              {d}
            </button>
          ))}
        </div>
        {customerFilter && (
          <button
            onClick={() => setCustomerFilter(null)}
            className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded flex items-center gap-1 hover:bg-blue-200"
          >
            Conversation view — click to clear ×
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-3 py-2 text-left font-medium whitespace-nowrap">Time</th>
              <th className="px-3 py-2 text-left font-medium">Dir</th>
              <th className="px-3 py-2 text-left font-medium">Customer</th>
              <th className="px-3 py-2 text-left font-medium">Message</th>
              <th className="px-3 py-2 text-left font-medium">Trigger</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paginated.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-gray-500 text-sm">
                  No messages match.
                </td>
              </tr>
            )}
            {paginated.map((row) => (
              <tr key={row.id} className="hover:bg-gray-50 align-top">
                <td className="px-3 py-2 text-gray-500 whitespace-nowrap font-mono text-xs">
                  {new Date(row.created_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
                </td>
                <td className="px-3 py-2 text-center text-base leading-none pt-2.5">
                  {row.direction === 'inbound' ? (
                    <span className="text-blue-500" title="inbound">↓</span>
                  ) : (
                    <span className="text-green-600" title="outbound">↑</span>
                  )}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {row.customers ? (
                    <span className="flex flex-col gap-0.5">
                      <button
                        onClick={() => handleCustomerClick(row)}
                        className="text-blue-600 hover:underline text-left font-medium text-sm"
                        title="Click to filter conversation"
                      >
                        {row.customers.first_name ?? row.phone}
                      </button>
                      <Link
                        href={`/admin/customers/${row.customers.id}`}
                        className="text-gray-500 font-mono text-xs hover:text-gray-700"
                      >
                        {row.phone}
                      </Link>
                    </span>
                  ) : (
                    <button
                      onClick={() => handleCustomerClick(row)}
                      className="text-gray-600 font-mono text-xs hover:underline"
                    >
                      {row.phone}
                    </button>
                  )}
                </td>
                <td className="px-3 py-2 text-gray-800 font-mono text-xs whitespace-pre-wrap max-w-sm">
                  {row.body}
                </td>
                <td className="px-3 py-2">
                  {row.trigger ? (
                    <span className="inline-block px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-600 font-mono">
                      {row.trigger}
                    </span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <div className="mt-4 text-center">
          <button
            onClick={() => setPage((p) => p + 1)}
            className="text-sm px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
          >
            Load more ({filtered.length - paginated.length} remaining)
          </button>
        </div>
      )}
    </>
  )
}
