'use client'

import { useState } from 'react'

interface Props {
  withCard: number
  withoutCard: number
  defaultMessage: string
}

export default function BroadcastForm({ withCard, withoutCard, defaultMessage }: Props) {
  const [body, setBody] = useState(defaultMessage)
  const [modalOpen, setModalOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const total = withCard + withoutCard
  const charCount = body.length
  const overLimit = charCount > 160
  const nearLimit = charCount > 140

  async function confirmSend() {
    setSending(true)
    setError(null)

    try {
      const res = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Send failed')
        setModalOpen(false)
        return
      }

      setResult(data)
      setModalOpen(false)
    } catch {
      setError('Something went wrong. Please try again.')
      setModalOpen(false)
    } finally {
      setSending(false)
    }
  }

  if (result) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
        <p className="text-green-800 font-medium mb-1">Broadcast sent</p>
        <p className="text-green-700 text-sm">
          {result.sent} message{result.sent !== 1 ? 's' : ''} sent
          {result.failed > 0 && `, ${result.failed} failed`}.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Audience summary */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-700 space-y-1">
        <p className="font-medium text-gray-900">Audience: {total} active member{total !== 1 ? 's' : ''}</p>
        <p className="text-gray-500">
          {withCard} already have a card on file — they&apos;ll get the plain message.
        </p>
        {withoutCard > 0 && (
          <p className="text-gray-500">
            {withoutCard} don&apos;t have a card yet — they&apos;ll get the message with a personalised add-card link appended.
          </p>
        )}
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
            {charCount} chars
            {overLimit && ' — will send as 2 SMS segments'}
            {nearLimit && !overLimit && ' — near 1 segment limit'}
          </span>
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400 font-mono"
        />
        {withoutCard > 0 && (
          <p className="text-xs text-gray-500 mt-1">
            For members without a card, a personalised link will be added on a new line after your message.
          </p>
        )}
      </div>

      {/* Preview */}
      <div className="bg-gray-50 rounded p-3 border border-gray-200 space-y-3">
        <div>
          <p className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">Preview — with card</p>
          <p className="text-sm whitespace-pre-wrap">{body}</p>
        </div>
        {withoutCard > 0 && (
          <div className="border-t border-gray-200 pt-3">
            <p className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">Preview — without card</p>
            <p className="text-sm whitespace-pre-wrap">{body}{'\n\n'}Add your card here so you&apos;re ready to order: thecellar.club/b/aB3xYp9Q</p>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        onClick={() => setModalOpen(true)}
        disabled={!body.trim() || total === 0}
        className="bg-gray-900 text-white text-sm px-6 py-2 rounded hover:bg-gray-700 disabled:opacity-40"
      >
        Send to {total} member{total !== 1 ? 's' : ''}
      </button>

      {/* Confirmation modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Confirm broadcast</h2>
            <p className="text-sm text-gray-600 mb-4">
              This will send to <strong>{total}</strong> member{total !== 1 ? 's' : ''}. This cannot be undone.
            </p>
            <div className="bg-gray-50 rounded p-3 text-sm mb-5 whitespace-pre-wrap border border-gray-200 max-h-40 overflow-y-auto">
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
