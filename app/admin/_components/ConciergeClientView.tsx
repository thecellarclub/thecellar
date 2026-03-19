'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { formatDateTime } from '@/lib/format'

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ConciergeMsg = {
  id: string
  customer_id: string
  message: string
  direction: 'inbound' | 'outbound'
  created_at: string
}

export type ConciergeThread = {
  customerId: string
  firstName: string | null
  phone: string | null
  messages: ConciergeMsg[]
}

// ─── Utils ─────────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function isUnanswered(thread: ConciergeThread): boolean {
  const last = thread.messages[thread.messages.length - 1]
  return last?.direction === 'inbound'
}

// ─── Mobile reply input ─────────────────────────────────────────────────────────

function MobileReplyInput({ customerId }: { customerId: string }) {
  const router = useRouter()
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  async function handleSend() {
    const trimmed = message.trim()
    if (!trimmed || loading) return
    setLoading(true)
    setError(null)
    const res = await fetch(`/api/admin/concierge/${customerId}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: trimmed }),
    })
    setLoading(false)
    if (res.ok) {
      setMessage('')
      router.refresh()
    } else {
      const data = await res.json()
      setError(data.error ?? 'Failed to send')
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="sticky bottom-0 bg-white border-t border-gray-200 px-3 py-3">
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Reply…"
          rows={1}
          /* font-size 16px prevents iOS auto-zoom on focus */
          style={{ fontSize: '16px', minHeight: '44px' }}
          className="flex-1 border border-gray-300 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-1 focus:ring-gray-400 max-h-28 overflow-y-auto"
        />
        <button
          onClick={handleSend}
          disabled={loading || !message.trim()}
          className="text-white rounded-xl font-semibold text-sm disabled:opacity-40 transition-opacity px-4 shrink-0"
          style={{ minHeight: '44px', minWidth: '60px', background: '#9B1B30' }}
        >
          {loading ? '…' : 'Send'}
        </button>
      </div>
    </div>
  )
}

// ─── Mobile thread detail (full-screen overlay) ─────────────────────────────────

function MobileThreadDetail({
  thread,
  onBack,
}: {
  thread: ConciergeThread
  onBack: () => void
}) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Scroll to latest message when thread opens
    messagesEndRef.current?.scrollIntoView({ behavior: 'instant' })
  }, [thread.customerId, thread.messages.length])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-100">
      {/* Header */}
      <div
        className="flex items-center gap-1 px-2 bg-gray-900 text-white shrink-0"
        style={{ height: '56px' }}
      >
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-gray-300 hover:text-white transition-colors rounded"
          style={{ minHeight: '44px', minWidth: '56px', paddingLeft: '4px', paddingRight: '8px' }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M10 3 L5 8 L10 13"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-sm">Back</span>
        </button>

        <div className="flex-1 min-w-0 pl-1">
          <p className="font-semibold text-sm leading-tight truncate">
            {thread.firstName ?? 'Unknown'}
          </p>
          <p className="text-xs text-gray-400 truncate">{thread.phone ?? '—'}</p>
        </div>
      </div>

      {/* Messages — scrollable flex-grow area */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
        {thread.messages.map((msg) => {
          const isOut = msg.direction === 'outbound'
          return (
            <div key={msg.id} className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] px-4 py-3 ${
                  isOut
                    ? 'rounded-2xl rounded-br-sm text-white'
                    : 'bg-white rounded-2xl rounded-bl-sm text-gray-900 border border-gray-200'
                }`}
                style={isOut ? { background: '#9B1B30' } : {}}
              >
                <p className="text-sm leading-relaxed">{msg.message}</p>
                <p className={`text-xs mt-1 ${isOut ? 'text-white/55' : 'text-gray-400'}`}>
                  {timeAgo(msg.created_at)}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply input — sticky to bottom, above keyboard */}
      <MobileReplyInput customerId={thread.customerId} />
    </div>
  )
}

// ─── Mobile thread list ─────────────────────────────────────────────────────────

function MobileThreadList({
  threads,
  onSelect,
}: {
  threads: ConciergeThread[]
  onSelect: (id: string) => void
}) {
  if (threads.length === 0) {
    return (
      <div className="p-8 text-center text-gray-400 text-sm">
        No concierge messages yet
      </div>
    )
  }

  return (
    <div className="divide-y divide-gray-200 bg-white rounded-lg border border-gray-200 overflow-hidden">
      {threads.map((thread) => {
        const lastMsg = thread.messages[thread.messages.length - 1]
        const unanswered = isUnanswered(thread)

        return (
          <button
            key={thread.customerId}
            onClick={() => onSelect(thread.customerId)}
            className="w-full text-left px-4 py-3.5 flex items-center gap-3 hover:bg-gray-50 active:bg-gray-100 transition-colors"
            style={{ minHeight: '64px' }}
          >
            {/* Unanswered dot */}
            <div
              className="shrink-0 rounded-full"
              style={{
                width: '8px',
                height: '8px',
                background: unanswered ? '#9B1B30' : 'transparent',
                border: unanswered ? 'none' : '1.5px solid #d1d5db',
              }}
              aria-hidden="true"
            />

            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2 mb-0.5">
                <p
                  className={`text-sm truncate ${
                    unanswered ? 'font-bold text-gray-900' : 'font-medium text-gray-800'
                  }`}
                >
                  {thread.firstName ?? thread.phone ?? 'Unknown'}
                </p>
                {lastMsg && (
                  <span className="text-xs text-gray-400 shrink-0">
                    {timeAgo(lastMsg.created_at)}
                  </span>
                )}
              </div>
              {lastMsg && (
                <p className="text-xs text-gray-500 truncate leading-relaxed">
                  {lastMsg.direction === 'outbound' ? 'You: ' : ''}
                  {lastMsg.message}
                </p>
              )}
            </div>

            {/* Chevron */}
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              className="shrink-0 text-gray-300"
              aria-hidden="true"
            >
              <path
                d="M5 3 L9 7 L5 11"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )
      })}
    </div>
  )
}

