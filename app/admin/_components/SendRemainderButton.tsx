'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SendRemainderButton({
  textId,
  broadcastAt,
}: {
  textId: string
  broadcastAt: string
}) {
  const router = useRouter()
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null)

  const ready = new Date(broadcastAt) <= new Date()

  async function send() {
    if (!confirm('Send this offer to everyone else now?')) return
    setSending(true)
    setError(null)
    const res = await fetch(`/api/admin/texts/${textId}/send-remainder`, { method: 'POST' })
    setSending(false)
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setError(data?.error ?? 'Send failed')
      return
    }
    const data = await res.json()
    setResult({ sent: data.sent, failed: data.failed })
    router.refresh()
  }

  if (result) {
    return (
      <p className="text-sm text-green-700">Sent to {result.sent} more subscriber{result.sent !== 1 ? 's' : ''}{result.failed > 0 ? ` (${result.failed} failed)` : ''}.</p>
    )
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <button
        onClick={send}
        disabled={sending}
        className="px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-800 disabled:opacity-50"
      >
        {sending ? 'Sending…' : 'Send to everyone else now'}
      </button>
      <span className="text-xs text-gray-500">
        {ready
          ? `Early access window has passed — ready to send.`
          : `Early access ends ${new Date(broadcastAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} — you can send earlier if you want.`}
      </span>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
