'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  orderId: string
  customerId: string
  wineName: string
}

export default function CancelOrderButton({ orderId, customerId, wineName }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  if (done) {
    return <span className="text-xs text-gray-500 font-medium">Cancelled</span>
  }

  async function handleCancel() {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/admin/customers/${customerId}/cancel-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Cancel failed')
        setLoading(false)
        return
      }

      setDone(true)
      router.refresh()
    } catch {
      setError('Unexpected error')
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs px-2 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100 font-medium"
      >
        Cancel order
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-gray-500">Cancel order for {wineName}?</span>
      <button
        onClick={handleCancel}
        disabled={loading}
        className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200 font-medium disabled:opacity-50"
      >
        {loading ? '…' : 'Confirm cancel'}
      </button>
      <button
        onClick={() => { setOpen(false); setError(null) }}
        disabled={loading}
        className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 font-medium disabled:opacity-50"
      >
        Keep
      </button>
      {error && <p className="text-xs text-red-600 w-full mt-0.5">{error}</p>}
    </div>
  )
}
