'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { formatDate } from '@/lib/format'

type Customer = {
  id: string
  first_name: string | null
  phone: string
  email: string | null
  active: boolean
  subscribed_at: string
  tier: string | null
}

const TIER_OPTIONS = [
  { value: '', label: 'All tiers' },
  { value: 'bailey', label: 'Bailey' },
  { value: 'elvet', label: 'Elvet' },
  { value: 'palatine', label: 'Palatine' },
]

export default function CustomersClientView({
  customers,
  totalsMap,
}: {
  customers: Customer[]
  totalsMap: Map<string, number>
}) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [tierFilter, setTierFilter] = useState('')

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return customers.filter((c) => {
      if (q) {
        const name = c.first_name?.toLowerCase() ?? ''
        const phone = c.phone.toLowerCase()
        const email = c.email?.toLowerCase() ?? ''
        if (!name.includes(q) && !phone.includes(q) && !email.includes(q)) return false
      }
      if (statusFilter === 'active' && !c.active) return false
      if (statusFilter === 'inactive' && c.active) return false
      if (tierFilter && (c.tier ?? 'bailey') !== tierFilter) return false
      return true
    })
  }, [customers, search, statusFilter, tierFilter])

  const inputCls = 'text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-400 bg-white'

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 items-end">
        <input
          type="search"
          placeholder="Search name, phone, email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${inputCls} w-56`}
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={inputCls}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <select value={tierFilter} onChange={(e) => setTierFilter(e.target.value)} className={inputCls}>
          {TIER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <div className="px-4 py-2 border-b border-gray-200">
          <p className="text-sm text-gray-500">
            Customers{' '}
            <span className="font-medium text-gray-900">
              ({filtered.length}{filtered.length !== customers.length ? ` / ${customers.length}` : ''})
            </span>
          </p>
        </div>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              {['Name', 'Phone', 'Email', 'Cellar', 'Joined', 'Tier', 'Status'].map((h) => (
                <th key={h} className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide border-b border-gray-200 px-4 py-2 bg-gray-50">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">No customers match</td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 border-b border-gray-100">
                    <Link href={`/admin/customers/${c.id}`} className="font-medium text-gray-900 hover:underline">
                      {c.first_name ?? '—'}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 border-b border-gray-100 font-mono text-xs text-gray-600">{c.phone}</td>
                  <td className="px-4 py-2.5 border-b border-gray-100 text-gray-600">{c.email}</td>
                  <td className="px-4 py-2.5 border-b border-gray-100">
                    <span className="font-medium">{totalsMap.get(c.id) ?? 0}</span>
                    <span className="text-gray-600 text-xs ml-1">bottles</span>
                  </td>
                  <td className="px-4 py-2.5 border-b border-gray-100 text-gray-600 text-xs">{formatDate(c.subscribed_at)}</td>
                  <td className="px-4 py-2.5 border-b border-gray-100 text-gray-600 capitalize text-xs">{c.tier ?? 'bailey'}</td>
                  <td className="px-4 py-2.5 border-b border-gray-100">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${c.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {c.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
