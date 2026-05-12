'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CollectionActions({ shipmentId }: { shipmentId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState<'complete' | 'cancel' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function call(action: 'complete-collection' | 'cancel-collection') {
    const key = action === 'complete-collection' ? 'complete' : 'cancel'
    setLoading(key)
    setError(null)
    try {
      const res = await fetch(`/api/admin/shipments/${shipmentId}/${action}`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed')
      } else {
        router.refresh()
      }
    } catch {
      setError('Unexpected error')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={() => call('complete-collection')}
        disabled={loading !== null}
        className="text-sm px-3 py-1.5 rounded bg-green-100 text-green-700 hover:bg-green-200 font-medium disabled:opacity-50"
      >
        {loading === 'complete' ? '…' : 'Mark as collected'}
      </button>
      <button
        onClick={() => call('cancel-collection')}
        disabled={loading !== null}
        className="text-sm px-3 py-1.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
      >
        {loading === 'cancel' ? '…' : 'Cancel'}
      </button>
      {error && <p className="text-xs text-red-600 w-full">{error}</p>}
    </div>
  )
}
