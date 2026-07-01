'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function FreeShippingAt6Toggle({
  customerId,
  enabled,
}: {
  customerId: string
  enabled: boolean
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function toggle() {
    setLoading(true)
    setError(null)

    const res = await fetch(`/api/admin/customers/${customerId}/free-shipping-at-6`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !enabled }),
    })

    setLoading(false)
    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Failed')
    } else {
      router.refresh()
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <button
          onClick={toggle}
          disabled={loading}
          role="switch"
          aria-checked={enabled}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${
            enabled ? 'bg-green-600' : 'bg-gray-300'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              enabled ? 'translate-x-4' : 'translate-x-1'
            }`}
          />
        </button>
        <span className="text-sm text-gray-700">Free shipping at 6 bottles (one-time)</span>
      </div>
      <p className="text-xs text-gray-500 mt-1">
        {enabled
          ? 'Auto-clears after this customer\'s next shipment.'
          : 'Grants free shipping at 6 bottles instead of 12, once.'}
      </p>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}
