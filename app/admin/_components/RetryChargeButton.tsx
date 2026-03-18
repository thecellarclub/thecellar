'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RetryChargeButton({ orderId }: { orderId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ status: string; authenticateUrl?: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function retry() {
    setLoading(true)
    setError(null)
    setResult(null)

    const res = await fetch(`/api/admin/billing/retry/${orderId}`, { method: 'POST' })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error ?? 'Retry failed')
      return
    }

    setResult(data)
    if (data.status === 'succeeded') router.refresh()
  }

  if (result) {
    if (result.status === 'succeeded') {
      return <span className="text-xs text-green-700 font-medium">✓ Payment succeeded</span>
    }
    if (result.status === 'requires_action' && result.authenticateUrl) {
      return (
        <a
          href={result.authenticateUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-700 underline"
        >
          3DS required — open link
        </a>
      )
    }
    return <span className="text-xs text-red-600">Payment failed again</span>
  }

  return (
    <div>
      <button
        onClick={retry}
        disabled={loading}
        className="text-xs px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50"
      >
        {loading ? 'Retrying…' : 'Retry charge'}
      </button>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}
