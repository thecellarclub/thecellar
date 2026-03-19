'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ResolveButton({
  requestId,
  currentStatus,
}: {
  requestId: string
  currentStatus: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (currentStatus === 'resolved') return null

  async function handleResolve() {
    setLoading(true)
    setError(null)

    const res = await fetch('/api/admin/requests', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: requestId, status: 'resolved' }),
    })

    setLoading(false)

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Update failed')
    } else {
      router.refresh()
    }
  }

  return (
    <div>
      <button
        onClick={handleResolve}
        disabled={loading}
        className="text-xs px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50"
      >
        {loading ? '…' : 'Resolve'}
      </button>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}
