'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ToggleWineActive({
  wineId,
  active,
}: {
  wineId: string
  active: boolean
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function toggle() {
    setLoading(true)
    await fetch(`/api/admin/wines/${wineId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !active }),
    })
    setLoading(false)
    router.refresh()
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`text-xs px-2 py-1 rounded font-medium disabled:opacity-50 ${
        active
          ? 'bg-green-100 text-green-700 hover:bg-green-200'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      {loading ? '…' : active ? 'Active' : 'Inactive'}
    </button>
  )
}
