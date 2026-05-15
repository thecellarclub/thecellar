'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

function formatCourierDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  const s = ['th', 'st', 'nd', 'rd']
  const n = d.getDate()
  const v = n % 100
  const ord = n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
  const weekday = d.toLocaleDateString('en-GB', { weekday: 'short' })
  const month = d.toLocaleDateString('en-GB', { month: 'short' })
  return `${weekday} ${ord} ${month}`
}

export default function ShipmentActions({
  shipmentId,
  status,
  type,
  courierCollectionDate,
  courierCollectionLocation,
  trackingNumber,
}: {
  shipmentId: string
  status: string
  type?: string | null
  courierCollectionDate?: string | null
  courierCollectionLocation?: string | null
  trackingNumber?: string | null
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Booking form state (pending/confirmed → collection_booked)
  const [showBooking, setShowBooking] = useState(false)
  const [bookingLocation, setBookingLocation] = useState<'crush' | 'norse' | null>(null)
  const [bookingDate, setBookingDate] = useState('')
  const [bookingTracking, setBookingTracking] = useState('')

  // Dispatch form state (collection_booked → dispatched)
  const [showDispatch, setShowDispatch] = useState(false)
  const [dispatchTracking, setDispatchTracking] = useState(trackingNumber ?? '')

  const today = new Date().toISOString().slice(0, 10)

  // ── Bar pickup (collection) shipments ──────────────────────────────────────
  if (type === 'collection') {
    if (status === 'delivered') return <span className="text-xs text-gray-500">Collected</span>
    return (
      <div>
        <button
          onClick={async () => {
            setLoading(true)
            setError(null)
            const res = await fetch(`/api/admin/shipments/${shipmentId}/complete-collection`, { method: 'POST' })
            setLoading(false)
            if (!res.ok) {
              const data = await res.json()
              setError(data.error ?? 'Failed')
            } else {
              router.refresh()
            }
          }}
          disabled={loading}
          className="text-xs px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50"
        >
          {loading ? '…' : 'Mark collected'}
        </button>
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </div>
    )
  }

  // ── Delivery shipments ─────────────────────────────────────────────────────
  if (status === 'delivered') return <span className="text-xs text-gray-500">Delivered</span>

  if (status === 'dispatched') {
    return (
      <div>
        <button
          onClick={async () => {
            setLoading(true)
            setError(null)
            const res = await fetch(`/api/admin/shipments/${shipmentId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'delivered' }),
            })
            setLoading(false)
            if (!res.ok) {
              const data = await res.json()
              setError(data.error ?? 'Update failed')
            } else {
              router.refresh()
            }
          }}
          disabled={loading}
          className="text-xs px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50"
        >
          {loading ? '…' : 'Mark complete'}
        </button>
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </div>
    )
  }

  if (status === 'collection_booked') {
    const locLabel = courierCollectionLocation === 'crush' ? 'Crush' : courierCollectionLocation === 'norse' ? 'Norse' : courierCollectionLocation ?? ''
    const dateLabel = courierCollectionDate ? formatCourierDate(courierCollectionDate) : ''

    return (
      <div className="space-y-2">
        {(locLabel || dateLabel) && (
          <p className="text-xs text-gray-600">
            {[locLabel, dateLabel].filter(Boolean).join(' · ')}
            {trackingNumber && <span className="ml-1 font-mono">{trackingNumber}</span>}
          </p>
        )}
        {!showDispatch ? (
          <button
            onClick={() => setShowDispatch(true)}
            className="text-xs px-3 py-1 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200"
          >
            Mark dispatched
          </button>
        ) : (
          <div className="space-y-1.5">
            <input
              value={dispatchTracking}
              onChange={(e) => setDispatchTracking(e.target.value)}
              placeholder="Tracking number (optional)"
              className="border border-gray-300 rounded px-2 py-1 text-xs text-gray-900 placeholder:text-gray-500 w-44 focus:outline-none focus:ring-1 focus:ring-gray-400"
            />
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  setLoading(true)
                  setError(null)
                  const res = await fetch(`/api/admin/shipments/${shipmentId}/dispatch`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      action: 'dispatch',
                      tracking_number: dispatchTracking.trim() || undefined,
                    }),
                  })
                  setLoading(false)
                  if (!res.ok) {
                    const data = await res.json()
                    setError(data.error ?? 'Failed')
                  } else {
                    router.refresh()
                  }
                }}
                disabled={loading}
                className="text-xs px-3 py-1 bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50"
              >
                {loading ? '…' : 'Confirm'}
              </button>
              <button onClick={() => setShowDispatch(false)} className="text-xs text-gray-500 hover:text-gray-600">Cancel</button>
            </div>
          </div>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    )
  }

  // status === 'pending' — Confirm shipment (pending → confirmed)
  if (status === 'pending') {
    return (
      <div>
        <button
          onClick={async () => {
            setLoading(true)
            setError(null)
            const res = await fetch(`/api/admin/shipments/${shipmentId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'confirmed' }),
            })
            setLoading(false)
            if (!res.ok) {
              const data = await res.json()
              setError(data.error ?? 'Update failed')
            } else {
              router.refresh()
            }
          }}
          disabled={loading}
          className="text-xs px-3 py-1 bg-amber-100 text-amber-700 rounded hover:bg-amber-200 disabled:opacity-50"
        >
          {loading ? '…' : 'Confirm shipment'}
        </button>
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </div>
    )
  }

  // status === 'confirmed' — Book courier collection
  return (
    <div className="space-y-2">
      {!showBooking ? (
        <button
          onClick={() => setShowBooking(true)}
          className="text-xs px-3 py-1 bg-amber-100 text-amber-700 rounded hover:bg-amber-200"
        >
          Book collection
        </button>
      ) : (
        <div className="space-y-2">
          {/* Location */}
          <div className="flex gap-1.5">
            {(['crush', 'norse'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setBookingLocation(v)}
                disabled={loading}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  bookingLocation === v
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {v === 'crush' ? 'Crush' : 'Norse'}
              </button>
            ))}
          </div>
          {/* Date */}
          <input
            type="date"
            min={today}
            value={bookingDate}
            onChange={(e) => setBookingDate(e.target.value)}
            disabled={loading}
            className="border border-gray-300 rounded px-2 py-1 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-400 w-36"
          />
          {/* Tracking (optional) */}
          <input
            value={bookingTracking}
            onChange={(e) => setBookingTracking(e.target.value)}
            placeholder="Tracking (optional)"
            disabled={loading}
            className="border border-gray-300 rounded px-2 py-1 text-xs text-gray-900 placeholder:text-gray-500 w-44 focus:outline-none focus:ring-1 focus:ring-gray-400"
          />
          <div className="flex gap-2">
            <button
              onClick={async () => {
                if (!bookingLocation || !bookingDate) return
                setLoading(true)
                setError(null)
                const res = await fetch(`/api/admin/shipments/${shipmentId}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    status: 'collection_booked',
                    courier_collection_location: bookingLocation,
                    courier_collection_date: bookingDate,
                    tracking_number: bookingTracking.trim() || undefined,
                  }),
                })
                setLoading(false)
                if (!res.ok) {
                  const data = await res.json()
                  setError(data.error ?? 'Failed')
                } else {
                  router.refresh()
                }
              }}
              disabled={!bookingLocation || !bookingDate || loading}
              className="text-xs px-3 py-1 bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50"
            >
              {loading ? '…' : 'Confirm'}
            </button>
            <button
              onClick={() => { setShowBooking(false); setBookingLocation(null); setBookingDate(''); setBookingTracking('') }}
              className="text-xs text-gray-500 hover:text-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
