'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ShipmentActions({
  shipmentId,
  status,
}: {
  shipmentId: string
  status: string
}) {
  const router = useRouter()
  const [trackingNumber, setTrackingNumber] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showTrackingInput, setShowTrackingInput] = useState(false)

  async function updateStatus(newStatus: 'dispatched' | 'delivered', tracking?: string) {
    setLoading(true)
    setError(null)

    const res = await fetch(`/api/admin/shipments/${shipmentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus, tracking_number: tracking }),
    })

    setLoading(false)

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Update failed')
    } else {
      setShowTrackingInput(false)
      setTrackingNumber('')
      router.refresh()
    }
  }

  if (status === 'delivered') {
    return <span className="text-xs text-gray-400">Delivered</span>
  }

  if (status === 'dispatched') {
    return (
      <div>
        <button
          onClick={() => updateStatus('delivered')}
          disabled={loading}
          className="text-xs px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50"
        >
          {loading ? '…' : 'Mark delivered'}
        </button>
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </div>
    )
  }

  // status === 'pending' or 'confirmed'
  return (
    <div className="space-y-2">
      {showTrackingInput ? (
        <div className="flex gap-2 items-center">
          <input
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            placeholder="Tracking number"
            className="border border-gray-300 rounded px-2 py-1 text-xs text-gray-900 placeholder:text-gray-500 w-40 focus:outline-none focus:ring-1 focus:ring-gray-400"
          />
          <button
            onClick={() => updateStatus('dispatched', trackingNumber)}
            disabled={loading || !trackingNumber.trim()}
            className="text-xs px-3 py-1 bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50"
          >
            {loading ? '…' : 'Confirm'}
          </button>
          <button
            onClick={() => setShowTrackingInput(false)}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowTrackingInput(true)}
          className="text-xs px-3 py-1 bg-amber-100 text-amber-700 rounded hover:bg-amber-200"
        >
          Mark dispatched
        </button>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
