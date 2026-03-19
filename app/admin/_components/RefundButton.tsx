'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  cellarId: string
  customerId: string
  maxQuantity: number
  wineName: string
}

export default function RefundButton({ cellarId, customerId, maxQuantity, wineName }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [quantity, setQuantity] = useState(maxQuantity)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refundedPence, setRefundedPence] = useState<number | null>(null)

  // Success state — show confirmation then refresh
  if (refundedPence !== null) {
    const amountStr = (refundedPence / 100).toFixed(2)
    return (
      <span className="text-xs text-green-700 font-medium">
        ✓ Refunded £{amountStr}
      </span>
    )
  }

  async function handleRefund() {
    setLoading(true)
    setError(null)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15_000)

    try {
      const res = await fetch(`/api/admin/customers/${customerId}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cellarId, quantity }),
        signal: controller.signal,
      })

      clearTimeout(timeout)

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Refund failed')
        setLoading(false)
        return
      }

      // Show success message, then refresh server data
      setRefundedPence(data.refundedPence ?? 0)
      router.refresh()
    } catch (err) {
      clearTimeout(timeout)
      const isAbort = err instanceof DOMException && err.name === 'AbortError'
      setError(isAbort ? 'Something went wrong — please try again' : 'Unexpected error')
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-700 hover:bg-amber-200 font-medium"
      >
        Refund
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-gray-500">{wineName} —</span>
      <input
        type="number"
        min={1}
        max={maxQuantity}
        value={quantity}
        onChange={(e) => setQuantity(Math.min(maxQuantity, Math.max(1, Number(e.target.value))))}
        className="w-16 text-sm border border-gray-300 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-amber-400"
        disabled={loading}
      />
      <span className="text-xs text-gray-400">/ {maxQuantity}</span>
      <button
        onClick={handleRefund}
        disabled={loading}
        className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200 font-medium disabled:opacity-50"
      >
        {loading ? '…' : 'Issue refund'}
      </button>
      <button
        onClick={() => { setOpen(false); setError(null) }}
        disabled={loading}
        className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 font-medium disabled:opacity-50"
      >
        Cancel
      </button>
      {error && <p className="text-xs text-red-600 w-full mt-0.5">{error}</p>}
    </div>
  )
}