// ─── Desktop reply form wrapper ─────────────────────────────────────────────────

function DesktopReplyForm({ customerId }: { customerId: string }) {
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
    if (res.ok) {
      setMessage('')
      router.refresh()
    } else {
      const data = await res.json()
      setError(data.error ?? 'Failed to send message')
    }
  }

  return (
    <div className="mt-3 space-y-2">
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type a reply…"
        rows={2}
        className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 resize-none"
      />
      <div className="flex items-center gap-3">
        <button
          onClick={handleSend}
          disabled={loading || !message.trim()}
          className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50"
          style={{ minHeight: '32px' }}
        >
          {loading ? 'Sending…' : 'Send SMS'}
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </div>
  )
}

// ─── Main export ─────────────────────────────────────────────────────────────────

export default function ConciergeClientView({ threads }: { threads: ConciergeThread[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selectedThread = threads.find((t) => t.customerId === selectedId) ?? null

  return (
    <>
      {/* ── MOBILE (hidden on md+) ── */}
      <div className="md:hidden">
        {selectedThread ? (
          <MobileThreadDetail
            thread={selectedThread}
            onBack={() => setSelectedId(null)}
          />
        ) : (
          <MobileThreadList threads={threads} onSelect={setSelectedId} />
        )}
      </div>

      {/* ── DESKTOP (hidden below md) ── */}
      <div className="hidden md:flex border border-gray-200 rounded-lg overflow-hidden bg-white" style={{ minHeight: '600px' }}>
        {/* Left panel — thread list */}
        <div className="w-80 shrink-0 border-r border-gray-200 overflow-y-auto flex flex-col">
          {threads.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm flex-1 flex items-center justify-center">
              No concierge messages yet
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {threads.map((thread) => {
                const lastMsg = thread.messages[thread.messages.length - 1]
                const unanswered = isUnanswered(thread)
                const isSelected = selectedId === thread.customerId

                // Derive closed status: last message outbound and >24h ago
                const isClosed =
                  lastMsg?.direction === 'outbound' &&
                  Date.now() - new Date(lastMsg.created_at).getTime() > 24 * 60 * 60 * 1000

                return (
                  <button
                    key={thread.customerId}
                    onClick={() => setSelectedId(thread.customerId)}
                    className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors ${
                      isSelected ? 'bg-gray-100' : ''
                    }`}
                  >
                    {/* Unanswered dot */}
                    <div
                      className="shrink-0 rounded-full mt-1.5"
                      style={{
                        width: '8px',
                        height: '8px',
                        background: unanswered ? '#9B1B30' : 'transparent',
                        border: unanswered ? 'none' : '1.5px solid #d1d5db',
                      }}
                      aria-hidden="true"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2 mb-0.5">
                        <p className={`text-sm truncate ${unanswered ? 'font-bold text-gray-900' : 'font-medium text-gray-800'}`}>
                          {thread.firstName ?? thread.phone ?? 'Unknown'}
                        </p>
                        {lastMsg && (
                          <span className="text-xs text-gray-400 shrink-0">{timeAgo(lastMsg.created_at)}</span>
                        )}
                      </div>
                      {lastMsg && (
                        <p className="text-xs text-gray-500 truncate">
                          {lastMsg.direction === 'outbound' ? 'You: ' : ''}
                          {lastMsg.message}
                        </p>
                      )}
                      {isClosed && (
                        <span className="mt-1 inline-block text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                          closed
                        </span>
                      )}
                      {unanswered && (
                        <span className="mt-1 inline-block text-xs px-1.5 py-0.5 rounded bg-red-50 text-red-600">
                          needs reply
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Right panel — selected conversation */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedId && threads.find((t) => t.customerId === selectedId) ? (() => {
            const thread = threads.find((t) => t.customerId === selectedId)!
            return (
              <>
                {/* Conversation header */}
                <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 shrink-0">
                  <p className="text-sm font-medium text-gray-900">{thread.firstName ?? 'Unknown'}</p>
                  <p className="text-xs text-gray-500 font-mono">{thread.phone ?? '—'}</p>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                  {thread.messages.map((msg) => {
                    const isOutbound = msg.direction === 'outbound'
                    return (
                      <div key={msg.id} className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-prose rounded-lg px-3 py-2 text-sm ${
                            isOutbound ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          <p>{msg.message}</p>
                          <p className={`text-xs mt-1 ${isOutbound ? 'text-gray-400' : 'text-gray-500'}`}>
                            {formatDateTime(msg.created_at)}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Reply form */}
                <div className="shrink-0 border-t border-gray-200 px-4 py-3">
                  <DesktopReplyForm customerId={thread.customerId} />
                </div>
              </>
            )
          })() : (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
              Select a conversation to view messages
            </div>
          )}
        </div>
      </div>
    </>
  )
}
