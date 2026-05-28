'use client'

import { useState } from 'react'
import SmsCharCounter from './SmsCharCounter'

interface Props {
  activeWithCard: number
  activeWithoutCard: number
  dormantWithCard: number
  dormantWithoutCard: number
  defaultMessage: string
}

export default function BroadcastForm({
  activeWithCard,
  activeWithoutCard,
  dormantWithCard,
  dormantWithoutCard,
  defaultMessage,
}: Props) {
  const [body, setBody] = useState(defaultMessage)
  const [includeActive, setIncludeActive] = useState(true)
  const [includeDormant, setIncludeDormant] = useState(false)
  const [includeWithCard, setIncludeWithCard] = useState(true)
  const [includeWithoutCard, setIncludeWithoutCard] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const withCardCount =
    (includeActive ? activeWithCard : 0) + (includeDormant ? dormantWithCard : 0)
  const withoutCardCount =
    (includeActive ? activeWithoutCard : 0) + (includeDormant ? dormantWithoutCard : 0)

  const targetCount =
    (includeWithCard ? withCardCount : 0) + (includeWithoutCard ? withoutCardCount : 0)

  async function confirmSend() {
    setSending(true)
    setError(null)

    try {
      const res = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body, includeActive, includeDormant, includeWithCard, includeWithoutCard }),
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

  const activeTotal = activeWithCard + activeWithoutCard
  const dormantTotal = dormantWithCard + dormantWithoutCard

  return (
    <div className="space-y-5">
      {/* Audience toggles */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-700 space-y-4">
        <p className="font-medium text-gray-900">Audience</p>

        {/* Status group */}
        <div className="space-y-2">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Status</p>
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeActive}
              onChange={(e) => setIncludeActive(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-400"
            />
            <span>
              Active{' '}
              <span className="text-gray-500">({activeTotal} member{activeTotal !== 1 ? 's' : ''})</span>
            </span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeDormant}
              onChange={(e) => setIncludeDormant(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-400"
            />
            <span>
              Dormant{' '}
              <span className="text-gray-500">({dormantTotal} member{dormantTotal !== 1 ? 's' : ''})</span>
            </span>
          </label>
        </div>

        {/* Card filter */}
        <div className="space-y-2 pt-2 border-t border-gray-200">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Card filter</p>
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeWithCard}
              onChange={(e) => setIncludeWithCard(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-400"
            />
            <span>
              With card{' '}
              <span className="text-gray-500">({withCardCount} member{withCardCount !== 1 ? 's' : ''})</span>
              <span className="text-gray-400 ml-1 text-xs">— plain message</span>
            </span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeWithoutCard}
              onChange={(e) => setIncludeWithoutCard(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-400"
            />
            <span>
              Without card{' '}
              <span className="text-gray-500">({withoutCardCount} member{withoutCardCount !== 1 ? 's' : ''})</span>
              <span className="text-gray-400 ml-1 text-xs">— message + add-card link appended</span>
            </span>
          </label>
        </div>

        {targetCount > 0 && (
          <p className="text-gray-500 pt-1 border-t border-gray-200">
            Sending to <strong className="text-gray-800">{targetCount}</strong> member{targetCount !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Message body */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium text-gray-700">Message</label>
          <SmsCharCounter value={body} />
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400 font-mono"
        />
        {includeWithoutCard && withoutCardCount > 0 && (
          <p className="text-xs text-gray-500 mt-1">
            For members without a card, a personalised link will be added on a new line after your message.
          </p>
        )}
      </div>

      {/* Preview */}
      <div className="bg-gray-50 rounded p-3 border border-gray-200 space-y-3">
        {includeWithCard && (
          <div>
            <p className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">Preview — with card</p>
            <p className="text-sm whitespace-pre-wrap">{body}</p>
          </div>
        )}
        {includeWithoutCard && withoutCardCount > 0 && (
          <div className={includeWithCard ? 'border-t border-gray-200 pt-3' : ''}>
            <p className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">Preview — without card</p>
            <p className="text-sm whitespace-pre-wrap">{body}{'\n\n'}Nothing charged unless you order: thecellar.club/b/aB3xYp9Q</p>
          </div>
        )}
        {!includeWithCard && !includeWithoutCard && (
          <p className="text-sm text-gray-400 italic">Select at least one audience group above.</p>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        onClick={() => setModalOpen(true)}
        disabled={!body.trim() || targetCount === 0}
        className="bg-gray-900 text-white text-sm px-6 py-2 rounded hover:bg-gray-700 disabled:opacity-40"
      >
        Send to {targetCount} member{targetCount !== 1 ? 's' : ''}
      </button>

      {/* Confirmation modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Confirm broadcast</h2>
            <p className="text-sm text-gray-600 mb-4">
              This will send to <strong>{targetCount}</strong> member{targetCount !== 1 ? 's' : ''}. This cannot be undone.
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
