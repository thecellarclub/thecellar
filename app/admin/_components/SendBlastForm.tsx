'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Wine {
  id: string
  name: string
  region: string | null
  country: string | null
  description: string | null
  price_pence: number
}

function buildTemplate(wine: Wine): string {
  const price = `£${(wine.price_pence / 100).toFixed(2)}`
  const location = [wine.region, wine.country].filter(Boolean).join(', ')
  return `${wine.name}${location ? ` – ${location}` : ''}. ${wine.description ?? ''}. ${price}/bottle. Reply with how many bottles you'd like. Reply STOP to unsubscribe.`
}

export default function SendBlastForm({
  wines,
  subscriberCount,
}: {
  wines: Wine[]
  subscriberCount: number
}) {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState(wines[0]?.id ?? '')
  const [body, setBody] = useState(() => {
    const w = wines[0]
    return w ? buildTemplate(w) : ''
  })
  const [modalOpen, setModalOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleWineChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value
    setSelectedId(id)
    const wine = wines.find((w) => w.id === id)
    if (wine) setBody(buildTemplate(wine))
  }

  const charCount = body.length
  const overLimit = charCount > 160
  const nearLimit = charCount > 155

  async function confirmSend() {
    setSending(true)
    setError(null)

    const res = await fetch('/api/texts/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wineId: selectedId, body }),
    })

    setSending(false)

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Send failed')
      setModalOpen(false)
      return
    }

    const data = await res.json()
    setModalOpen(false)
    router.push(`/admin/texts/${data.textId}`)
  }

  return (
    <div className="space-y-5">
      {/* Wine selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Wine</label>
        <select
          value={selectedId}
          onChange={handleWineChange}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
        >
          {wines.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name} — £{(w.price_pence / 100).toFixed(2)}
            </option>
          ))}
        </select>
      </div>

      {/* Message body */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium text-gray-700">Message</label>
          <span
            className={`text-xs font-mono ${
              overLimit ? 'text-red-600 font-bold' : nearLimit ? 'text-amber-600' : 'text-gray-400'
            }`}
          >
            {charCount} / 160
            {overLimit && ' — over 1 SMS segment!'}
            {nearLimit && !overLimit && ' — near limit'}
          </span>
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-400 font-mono"
        />
      </div>

      {/* Subscriber info */}
      <p className="text-sm text-gray-600">
        This will go to <span className="font-semibold">{subscriberCount}</span> active subscriber{subscriberCount !== 1 ? 's' : ''}.
      </p>

      {/* Preview */}
      <div className="bg-gray-50 rounded p-3 border border-gray-200">
        <p className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">Preview</p>
        <p className="text-sm whitespace-pre-wrap">{body}</p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Send button */}
      <button
        onClick={() => setModalOpen(true)}
        disabled={!selectedId || !body.trim() || subscriberCount === 0}
        className="bg-gray-900 text-white text-sm px-6 py-2 rounded hover:bg-gray-700 disabled:opacity-40"
      >
        Send to {subscriberCount} subscriber{subscriberCount !== 1 ? 's' : ''}
      </button>

      {/* Confirmation modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Confirm send</h2>
            <p className="text-sm text-gray-600 mb-4">
              This will send the following message to <strong>{subscriberCount}</strong> subscriber{subscriberCount !== 1 ? 's' : ''}.
              This cannot be undone.
            </p>
            <div className="bg-gray-50 rounded p-3 text-sm mb-5 whitespace-pre-wrap border border-gray-200">
              {body}
            </div>
            <div className="flex gap-3">
              <button
                onClick={confirmSend}
                disabled={sending}
                className="flex-1 bg-gray-900 text-white text-sm py-2 rounded hover:bg-gray-700 disabled:opacity-50"
              >
                {sending ? 'Sending…' : 'Yes, send now'}
              </button>
              <button
                onClick={() => setModalOpen(false)}
                disabled={sending}
                className="flex-1 border border-gray-300 text-sm py-2 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
