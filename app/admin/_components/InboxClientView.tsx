'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { formatDateTime } from '@/lib/format'
import SendMessageForm from './SendMessageForm'

// ─── Types ─────────────────────────────────────────────────────────────────────

export type InboxMsg = {
  id: string
  customer_id: string
  message: string
  direction: 'inbound' | 'outbound'
  created_at: string
  category?: string
  context?: string
}

export type InboxThread = {
  customerId: string
  firstName: string | null
  phone: string | null
  status: 'open' | 'closed'
  messages: InboxMsg[]
  openRequest: { id: string; message: string; status: string } | null
}

type Customer = { id: string; first_name: string | null; phone: string | null }

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

function isUnanswered(thread: InboxThread): boolean {
  const last = thread.messages[thread.messages.length - 1]
  return thread.status === 'open' && last?.direction === 'inbound'
}

// ─── Close / Reopen button ────────────────────────────────────────────────────

function CloseButton({ customerId, status, onToggle }: {
  customerId: string
  status: 'open' | 'closed'
  onToggle: (newStatus: 'open' | 'closed') => void
}) {
  const [loading, setLoading] = useState(false)

  async function handle() {
    const newStatus = status === 'open' ? 'closed' : 'open'
    setLoading(true)
    await fetch(`/api/admin/concierge/${customerId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    setLoading(false)
    onToggle(newStatus)
  }

  return (
    <button
      onClick={handle}
      disabled={loading}
      className="text-xs px-2.5 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition-colors"
    >
      {loading ? '...' : status === 'open' ? 'Mark as closed' : 'Reopen'}
    </button>
  )
}

// ─── Resolve request button ───────────────────────────────────────────────────

function ResolveRequestButton({ requestId, onResolved }: {
  requestId: string
  onResolved: () => void
}) {
  const [loading, setLoading] = useState(false)

  async function handle() {
    setLoading(true)
    await fetch('/api/admin/requests', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: requestId, status: 'resolved' }),
    })
    setLoading(false)
    onResolved()
  }

  return (
    <button
      onClick={handle}
      disabled={loading}
      className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50 transition-colors"
    >
      {loading ? '...' : 'Resolve'}
    </button>
  )
}

// ─── Request badge ────────────────────────────────────────────────────────────

function RequestBadge({ request, onResolved }: {
  request: { id: string; message: string; status: string }
  onResolved: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="mt-1">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border border-amber-400 text-amber-700 bg-amber-50 font-medium hover:bg-amber-100 transition-colors"
      >
        Request
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
          <path
            d={expanded ? 'M2 7 L5 4 L8 7' : 'M2 4 L5 7 L8 4'}
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          />
        </svg>
      </button>
      {expanded && (
        <div className="mt-1 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900 space-y-1.5">
          <p className="leading-relaxed">{request.message}</p>
          <div className="flex items-center gap-2">
            <span className="text-amber-600">{request.status.replace('_', ' ')}</span>
            {request.status !== 'resolved' && (
              <ResolveRequestButton requestId={request.id} onResolved={onResolved} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── New message modal ────────────────────────────────────────────────────────

function NewMessageModal({ customers, onClose }: {
  customers: Customer[]
  onClose: () => void
}) {
  const router = useRouter()

  function handleSuccess(customerFound: boolean) {
    if (customerFound) {
      onClose()
      router.refresh()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">New message</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <SendMessageForm customers={customers} onSuccess={handleSuccess} />
      </div>
    </div>
  )
}

// ─── Mobile reply input ───────────────────────────────────────────────────────

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
          placeholder="Reply..."
          rows={1}
          style={{ fontSize: '16px', minHeight: '44px' }}
          className="flex-1 border border-gray-300 rounded-xl px-3 py-2.5 resize-none text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-400 max-h-28 overflow-y-auto"
        />
        <button
          onClick={handleSend}
          disabled={loading || !message.trim()}
          className="text-white rounded-xl font-semibold text-sm disabled:opacity-40 transition-opacity px-4 shrink-0"
          style={{ minHeight: '44px', minWidth: '60px', background: '#9B1B30' }}
        >
          {loading ? '...' : 'Send'}
        </button>
      </div>
    </div>
  )
}

// ─── Mobile thread detail ─────────────────────────────────────────────────────

function MobileThreadDetail({
  thread,
  onBack,
  onStatusChange,
  onRequestResolved,
}: {
  thread: InboxThread
  onBack: () => void
  onStatusChange: (newStatus: 'open' | 'closed') => void
  onRequestResolved: () => void
}) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'instant' })
  }, [thread.customerId, thread.messages.length])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-100">
      <div className="flex items-center gap-1 px-2 bg-gray-900 text-white shrink-0" style={{ height: '56px' }}>
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-gray-300 hover:text-white transition-colors rounded"
          style={{ minHeight: '44px', minWidth: '56px', paddingLeft: '4px', paddingRight: '8px' }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M10 3 L5 8 L10 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-sm">Back</span>
        </button>
        <div className="flex-1 min-w-0 pl-1">
          <p className="font-semibold text-sm leading-tight truncate">{thread.firstName ?? 'Unknown'}</p>
          <p className="text-xs text-gray-400 truncate">{thread.phone ?? '---'}</p>
        </div>
        <div className="pr-2">
          <CloseButton customerId={thread.customerId} status={thread.status} onToggle={onStatusChange} />
        </div>
      </div>

      {thread.openRequest && (
        <div className="px-3 pt-3">
          <RequestBadge request={thread.openRequest} onResolved={onRequestResolved} />
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
        {thread.messages.map((msg) => {
          const isOut = msg.direction === 'outbound'
          const isPurchaseQuery = msg.category === 'purchase_query'
          const isSpecialRequest = msg.category === 'special_request'
          return (
            <div key={msg.id} className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] px-4 py-3 ${isOut ? 'rounded-2xl rounded-br-sm text-white' : 'bg-white rounded-2xl rounded-bl-sm text-gray-900 border border-gray-200'}`}
                style={isOut ? { background: '#9B1B30' } : {}}
              >
                {isPurchaseQuery && (
                  <span className="inline-block text-xs px-1.5 py-0.5 rounded border border-amber-400 text-amber-600 bg-amber-50 font-medium mb-1.5">Purchase query</span>
                )}
                {isSpecialRequest && (
                  <span className="inline-block text-xs px-1.5 py-0.5 rounded border border-amber-400 text-amber-700 bg-amber-50 font-medium mb-1.5">Request</span>
                )}
                <p className="text-sm leading-relaxed">{msg.message}</p>
                {msg.context && <p className="text-xs text-gray-400 mt-1 italic">{msg.context}</p>}
                <p className={`text-xs mt-1 ${isOut ? 'text-white/55' : 'text-gray-400'}`}>{timeAgo(msg.created_at)}</p>
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      <MobileReplyInput customerId={thread.customerId} />
    </div>
  )
}

