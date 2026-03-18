'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DeactivateButton({
  customerId,
  active,
}: {
  customerId: string
  active: boolean
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleToggle() {
    if (active) {
      const confirmed = confirm('Deactivate this customer? They will be marked as unsubscribed.')
      if (!confirmed) return
    }
    setLoading(true)
    setError(null)

    const res = await fetch(`/api/admin/customers/${customerId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !active }),
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
      <button
        onClick={handleToggle}
        disabled={loading}
        className={`text-sm px-3 py-1 rounded font-medium disabled:opacity-50 ${
          active
            ? 'bg-red-100 text-red-700 hover:bg-red-200'
            : 'bg-green-100 text-green-700 hover:bg-green-200'
        }`}
      >
        {loading ? '…' : active ? 'Deactivate' : 'Reactivate'}
      </button>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}
