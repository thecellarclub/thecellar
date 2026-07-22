'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function MilestoneRowActions({
  id,
  currentChoice,
  options,
  rewardLabels,
}: {
  id: string
  currentChoice: string | null
  options: string[]
  rewardLabels: Record<string, string>
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function patch(body: { rewardChoice?: string; fulfilled?: boolean }) {
    setLoading(true)
    setError(null)
    const res = await fetch(`/api/admin/milestones/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setLoading(false)
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setError(data?.error ?? 'Failed')
      return
    }
    router.refresh()
  }

  // Milestones 1 and 7 are auto/self-fulfilling — just need the "mark fulfilled"
  // button once Daniel's actually arranged the Coravin (milestone 7). Milestone
  // 1 fulfils itself in post-charge and shouldn't normally land here.
  const needsChoice = options.length > 0 && !currentChoice

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {needsChoice ? (
        options.map((opt) => (
          <button
            key={opt}
            onClick={() => patch({ rewardChoice: opt })}
            disabled={loading}
            className="px-2.5 py-1.5 border border-gray-300 rounded text-xs hover:bg-gray-50 disabled:opacity-50"
          >
            {rewardLabels[opt] ?? opt}
          </button>
        ))
      ) : (
        <button
          onClick={() => patch({ fulfilled: true })}
          disabled={loading}
          className="px-3 py-1.5 bg-gray-900 text-white text-xs rounded hover:bg-gray-800 disabled:opacity-50"
        >
          {loading ? 'Saving…' : 'Mark fulfilled'}
        </button>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