// ─── Mobile thread list ───────────────────────────────────────────────────────

function MobileThreadList({
  threads,
  showClosed,
  onSelect,
}: {
  threads: InboxThread[]
  showClosed: boolean
  onSelect: (id: string) => void
}) {
  const visible = showClosed ? threads : threads.filter((t) => t.status === 'open')
  const hiddenCount = threads.filter((t) => t.status === 'closed').length

  if (threads.length === 0) {
    return <div className="p-8 text-center text-gray-400 text-sm">No messages yet</div>
  }

  return (
    <div className="divide-y divide-gray-200 bg-white rounded-lg border border-gray-200 overflow-hidden">
      {visible.map((thread) => {
        const lastMsg = thread.messages[thread.messages.length - 1]
        const unanswered = isUnanswered(thread)
        const closed = thread.status === 'closed'
        const hasPurchaseQuery = thread.messages.some((m) => m.category === 'purchase_query')
        return (
          <button
            key={thread.customerId}
            onClick={() => onSelect(thread.customerId)}
            className={`w-full text-left px-4 py-3.5 flex items-center gap-3 hover:bg-gray-50 active:bg-gray-100 transition-colors ${closed ? 'opacity-60' : ''}`}
            style={{ minHeight: '64px' }}
          >
            <div
              className="shrink-0 rounded-full"
              style={{
                width: '8px', height: '8px',
                background: unanswered ? '#9B1B30' : 'transparent',
                border: unanswered ? 'none' : '1.5px solid #d1d5db',
              }}
              aria-hidden="true"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2 mb-0.5">
                <p className={`text-sm truncate ${unanswered ? 'font-bold text-gray-900' : 'font-medium text-gray-800'}`}>
                  {thread.firstName ?? thread.phone ?? 'Unknown'}
                  {closed && <span className="ml-1.5 text-xs font-normal text-gray-400">(closed)</span>}
                </p>
                {lastMsg && <span className="text-xs text-gray-400 shrink-0">{timeAgo(lastMsg.created_at)}</span>}
              </div>
              {lastMsg && (
                <p className="text-xs text-gray-500 truncate leading-relaxed">
                  {lastMsg.direction === 'outbound' ? 'You: ' : ''}{lastMsg.message}
                </p>
              )}
              <div className="flex flex-wrap gap-1 mt-1">
                {hasPurchaseQuery && (
                  <span className="inline-block text-xs px-1.5 py-0.5 rounded border border-amber-400 text-amber-600 bg-amber-50 font-medium">Purchase query</span>
                )}
                {thread.openRequest && (
                  <span className="inline-block text-xs px-1.5 py-0.5 rounded border border-amber-400 text-amber-700 bg-amber-50 font-medium">Request</span>
                )}
              </div>
            </div>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0 text-gray-400" aria-hidden="true">
              <path d="M5 3 L9 7 L5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )
      })}
      {!showClosed && hiddenCount > 0 && (
        <div className="px-4 py-3 text-xs text-gray-400 text-center">
          {hiddenCount} closed thread{hiddenCount !== 1 ? 's' : ''} hidden
        </div>
      )}
    </div>
  )
}

// ─── Desktop reply form ───────────────────────────────────────────────────────

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
        placeholder="Type a reply..."
        rows={2}
        className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-400 resize-none"
      />
      <div className="flex items-center gap-3">
        <button
          onClick={handleSend}
          disabled={loading || !message.trim()}
          className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50"
          style={{ minHeight: '32px' }}
        >
          {loading ? 'Sending...' : 'Send SMS'}
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function InboxClientView({
  threads: initialThreads,
  customers,
}: {
  threads: InboxThread[]
  customers: Customer[]
}) {
  const [threads, setThreads] = useState<InboxThread[]>(initialThreads)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showClosed, setShowClosed] = useState(false)
  const [showNewMessage, setShowNewMessage] = useState(false)

  useEffect(() => {
    setThreads(initialThreads)
  }, [initialThreads])

  const selectedThread = threads.find((t) => t.customerId === selectedId) ?? null

  function handleStatusChange(customerId: string, newStatus: 'open' | 'closed') {
    setThreads((prev) =>
      prev.map((t) =>
        t.customerId === customerId
          ? { ...t, status: newStatus, openRequest: newStatus === 'closed' ? null : t.openRequest }
          : t
      )
    )
  }

  function handleRequestResolved(customerId: string) {
    setThreads((prev) =>
      prev.map((t) => t.customerId === customerId ? { ...t, openRequest: null } : t)
    )
  }

  const desktopVisible = showClosed
    ? threads
    : threads.filter((t) => t.status === 'open' || t.customerId === selectedId)

  const hiddenCount = threads.filter((t) => t.status === 'closed').length

  return (
    <>
      {showNewMessage && (
        <NewMessageModal customers={customers} onClose={() => setShowNewMessage(false)} />
      )}

      {/* MOBILE */}
      <div className="md:hidden">
        {selectedThread ? (
          <MobileThreadDetail
            thread={selectedThread}
            onBack={() => setSelectedId(null)}
            onStatusChange={(s) => handleStatusChange(selectedThread.customerId, s)}
            onRequestResolved={() => handleRequestResolved(selectedThread.customerId)}
          />
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between gap-2">
              <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showClosed}
                  onChange={(e) => setShowClosed(e.target.checked)}
                  className="rounded"
                />
                Show closed
              </label>
              <button
                onClick={() => setShowNewMessage(true)}
                className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded hover:bg-gray-700"
                style={{ minHeight: '32px' }}
              >
                + New message
              </button>
            </div>
            <MobileThreadList threads={threads} showClosed={showClosed} onSelect={setSelectedId} />
          </>
        )}
      </div>

      {/* DESKTOP */}
      <div className="hidden md:flex border border-gray-200 rounded-lg overflow-hidden bg-white" style={{ minHeight: '600px' }}>
        {/* Left panel */}
        <div className="w-80 shrink-0 border-r border-gray-200 flex flex-col">
          <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showClosed}
                onChange={(e) => setShowClosed(e.target.checked)}
                className="rounded"
              />
              Show closed
            </label>
            <button
              onClick={() => setShowNewMessage(true)}
              className="text-xs px-2.5 py-1 bg-gray-900 text-white rounded hover:bg-gray-700 transition-colors"
            >
              + New message
            </button>
          </div>

          <div className="overflow-y-auto flex-1">
            {desktopVisible.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">No open threads</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {desktopVisible.map((thread) => {
                  const lastMsg = thread.messages[thread.messages.length - 1]
                  const unanswered = isUnanswered(thread)
                  const isSelected = selectedId === thread.customerId
                  const closed = thread.status === 'closed'
                  const hasPurchaseQuery = thread.messages.some((m) => m.category === 'purchase_query')
                  return (
                    <button
                      key={thread.customerId}
                      onClick={() => setSelectedId(thread.customerId)}
                      className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors ${isSelected ? 'bg-gray-100' : ''} ${closed ? 'opacity-60' : ''}`}
                    >
                      <div
                        className="shrink-0 rounded-full mt-1.5"
                        style={{
                          width: '8px', height: '8px',
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
                          {lastMsg && <span className="text-xs text-gray-400 shrink-0">{timeAgo(lastMsg.created_at)}</span>}
                        </div>
                        {lastMsg && (
                          <p className="text-xs text-gray-500 truncate">
                            {lastMsg.direction === 'outbound' ? 'You: ' : ''}{lastMsg.message}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-1 mt-1">
                          {closed && <span className="inline-block text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">closed</span>}
                          {unanswered && <span className="inline-block text-xs px-1.5 py-0.5 rounded bg-red-50 text-red-600">needs reply</span>}
                          {hasPurchaseQuery && <span className="inline-block text-xs px-1.5 py-0.5 rounded border border-amber-400 text-amber-600 bg-amber-50 font-medium">Purchase query</span>}
                          {thread.openRequest && <span className="inline-block text-xs px-1.5 py-0.5 rounded border border-amber-400 text-amber-700 bg-amber-50 font-medium">Request</span>}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
            {!showClosed && hiddenCount > 0 && (
              <p className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100 text-center">
                {hiddenCount} closed hidden
              </p>
            )}
          </div>
        </div>

        {/* Right panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedThread ? (
            <>
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 shrink-0">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{selectedThread.firstName ?? 'Unknown'}</p>
                    <p className="text-xs text-gray-500 font-mono">{selectedThread.phone ?? '---'}</p>
                    {selectedThread.openRequest && (
                      <RequestBadge
                        request={selectedThread.openRequest}
                        onResolved={() => handleRequestResolved(selectedThread.customerId)}
                      />
                    )}
                  </div>
                  <CloseButton
                    customerId={selectedThread.customerId}
                    status={selectedThread.status}
                    onToggle={(s) => handleStatusChange(selectedThread.customerId, s)}
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {selectedThread.messages.map((msg) => {
                  const isOutbound = msg.direction === 'outbound'
                  const isPurchaseQuery = msg.category === 'purchase_query'
                  const isSpecialRequest = msg.category === 'special_request'
                  return (
                    <div key={msg.id} className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-prose rounded-lg px-3 py-2 text-sm ${isOutbound ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-800'}`}>
                        {isPurchaseQuery && (
                          <span className="inline-block text-xs px-1.5 py-0.5 rounded border border-amber-400 text-amber-600 bg-amber-50 font-medium mb-1.5">Purchase query</span>
                        )}
                        {isSpecialRequest && (
                          <span className="inline-block text-xs px-1.5 py-0.5 rounded border border-amber-400 text-amber-700 bg-amber-50 font-medium mb-1.5">Request</span>
                        )}
                        <p>{msg.message}</p>
                        {msg.context && <p className="text-xs text-gray-500 mt-1 italic">{msg.context}</p>}
                        <p className={`text-xs mt-1 ${isOutbound ? 'text-gray-400' : 'text-gray-500'}`}>
                          {formatDateTime(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="shrink-0 border-t border-gray-200 px-4 py-3">
                <DesktopReplyForm customerId={selectedThread.customerId} />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
              Select a conversation to view messages
            </div>
          )}
        </div>
      </div>
    </>
  )
}
