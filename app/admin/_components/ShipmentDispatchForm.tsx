'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  shipmentId: string
  status: string
  initialCarrier?: string
  initialTracking?: string
}

export default function ShipmentDispatchForm({
  shipmentId,
  status,
  initialCarrier = '',
  initialTracking = '',
}: Props) {
  const router = useRouter()
  const [carrier, setCarrier] = useState(initialCarrier)
  const [trackingNumber, setTrackingNumber] = useState(initialTracking)
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  async function callApi(action: 'dispatch' | 'update_tracking') {
    setLoading(true)
    setFeedback(null)

    const res = await fetch(`/api/admin/shipments/${shipmentId}/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        tracking_provider: carrier.trim() || undefined,
        tracking_number: trackingNumber.trim() || undefined,
      }),
    })

    setLoading(false)

    if (res.ok) {
      setFeedback({ type: 'success', message: action === 'dispatch' ? 'Marked as dispatched.' : 'Tracking saved.' })
      router.refresh()
    } else {
      const data = await res.json() as { error?: string }
      setFeedback({ type: 'error', message: data.error ?? 'Something went wrong' })
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Carrier</label>
          <input
            type="text"
            value={carrier}
            onChange={(e) => setCarrier(e.target.value)}
            placeholder="e.g. Royal Mail, DPD"
            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Tracking number</label>
          <input
            type="text"
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            placeholder="Tracking number"
            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => callApi('update_tracking')}
          disabled={loading}
          className="text-xs px-3 py-1.5 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {loading ? 'Saving…' : 'Save tracking'}
        </button>

        {status === 'pending' && (
          <button
            onClick={() => callApi('dispatch')}
            disabled={loading}
            className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Dispatching…' : 'Mark as dispatched'}
          </button>
        )}

        {feedback && (
          <p className={`text-xs ${feedback.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
            {feedback.message}
          </p>
        )}
      </div>
    </div>
  )
}
