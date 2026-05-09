'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatDateTime } from '@/lib/format'
import SendMessageForm from './SendMessageForm'
import SmsCharCounter from './SmsCharCounter'

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

export type SmsContextMsg = {
  id: string
  direction: 'inbound' | 'outbound'
  body: string
  created_at: string
}

export type InboxNote = {
  id: string
  customer_id: string
  author_id: string
  author_name: string
  body: string
  created_at: string
}

export type ActivityEntry = {
  id: string
  customer_id: string
  actor_id: string
  actor_name: string
  action: string
  detail: string | null
  created_at: string
}

export type AdminUser = {
  id: string
  name: string
  email: string
}

export type InboxThread = {
  customerId: string
  firstName: string | null
  phone: string | null
  status: 'open' | 'closed'
  assignedTo: string | null
  assignedAt: string | null
  followUpDate: string | null
  followUpNote: string | null
  messages: InboxMsg[]
  openRequest: { id: string; message: string; status: string } | null
  smsContext: SmsContextMsg[]
  notes: InboxNote[]
  activity: ActivityEntry[]
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

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function formatFollowUpDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

// Deterministic colour per user id — 4 soft palette
const USER_COLOURS = ['#a78bfa', '#34d399', '#fb923c', '#60a5fa']
function userColour(userId: string): string {
  let hash = 0
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0
  return USER_COLOURS[hash % USER_COLOURS.length]
}

function nextMonday(): string {
  const d = new Date()
  const day = d.getDay() // 0=Sun
  const daysUntilMonday = day === 0 ? 1 : 8 - day
  d.setDate(d.getDate() + daysUntilMonday)
  return d.toISOString().slice(0, 10)
}

function addDays(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

// ─── SMS context strip ────────────────────────────────────────────────────────

function SmsContextStrip({ msgs }: { msgs: SmsContextMsg[] }) {
  if (msgs.length === 0) return null
  return (
    <div className="space-y-2 mb-4">
      <p className="text-xs text-gray-600 text-center">— SMS before this thread —</p>
      {msgs.map((sms) => (
        <div key={sms.id} className={`flex ${sms.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-[80%] px-3 py-1.5 rounded-lg text-xs opacity-50 ${sms.direction === 'outbound' ? 'bg-gray-200 text-gray-700' : 'bg-gray-100 text-gray-600'}`}>
            <p className="leading-relaxed">{sms.body}</p>
            <p className="text-gray-600 mt-0.5">{formatDateTime(sms.created_at)}</p>
          </div>
        </div>
      ))}
      <div className="border-t border-dashed border-gray-200" />
    </div>
  )
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

// ─── Assignment controls ──────────────────────────────────────────────────────

function AssignmentControls({ thread, adminUsers, currentUserId, onAssign }: {
  thread: InboxThread
  adminUsers: AdminUser[]
  currentUserId: string
  onAssign: (assignedTo: string | null) => void
}) {
  const [picking, setPicking] = useState(false)
  const [loading, setLoading] = useState<string | null>(null) // holds userId being set

  const assignedUser = adminUsers.find((u) => u.id === thread.assignedTo)

  async function assign(userId: string | null) {
    setLoading(userId ?? 'unassign')
    setPicking(false)
    const res = await fetch(`/api/admin/inbox/${thread.customerId}/assign`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignedTo: userId }),
    })
    setLoading(null)
    if (res.ok) onAssign(userId)
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {assignedUser ? (
            <span className="text-xs text-gray-700 font-medium truncate">
              Assigned: <span style={{ color: userColour(assignedUser.id) }}>{assignedUser.name}</span>
            </span>
          ) : (
            <span className="text-xs text-gray-400">Unassigned</span>
          )}
        </div>
        <button
          onClick={() => setPicking((v) => !v)}
          disabled={loading !== null}
          className="text-xs px-2 py-0.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition-colors shrink-0"
        >
          {loading !== null ? '…' : assignedUser ? 'Change' : 'Assign'}
        </button>
      </div>
      {picking && (
        <div className="flex flex-wrap gap-1.5 pl-1">
          {adminUsers.map((u) => (
            <button
              key={u.id}
              onClick={() => assign(u.id)}
              disabled={loading !== null}
              className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition-colors disabled:opacity-50 ${
                u.id === thread.assignedTo
                  ? 'border-transparent font-semibold'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-100'
              }`}
              style={u.id === thread.assignedTo ? {
                background: userColour(u.id) + '22',
                borderColor: userColour(u.id),
                color: userColour(u.id),
              } : {}}
            >
              <span
                className="inline-flex items-center justify-center rounded-full text-white text-[9px] font-bold shrink-0"
                style={{ width: 14, height: 14, background: userColour(u.id) }}
              >
                {u.name[0]}
              </span>
              {u.name}
            </button>
          ))}
          {assignedUser && (
            <button
              onClick={() => assign(null)}
              disabled={loading !== null}
              className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-400 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Unassign
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Follow-up controls ───────────────────────────────────────────────────────

function FollowUpControls({ thread, onUpdate }: {
  thread: InboxThread
  onUpdate: (date: string | null, note: string | null) => void
}) {
  const [editing, setEditing] = useState(false)
  const [date, setDate] = useState(thread.followUpDate ?? '')
  const [note, setNote] = useState(thread.followUpNote ?? '')
  const [loading, setLoading] = useState(false)

  const today = todayISO()
  const isOverdue = thread.followUpDate && thread.followUpDate < today
  const isSoon = thread.followUpDate && !isOverdue && thread.followUpDate <= addDays(2)

  async function save() {
    if (!date) return
    setLoading(true)
    const res = await fetch(`/api/admin/inbox/${thread.customerId}/follow-up`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, note: note || null }),
    })
    setLoading(false)
    if (res.ok) {
      onUpdate(date, note || null)
      setEditing(false)
    }
  }

  async function clear() {
    setLoading(true)
    const res = await fetch(`/api/admin/inbox/${thread.customerId}/follow-up`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: null, note: null }),
    })
    setLoading(false)
    if (res.ok) {
      onUpdate(null, null)
      setDate('')
      setNote('')
      setEditing(false)
    }
  }

  const pillStyle = isOverdue
    ? 'bg-red-50 border-red-300 text-red-700'
    : isSoon
      ? 'bg-amber-50 border-amber-300 text-amber-700'
      : 'bg-gray-50 border-gray-300 text-gray-600'

  return (
    <div>
      <div className="flex items-start gap-2">
        <span className="text-xs text-gray-500 w-16 shrink-0 pt-0.5">Follow-up</span>
        <div className="flex-1 min-w-0">
          {thread.followUpDate && !editing ? (
            <div>
              <button
                onClick={() => { setDate(thread.followUpDate!); setNote(thread.followUpNote ?? ''); setEditing(true) }}
                className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${pillStyle}`}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                  <rect x="1" y="1.5" width="8" height="7.5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M3.5 1v1M6.5 1v1M1 4h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                {formatFollowUpDate(thread.followUpDate)}
              </button>
              {thread.followUpNote && (
                <p className="text-xs text-gray-500 mt-0.5 truncate">{thread.followUpNote}</p>
              )}
            </div>
          ) : !editing ? (
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Set follow-up…
            </button>
          ) : null}

          {editing && (
            <div className="space-y-2 mt-1">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min={today}
                className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-400"
              />
              <div className="flex flex-wrap gap-1">
                {[
                  { label: 'Tomorrow', value: addDays(1) },
                  { label: 'Next week', value: nextMonday() },
                  { label: 'In 2 weeks', value: addDays(14) },
                  { label: 'Later', value: addDays(30) },
                ].map(({ label, value }) => (
                  <button
                    key={label}
                    onClick={() => setDate(value)}
                    className="text-xs px-1.5 py-0.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    {label}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note (optional)"
                className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-400"
              />
              <div className="flex gap-2">
                <button
                  onClick={save}
                  disabled={loading || !date}
                  className="text-xs px-2.5 py-1 bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? '...' : 'Save'}
                </button>
                {thread.followUpDate && (
                  <button
                    onClick={clear}
                    disabled={loading}
                    className="text-xs px-2.5 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition-colors"
                  >
                    Clear
                  </button>
                )}
                <button
                  onClick={() => setEditing(false)}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Notes section ────────────────────────────────────────────────────────────

function NotesSection({ thread, currentUserName, onNoteAdded }: {
  thread: InboxThread
  currentUserName: string
  onNoteAdded: (note: InboxNote) => void
}) {
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const notesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    notesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [thread.notes.length])

  async function addNote() {
    const trimmed = body.trim()
    if (!trimmed) return
    setLoading(true)
    setError(null)
    const res = await fetch(`/api/admin/inbox/${thread.customerId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: trimmed }),
    })
    setLoading(false)
    if (res.ok) {
      const note = await res.json()
      onNoteAdded(note)
      setBody('')
    } else {
      const data = await res.json()
      setError(data.error ?? 'Failed to add note')
    }
  }

  return (
    <div>
      <p className="text-xs font-medium text-gray-600 mb-2">Notes</p>
      {thread.notes.length > 0 && (
        <div className="space-y-2 mb-2 max-h-48 overflow-y-auto pr-1">
          {thread.notes.map((note) => (
            <div key={note.id} className="text-xs">
              <p className="text-gray-500">
                <span className="font-medium text-gray-700">{note.author_name}</span>
                {' · '}{timeAgo(note.created_at)}
              </p>
              <p className="text-gray-800 leading-relaxed mt-0.5 whitespace-pre-wrap">{note.body}</p>
            </div>
          ))}
          <div ref={notesEndRef} />
        </div>
      )}
      {thread.notes.length === 0 && (
        <p className="text-xs text-gray-400 mb-2">No notes yet</p>
      )}
      <div className="space-y-1.5">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a note…"
          rows={2}
          className="w-full border border-amber-300 rounded px-2.5 py-2 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-amber-400 resize-none bg-amber-50/30"
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button
          onClick={addNote}
          disabled={loading || !body.trim()}
          className="text-xs px-2.5 py-1 rounded border border-amber-400 bg-amber-50 text-amber-800 hover:bg-amber-100 disabled:opacity-50 transition-colors"
        >
          {loading ? '...' : `Add note`}
        </button>
      </div>
    </div>
  )
}

// ─── Activity feed ────────────────────────────────────────────────────────────

function ActivityFeed({ activity }: { activity: ActivityEntry[] }) {
  const [expanded, setExpanded] = useState(false)

  function describeAction(entry: ActivityEntry): string {
    switch (entry.action) {
      case 'replied': return `replied: "${entry.detail ?? ''}"`
      case 'assigned': return `assigned to ${entry.detail ?? 'unknown'}`
      case 'note_added': return `added note: "${entry.detail ?? ''}"`
      case 'follow_up_set': return `set follow-up: ${entry.detail ?? ''}`
      case 'follow_up_cleared': return `cleared follow-up`
      case 'closed': return `marked closed`
      case 'reopened': return `reopened`
      case 'request_resolved': return `resolved request`
      default: return entry.action
    }
  }

  return (
    <div>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
          <path
            d={expanded ? 'M2 7 L5 4 L8 7' : 'M2 4 L5 7 L8 4'}
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          />
        </svg>
        Activity {activity.length > 0 ? `(${activity.length})` : ''}
      </button>
      {expanded && (
        <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto">
          {activity.length === 0 ? (
            <p className="text-xs text-gray-400">No activity yet</p>
          ) : (
            [...activity].reverse().map((entry) => (
              <p key={entry.id} className="text-xs text-gray-500 leading-relaxed">
                <span className="font-medium text-gray-600">{entry.actor_name}</span>
                {' '}{describeAction(entry)}{' · '}{timeAgo(entry.created_at)}
              </p>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ─── Customer panel ───────────────────────────────────────────────────────────

function CustomerPanel({ thread, adminUsers, currentUserId, currentUserName, onAssign, onFollowUpUpdate, onNoteAdded }: {
  thread: InboxThread
  adminUsers: AdminUser[]
  currentUserId: string
  currentUserName: string
  onAssign: (assignedTo: string | null) => void
  onFollowUpUpdate: (date: string | null, note: string | null) => void
  onNoteAdded: (note: InboxNote) => void
}) {
  return (
    <div className="flex flex-col gap-4 p-4">
      <AssignmentControls
        thread={thread}
        adminUsers={adminUsers}
        currentUserId={currentUserId}
        onAssign={onAssign}
      />
      <div className="border-t border-gray-100 pt-3">
        <FollowUpControls
          thread={thread}
          onUpdate={onFollowUpUpdate}
        />
      </div>
      <div className="border-t border-gray-100 pt-3">
        <NotesSection
          thread={thread}
          currentUserName={currentUserName}
          onNoteAdded={onNoteAdded}
        />
      </div>
      <div className="border-t border-gray-100 pt-3">
        <ActivityFeed activity={thread.activity} />
      </div>
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
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">New message</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-600 text-xl leading-none" aria-label="Close">×</button>
        </div>
        <SendMessageForm customers={customers} onSuccess={handleSuccess} />
      </div>
    </div>
  )
}

// ─── Reply input (shared) ─────────────────────────────────────────────────────

function ReplyInput({ customerId, onSent, mobile }: { customerId: string; onSent: () => void; mobile?: boolean }) {
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
      onSent()
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

  if (mobile) {
    return (
      <div className="sticky bottom-0 bg-white border-t border-gray-200 px-3 py-3">
        {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
        <SmsCharCounter value={message} className="text-xs mb-1.5" />
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

  return (
    <div className="space-y-2">
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a reply..."
        rows={2}
        className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-400 resize-none"
      />
      <SmsCharCounter value={message} className="text-xs" />
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

// ─── Message timeline ─────────────────────────────────────────────────────────

function MessageTimeline({ thread }: { thread: InboxThread }) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'instant' })
  }, [thread.customerId, thread.messages.length])

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
      <SmsContextStrip msgs={thread.smsContext} />
      {thread.messages.map((msg) => {
        const isOut = msg.direction === 'outbound'
        const isPurchaseQuery = msg.category === 'purchase_query'
        const isSpecialRequest = msg.category === 'special_request'
        return (
          <div key={msg.id} className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] px-4 py-3 text-sm ${isOut ? 'rounded-2xl rounded-br-sm text-white' : 'bg-white rounded-2xl rounded-bl-sm text-gray-900 border border-gray-200'}`}
              style={isOut ? { background: '#9B1B30' } : {}}
            >
              {isPurchaseQuery && <span className="inline-block text-xs px-1.5 py-0.5 rounded border border-amber-400 text-amber-600 bg-amber-50 font-medium mb-1.5">Purchase query</span>}
              {isSpecialRequest && <span className="inline-block text-xs px-1.5 py-0.5 rounded border border-amber-400 text-amber-700 bg-amber-50 font-medium mb-1.5">Request</span>}
              <p className="leading-relaxed">{msg.message}</p>
              {msg.context && <p className="text-xs text-gray-500 mt-1 italic">{msg.context}</p>}
              <p className={`text-xs mt-1 ${isOut ? 'text-white/55' : 'text-gray-500'}`}>{timeAgo(msg.created_at)}</p>
            </div>
          </div>
        )
      })}
      <div ref={messagesEndRef} />
    </div>
  )
}

// ─── Mobile collapsible customer panel ───────────────────────────────────────

function MobileCustomerPanel({ thread, adminUsers, currentUserId, currentUserName, onAssign, onFollowUpUpdate, onNoteAdded }: {
  thread: InboxThread
  adminUsers: AdminUser[]
  currentUserId: string
  currentUserName: string
  onAssign: (assignedTo: string | null) => void
  onFollowUpUpdate: (date: string | null, note: string | null) => void
  onNoteAdded: (note: InboxNote) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border-b border-gray-200 bg-gray-50">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left"
      >
        <span className="text-sm font-medium text-gray-700">Customer info</span>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-gray-500" aria-hidden="true">
          <path
            d={expanded ? 'M3 9 L7 5 L11 9' : 'M3 5 L7 9 L11 5'}
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          />
        </svg>
      </button>
      {expanded && (
        <div className="overflow-y-auto max-h-72">
          <CustomerPanel
            thread={thread}
            adminUsers={adminUsers}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
            onAssign={onAssign}
            onFollowUpUpdate={onFollowUpUpdate}
            onNoteAdded={onNoteAdded}
          />
        </div>
      )}
    </div>
  )
}

// ─── Mobile thread detail ─────────────────────────────────────────────────────

function MobileThreadDetail({
  thread,
  adminUsers,
  currentUserId,
  currentUserName,
  onBack,
  onStatusChange,
  onRequestResolved,
  onAssign,
  onFollowUpUpdate,
  onNoteAdded,
}: {
  thread: InboxThread
  adminUsers: AdminUser[]
  currentUserId: string
  currentUserName: string
  onBack: () => void
  onStatusChange: (newStatus: 'open' | 'closed') => void
  onRequestResolved: () => void
  onAssign: (assignedTo: string | null) => void
  onFollowUpUpdate: (date: string | null, note: string | null) => void
  onNoteAdded: (note: InboxNote) => void
}) {
  const router = useRouter()

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
          <Link href={`/admin/customers/${thread.customerId}`} className="font-semibold text-sm leading-tight truncate hover:underline block">{thread.firstName ?? 'Unknown'}</Link>
          <p className="text-xs text-gray-500 truncate">{thread.phone ?? '---'}</p>
        </div>
        <div className="pr-2">
          <CloseButton customerId={thread.customerId} status={thread.status} onToggle={onStatusChange} />
        </div>
      </div>

      {thread.openRequest && (
        <div className="px-3 pt-2 bg-white border-b border-gray-200">
          <RequestBadge request={thread.openRequest} onResolved={onRequestResolved} />
        </div>
      )}

      <MobileCustomerPanel
        thread={thread}
        adminUsers={adminUsers}
        currentUserId={currentUserId}
        currentUserName={currentUserName}
        onAssign={onAssign}
        onFollowUpUpdate={onFollowUpUpdate}
        onNoteAdded={onNoteAdded}
      />

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        <SmsContextStrip msgs={thread.smsContext} />
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
                {isPurchaseQuery && <span className="inline-block text-xs px-1.5 py-0.5 rounded border border-amber-400 text-amber-600 bg-amber-50 font-medium mb-1.5">Purchase query</span>}
                {isSpecialRequest && <span className="inline-block text-xs px-1.5 py-0.5 rounded border border-amber-400 text-amber-700 bg-amber-50 font-medium mb-1.5">Request</span>}
                <p className="text-sm leading-relaxed">{msg.message}</p>
                {msg.context && <p className="text-xs text-gray-500 mt-1 italic">{msg.context}</p>}
                <p className={`text-xs mt-1 ${isOut ? 'text-white/55' : 'text-gray-500'}`}>{timeAgo(msg.created_at)}</p>
              </div>
            </div>
          )
        })}
      </div>

      <ReplyInput customerId={thread.customerId} onSent={() => router.refresh()} mobile />
    </div>
  )
}

