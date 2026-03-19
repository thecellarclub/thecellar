'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Wine {
  id: string
  name: string
}

interface Props {
  customerId: string
  wines: Wine[]
}

export default function AddBottlesForm({ customerId, wines }: Props) {
  const router = useRouter()
  const [wineId, setWineId] = useState(wines[0]?.id ?? '')
  const [quantity, setQuantity] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!wineId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/customers/${customerId}/add-bottles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wineId, quantity }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to add bottles')
        setLoading(false)
        return
      }
      // Reset form and refresh
      setWineId(wines[0]?.id ?? '')
      setQuantity(1)
      router.refresh()
    } catch {
      setError('Unexpected error')
    } finally {
      setLoading(false)
    }
  }

  if (wines.length === 0) {
    return <p className="text-sm text-gray-400 px-4 py-3">No active wines available to add.</p>
  }

  return (
    <form onSubmit={handleSubmit} className="px-4 py-3 flex items-end gap-3 flex-wrap">
      <div>
        <label className="block text-xs text-gray-500 mb-1">Wine</label>
        <select
          value={wineId}
          onChange={(e) => setWineId(e.target.value)}
          disabled={loading}
          className="text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white disabled:opacity-50"
        >
          {wines.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Quantity</label>
        <input
          type="number"
          min={1}
          value={quantity}
          onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
          disabled={loading}
          className="w-20 text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:opacity-50"
        />
      </div>
      <button
        type="submit"
        disabled={loading || !wineId}
        className="text-sm px-3 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-700 font-medium disabled:opacity-50"
      >
        {loading ? '…' : 'Add to cellar'}
      </button>
      {error && <p className="text-xs text-red-600 w-full mt-0.5">{error}</p>}
    </form>
  )
}
