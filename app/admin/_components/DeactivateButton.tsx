'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Status = 'active' | 'dormant' | 'deactivated'

export default function DeactivateButton({
  customerId,
  status,
}: {
  customerId: string
  status: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleChange(newStatus: Status) {
    if (newStatus === status) return

    if (newStatus === 'deactivated') {
      const confirmed = confirm('Deactivate this customer? They will be marked as unsubscribed.')
      if (!confirmed) return
    }

    setLoading(true)
    setError(null)

    const res = await fetch(`/api/admin/customers/${customerId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })

    setLoading(false)
    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Failed')
    } else {
      router.refresh()
    }
  }

  const options: { value: Status; label: string }[] = [
    { value: 'active', label: 'Active' },
    { value: 'dormant', label: 'Dormant' },
    { value: 'deactivated', label: 'Deactivated' },
  ]

  return (
    <div>
      <div className="flex gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => handleChange(opt.value)}
            disabled={loading || status === opt.value}
            className={`text-sm px-3 py-1 rounded font-medium disabled:opacity-50 border transition-colors ${
              status === opt.value
                ? opt.value === 'active'
                  ? 'bg-green-100 text-green-700 border-green-200 cursor-default'
                  : opt.value === 'dormant'
                  ? 'bg-amber-100 text-amber-700 border-amber-200 cursor-default'
                  : 'bg-gray-100 text-gray-500 border-gray-200 cursor-default'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}