// ─── Thread list row ──────────────────────────────────────────────────────────

function ThreadRow({ thread, isSelected, adminUsers, onClick, mobile }: {
  thread: InboxThread
  isSelected?: boolean
  adminUsers: AdminUser[]
  onClick: () => void
  mobile?: boolean
}) {
  const lastMsg = thread.messages[thread.messages.length - 1]
  const unanswered = isUnanswered(thread)
  const closed = thread.status === 'closed'
  const hasPurchaseQuery = thread.messages.some((m) => m.category === 'purchase_query')
  const today = todayISO()
  const followUpOverdue = thread.followUpDate && thread.followUpDate <= today
  const followUpSoon = thread.followUpDate && !followUpOverdue && thread.followUpDate <= addDays(3)
  const assignee = adminUsers.find((u) => u.id === thread.assignedTo)

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors ${isSelected ? 'bg-gray-100' : ''} ${closed ? 'opacity-60' : ''} ${mobile ? 'active:bg-gray-100' : ''}`}
      style={mobile ? { minHeight: '64px' } : {}}
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
            {closed && !mobile && <span className="ml-1.5 text-xs font-normal text-gray-500">(closed)</span>}
          </p>
          <div className="flex items-center gap-1.5 shrink-0">
            {thread.followUpDate && (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true"
                className={followUpOverdue ? 'text-red-500' : followUpSoon ? 'text-amber-500' : 'text-gray-400'}>
                <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M5 3v2l1.5 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
            )}
            {assignee && (
              <span
                className="inline-flex items-center justify-center rounded-full text-white text-[9px] font-bold"
                style={{ width: 14, height: 14, background: userColour(assignee.id) }}
                title={assignee.name}
              >
                {assignee.name[0]}
              </span>
            )}
            {lastMsg && <span className="text-xs text-gray-500">{timeAgo(lastMsg.created_at)}</span>}
          </div>
        </div>
        {lastMsg && (
          <p className="text-xs text-gray-500 truncate leading-relaxed">
            {lastMsg.direction === 'outbound' ? 'You: ' : ''}{lastMsg.message}
          </p>
        )}
        <div className="flex flex-wrap gap-1 mt-1">
          {closed && mobile && <span className="inline-block text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">closed</span>}
          {!mobile && unanswered && <span className="inline-block text-xs px-1.5 py-0.5 rounded bg-red-50 text-red-600">needs reply</span>}
          {hasPurchaseQuery && <span className="inline-block text-xs px-1.5 py-0.5 rounded border border-amber-400 text-amber-600 bg-amber-50 font-medium">Purchase query</span>}
          {thread.openRequest && <span className="inline-block text-xs px-1.5 py-0.5 rounded border border-amber-400 text-amber-700 bg-amber-50 font-medium">Request</span>}
        </div>
      </div>
      {mobile && (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0 text-gray-500 mt-1" aria-hidden="true">
          <path d="M5 3 L9 7 L5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

type AssigneeFilter = 'all' | 'mine' | 'unassigned' | string
type View = 'active' | 'scheduled'

export default function InboxClientView({
  threads: initialThreads,
  customers,
  adminUsers,
  currentUser,
}: {
  threads: InboxThread[]
  customers: Customer[]
  adminUsers: AdminUser[]
  currentUser: { id: string; name: string; email: string }
}) {
  const router = useRouter()
  const [threads, setThreads] = useState<InboxThread[]>(initialThreads)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showClosed, setShowClosed] = useState(false)
  const [showNewMessage, setShowNewMessage] = useState(false)
  const [assigneeFilter, setAssigneeFilter] = useState<AssigneeFilter>('all')
  const [view, setView] = useState<View>('active')

  useEffect(() => {
    setThreads(initialThreads)
  }, [initialThreads])

  const selectedThread = threads.find((t) => t.customerId === selectedId) ?? null

  function updateThread(customerId: string, patch: Partial<InboxThread>) {
    setThreads((prev) => prev.map((t) => t.customerId === customerId ? { ...t, ...patch } : t))
  }

  function handleStatusChange(customerId: string, newStatus: 'open' | 'closed') {
    updateThread(customerId, {
      status: newStatus,
      openRequest: newStatus === 'closed' ? null : threads.find((t) => t.customerId === customerId)?.openRequest ?? null,
    })
  }

  function handleRequestResolved(customerId: string) {
    updateThread(customerId, { openRequest: null })
  }

  function handleAssign(customerId: string, assignedTo: string | null) {
    updateThread(customerId, { assignedTo, assignedAt: assignedTo ? new Date().toISOString() : null })
  }

  function handleFollowUpUpdate(customerId: string, date: string | null, note: string | null) {
    updateThread(customerId, { followUpDate: date, followUpNote: note })
  }

  function handleNoteAdded(customerId: string, note: InboxNote) {
    setThreads((prev) => prev.map((t) =>
      t.customerId === customerId ? { ...t, notes: [...t.notes, note] } : t
    ))
  }

  const today = todayISO()

  // Apply view + filters
  const visibleThreads = threads.filter((t) => {
    // View filter
    if (view === 'scheduled') {
      return !!t.followUpDate
    }
    // Active view: hide far-future-followup closed threads
    const isFarFuture = t.followUpDate && t.followUpDate > addDays(3) && t.status === 'closed'
    if (isFarFuture) return false
    if (!showClosed && t.status === 'closed' && t.customerId !== selectedId) return false
    return true
  }).filter((t) => {
    // Assignee filter
    if (assigneeFilter === 'all') return true
    if (assigneeFilter === 'mine') return t.assignedTo === currentUser.id
    if (assigneeFilter === 'unassigned') return !t.assignedTo
    return t.assignedTo === assigneeFilter
  })

  // Sort scheduled view by follow-up date asc
  const sortedVisible = view === 'scheduled'
    ? [...visibleThreads].sort((a, b) => (a.followUpDate ?? '').localeCompare(b.followUpDate ?? ''))
    : visibleThreads

  const hiddenClosedCount = threads.filter((t) => t.status === 'closed').length

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
            adminUsers={adminUsers}
            currentUserId={currentUser.id}
            currentUserName={currentUser.name}
            onBack={() => setSelectedId(null)}
            onStatusChange={(s) => handleStatusChange(selectedThread.customerId, s)}
            onRequestResolved={() => handleRequestResolved(selectedThread.customerId)}
            onAssign={(id) => handleAssign(selectedThread.customerId, id)}
            onFollowUpUpdate={(d, n) => handleFollowUpUpdate(selectedThread.customerId, d, n)}
            onNoteAdded={(note) => handleNoteAdded(selectedThread.customerId, note)}
          />
        ) : (
          <>
            <div className="mb-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
                    <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} className="rounded" />
                    Show closed
                  </label>
                </div>
                <button
                  onClick={() => setShowNewMessage(true)}
                  className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded hover:bg-gray-700"
                  style={{ minHeight: '32px' }}
                >
                  + New message
                </button>
              </div>
              <FilterBar
                adminUsers={adminUsers}
                currentUserId={currentUser.id}
                assigneeFilter={assigneeFilter}
                setAssigneeFilter={setAssigneeFilter}
                view={view}
                setView={setView}
              />
            </div>
            <div className="divide-y divide-gray-200 bg-white rounded-lg border border-gray-200 overflow-hidden">
              {sortedVisible.length === 0 ? (
                <div className="p-8 text-center text-gray-500 text-sm">No messages</div>
              ) : sortedVisible.map((t) => (
                <ThreadRow key={t.customerId} thread={t} adminUsers={adminUsers} onClick={() => setSelectedId(t.customerId)} mobile />
              ))}
              {!showClosed && hiddenClosedCount > 0 && (
                <div className="px-4 py-3 text-xs text-gray-500 text-center">
                  {hiddenClosedCount} closed thread{hiddenClosedCount !== 1 ? 's' : ''} hidden
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* DESKTOP: 3-column */}
      <div className="hidden md:flex border border-gray-200 rounded-lg overflow-hidden bg-white" style={{ minHeight: '600px' }}>
        {/* Left column: thread list */}
        <div className="w-72 lg:w-80 shrink-0 border-r border-gray-200 flex flex-col">
          <div className="px-3 py-2.5 border-b border-gray-100 space-y-2">
            <div className="flex items-center justify-between gap-2">
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
                + New
              </button>
            </div>
            <FilterBar
              adminUsers={adminUsers}
              currentUserId={currentUser.id}
              assigneeFilter={assigneeFilter}
              setAssigneeFilter={setAssigneeFilter}
              view={view}
              setView={setView}
            />
          </div>

          <div className="overflow-y-auto flex-1">
            {sortedVisible.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">No threads</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {sortedVisible.map((t) => (
                  <ThreadRow
                    key={t.customerId}
                    thread={t}
                    isSelected={selectedId === t.customerId}
                    adminUsers={adminUsers}
                    onClick={() => setSelectedId(t.customerId)}
                  />
                ))}
              </div>
            )}
            {!showClosed && hiddenClosedCount > 0 && (
              <p className="px-4 py-2 text-xs text-gray-500 border-t border-gray-100 text-center">
                {hiddenClosedCount} closed hidden
              </p>
            )}
          </div>
        </div>

        {/* Middle column: conversation */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {selectedThread ? (
            <>
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 shrink-0">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link href={`/admin/customers/${selectedThread.customerId}`} className="text-sm font-medium text-gray-900 hover:underline">{selectedThread.firstName ?? 'Unknown'}</Link>
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

              <MessageTimeline thread={selectedThread} />

              <div className="shrink-0 border-t border-gray-200 px-4 py-3">
                <ReplyInput
                  customerId={selectedThread.customerId}
                  onSent={() => router.refresh()}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-500">
              Select a conversation to view messages
            </div>
          )}
        </div>

        {/* Right column: customer panel — hidden below lg, drawer on md */}
        <div className="hidden lg:flex w-80 shrink-0 border-l border-gray-200 flex-col overflow-y-auto">
          {selectedThread ? (
            <CustomerPanel
              thread={selectedThread}
              adminUsers={adminUsers}
              currentUserId={currentUser.id}
              currentUserName={currentUser.name}
              onAssign={(id) => handleAssign(selectedThread.customerId, id)}
              onFollowUpUpdate={(d, n) => handleFollowUpUpdate(selectedThread.customerId, d, n)}
              onNoteAdded={(note) => handleNoteAdded(selectedThread.customerId, note)}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs text-gray-400 p-4 text-center">
              Customer details will appear here
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

function FilterBar({ adminUsers, currentUserId, assigneeFilter, setAssigneeFilter, view, setView }: {
  adminUsers: AdminUser[]
  currentUserId: string
  assigneeFilter: AssigneeFilter
  setAssigneeFilter: (f: AssigneeFilter) => void
  view: View
  setView: (v: View) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      <select
        value={assigneeFilter}
        onChange={(e) => setAssigneeFilter(e.target.value as AssigneeFilter)}
        className="text-xs border border-gray-300 rounded px-1.5 py-0.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-400 bg-white"
      >
        <option value="all">All</option>
        {currentUserId !== 'admin' && <option value="mine">Mine</option>}
        <option value="unassigned">Unassigned</option>
        {adminUsers.map((u) => (
          <option key={u.id} value={u.id}>{u.name}</option>
        ))}
      </select>
      <div className="flex rounded border border-gray-300 overflow-hidden">
        <button
          onClick={() => setView('active')}
          className={`text-xs px-2 py-0.5 transition-colors ${view === 'active' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
        >
          Active
        </button>
        <button
          onClick={() => setView('scheduled')}
          className={`text-xs px-2 py-0.5 border-l border-gray-300 transition-colors ${view === 'scheduled' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
        >
          Scheduled
        </button>
      </div>
    </div>
  )
}
