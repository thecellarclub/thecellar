'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ConciergeReplyForm({ customerId }: { customerId: string }) {
  const router = useRouter()
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSend() {
    const trimmed = message.trim()
    if (!trimmed) return

    setLoading(true)
    setError(null)

    const res = await fetch(`/api/admin/concierge/${customerId}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: trimmed }),
    })

    setLoading(false)

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Failed to send message')
    } else {
      setMessage('')
      router.refresh()
    }
  }

  return (
    <div className="mt-3 space-y-2">
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type a reply…"
        rows={2}
        className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-400 resize-none"
      />
      <div className="flex items-center gap-3">
        <button
          onClick={handleSend}
          disabled={loading || !message.trim()}
          className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50"
        >
          {loading ? 'Sending…' : 'Send SMS'}
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </div>
  )
}
