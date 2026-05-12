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

function formatCollectionDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  const s = ['th', 'st', 'nd', 'rd']
  const n = d.getDate()
  const v = n % 100
  const ord = n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
  const weekday = d.toLocaleDateString('en-GB', { weekday: 'short' })
  const month = d.toLocaleDateString('en-GB', { month: 'short' })
  return `${weekday} ${ord} ${month}`
}

function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}:${String(m).padStart(2, '0')}${ampm}`
}

export default function CollectCellarForm({ customerId, entries }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [scheduling, setScheduling] = useState(false)
  const [venue, setVenue] = useState<'crush' | 'norse' | null>(null)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const today = new Date().toISOString().slice(0, 10)

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setError(null)
    setScheduling(false)
  }

  function cancelScheduling() {
    setScheduling(false)
    setVenue(null)
    setDate('')
    setTime('')
    setError(null)
  }

  const selectedEntries = entries.filter((e) => selected.has(e.id))
  const selectedBottles = selectedEntries.reduce((s, e) => s + e.quantity, 0)

  const confirmLabel = (() => {
    if (!venue || !date) return 'Confirm'
    const parts = [`${selectedBottles} bottle${selectedBottles !== 1 ? 's' : ''}`, `from ${venue === 'crush' ? 'Crush' : 'Norse'}`, formatCollectionDate(date)]
    if (time) parts.push(`at ${formatTime(time)}`)
    return `Confirm — ${parts.join(', ')}`
  })()

  async function confirm() {
    if (!venue || !date) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/customers/${customerId}/collect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cellarIds: [...selected],
          venue,
          date,
          time: time || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to schedule collection')
        return
      }
      setSelected(new Set())
      cancelScheduling()
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
        <div className="px-4 py-3 border-t border-gray-100 space-y-3">
          {error && <p className="text-xs text-red-600">{error}</p>}

          {!scheduling ? (
            <button
              type="button"
              onClick={() => setScheduling(true)}
              disabled={selected.size === 0 || loading}
              className="text-sm px-3 py-1.5 rounded bg-gray-900 text-white hover:bg-gray-700 font-medium disabled:opacity-50"
            >
              Schedule collection
            </button>
          ) : (
            <div className="space-y-3 max-w-sm">
              {/* Venue */}
              <div>
                <p className="text-xs font-medium text-gray-700 mb-1.5">Venue</p>
                <div className="flex gap-2">
                  {(['crush', 'norse'] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setVenue(v)}
                      disabled={loading}
                      className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                        venue === v
                          ? 'bg-gray-900 text-white border-gray-900'
                          : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {v === 'crush' ? 'Crush' : 'Norse'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1.5">Date</label>
                <input
                  type="date"
                  min={today}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  disabled={loading}
                  className="border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-400 w-full"
                />
              </div>

              {/* Time (optional) */}
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1.5">Time <span className="text-gray-400 font-normal">(optional)</span></label>
                <input
                  type="time"
                  step={900}
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  disabled={loading}
                  className="border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-400 w-full"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={confirm}
                  disabled={!venue || !date || loading}
                  className="text-sm px-3 py-1.5 rounded bg-gray-900 text-white hover:bg-gray-700 font-medium disabled:opacity-50"
                >
                  {loading ? 'Saving…' : confirmLabel}
                </button>
                <button
                  type="button"
                  onClick={cancelScheduling}
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
