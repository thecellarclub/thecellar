'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export type MobileRequest = {
  id: string
  message: string
  status: string
  created_at: string
  customerName: string | null
  customerPhone: string | null
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

const LEFT_BORDER: Record<string, string> = {
  new: '#9B1B30',
  in_progress: '#d97706',
  resolved: '#16a34a',
}

const BADGE: Record<string, string> = {
  new: 'bg-red-100 text-red-700',
  in_progress: 'bg-amber-100 text-amber-700',
  resolved: 'bg-green-100 text-green-700',
}

export default function RequestsMobileCard({ request }: { request: MobileRequest }) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isLong = request.message.length > 120

  async function handleResolve() {
    setLoading(true)
    setError(null)
    const res = await fetch('/api/admin/requests', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: request.id, status: 'resolved' }),
    })
    setLoading(false)
    if (res.ok) {
      router.refresh()
    } else {
      const data = await res.json()
      setError(data.error ?? 'Update failed')
    }
  }

  return (
    <div
      className="bg-white rounded-lg border border-gray-200 p-4"
      style={{ borderLeft: `4px solid ${LEFT_BORDER[request.status] ?? '#d1d5db'}` }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 text-base leading-tight">
            {request.customerName ?? 'Unknown'}
          </p>
          <p className="text-sm text-gray-500 font-mono mt-0.5">
            {request.customerPhone ?? '—'}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span
            className={`text-xs px-2 py-0.5 rounded font-medium ${
              BADGE[request.status] ?? 'bg-gray-100 text-gray-600'
            }`}
          >
            {request.status.replace('_', ' ')}
          </span>
          <span className="text-xs text-gray-400">{timeAgo(request.created_at)}</span>
        </div>
      </div>

      {/* Message */}
      <div className="mb-3">
        <p
          className={`text-sm text-gray-700 leading-relaxed ${
            !expanded && isLong ? 'line-clamp-3' : ''
          }`}
        >
          {request.message}
        </p>
        {isLong && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="text-xs text-gray-400 underline mt-1 hover:text-gray-600 transition-colors"
          >
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>

      {/* Action */}
      {request.status !== 'resolved' && (
        <button
          onClick={handleResolve}
          disabled={loading}
          className="w-full bg-green-50 text-green-700 border border-green-200 font-medium text-sm rounded flex items-center justify-center transition-colors hover:bg-green-100 disabled:opacity-50"
          style={{ minHeight: '44px' }}
        >
          {loading ? 'Marking resolved…' : '✓ Mark resolved'}
        </button>
      )}

      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  )
}
