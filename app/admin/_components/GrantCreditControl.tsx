'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function GrantCreditControl({ customerId }: { customerId: string }) {
  const router = useRouter()
  const [amountPounds, setAmountPounds] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setError(null)

    const amountPence = Math.round(parseFloat(amountPounds) * 100)
    if (!amountPounds || isNaN(amountPence) || amountPence <= 0) {
      setError('Enter a valid amount')
      return
    }
    if (!reason.trim()) {
      setError('Reason is required')
      return
    }
    if (!confirm(`Grant £${(amountPence / 100).toFixed(2)} credit to this customer?`)) return

    setLoading(true)
    const res = await fetch(`/api/admin/customers/${customerId}/credit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amountPence, reason: reason.trim() }),
    })
    setLoading(false)

    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setError(data?.error ?? 'Grant failed')
      return
    }

    setAmountPounds('')
    setReason('')
    router.refresh()
  }

  return (
    <div>
      <p className="text-sm text-gray-700 mb-2">Grant credit</p>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-sm">£</span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={amountPounds}
            onChange={(e) => setAmountPounds(e.target.value)}
            placeholder="0.00"
            className="pl-5 pr-2 py-1.5 border border-gray-300 rounded text-sm w-24"
          />
        </div>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (required)"
          className="px-2 py-1.5 border border-gray-300 rounded text-sm flex-1 min-w-[200px]"
        />
        <button
          onClick={submit}
          disabled={loading}
          className="px-3 py-1.5 bg-gray-900 text-white text-sm rounded hover:bg-gray-800 disabled:opacity-50"
        >
          {loading ? 'Granting…' : 'Grant'}
        </button>
      </div>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}
