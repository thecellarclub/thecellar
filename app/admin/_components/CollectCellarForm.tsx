'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

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

interface Props {
  customerId: string
  entries: CellarEntry[]
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  const s = ['th', 'st', 'nd', 'rd']
  const n = d.getDate()
  const v = n % 100
  const day = n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
  const month = d.toLocaleDateString('en-GB', { month: 'short' })
  const year = d.getFullYear()
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  return `${day} ${month} ${year}, ${time}`
}

export default function CollectCellarForm({ customerId, entries }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setError(null)
    setConfirming(false)
  }

  const selectedEntries = entries.filter((e) => selected.has(e.id))
  const selectedBottles = selectedEntries.reduce((s, e) => s + e.quantity, 0)

  async function confirm() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/customers/${customerId}/collect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cellarIds: [...selected] }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to record collection')
        setConfirming(false)
        return
      }
      setSelected(new Set())
      setConfirming(false)
      router.refresh()
    } catch {
      setError('Unexpected error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              {['', 'Wine', 'Qty', 'Added'].map((h, i) => (
                <th key={i} className="text-left text-xs font-medium text-gray-600 uppercase tracking-wide border-b border-gray-200 px-4 py-2 bg-gray-50">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-500">Cellar empty</td></tr>
            ) : (
              entries.map((e) => {
                const wine = e.wines
                return (
                  <tr key={e.id} className="hover:bg-gray-50 align-top">
                    <td className="px-4 py-2.5 border-b border-gray-100 w-8">
                      <input
                        type="checkbox"
                        checked={selected.has(e.id)}
                        onChange={() => toggle(e.id)}
                        disabled={loading}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-4 py-2.5 border-b border-gray-100">
                      <p className="font-medium text-gray-900">{wine?.name ?? '—'}</p>
                      {(wine?.producer || wine?.region || wine?.vintage) && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {[wine?.producer, wine?.region, wine?.vintage].filter(Boolean).join(' · ')}
                        </p>
                      )}
                      {wine?.price_pence ? (
                        <p className="text-xs text-gray-500">£{(wine.price_pence / 100).toFixed(0)}/bottle</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5 border-b border-gray-100 text-gray-700">{e.quantity}</td>
                    <td className="px-4 py-2.5 border-b border-gray-100 text-gray-500 text-xs whitespace-nowrap">{formatDateTime(e.added_at)}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {entries.length > 0 && (
        <div className="px-4 py-3 border-t border-gray-100 space-y-2">
          {error && <p className="text-xs text-red-600">{error}</p>}

          {!confirming ? (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={selected.size === 0 || loading}
              className="text-sm px-3 py-1.5 rounded bg-gray-900 text-white hover:bg-gray-700 font-medium disabled:opacity-50"
            >
              Mark as collected in person
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-gray-700">
                Mark <strong>{selectedBottles} bottle{selectedBottles !== 1 ? 's' : ''}</strong> as collected in person? This cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={confirm}
                  disabled={loading}
                  className="text-sm px-3 py-1.5 rounded bg-gray-900 text-white hover:bg-gray-700 font-medium disabled:opacity-50"
                >
                  {loading ? 'Saving…' : 'Confirm'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  disabled={loading}
                  className="text-sm px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
