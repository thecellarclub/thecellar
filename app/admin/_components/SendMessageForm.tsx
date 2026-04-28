'use client'

import { useState, useEffect, useRef } from 'react'

type Customer = { id: string; first_name: string | null; phone: string | null }

type Props = {
  customers: Customer[]
  initialPhone?: string
}

type Selected = { name: string | null; phone: string }

export default function SendMessageForm({ customers, initialPhone }: Props) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Selected | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (initialPhone) {
      const match = customers.find((c) => c.phone === initialPhone)
      if (match && match.phone) {
        setSelected({ name: match.first_name, phone: match.phone })
      } else if (initialPhone) {
        setSelected({ name: null, phone: initialPhone })
      }
    }
  }, [initialPhone, customers])

  useEffect(() => {
    return () => {
      if (successTimer.current) clearTimeout(successTimer.current)
    }
  }, [])

  const results = search.trim()
    ? customers
        .filter((c) => {
          const q = search.toLowerCase()
          return (
            c.first_name?.toLowerCase().includes(q) ||
            c.phone?.includes(search)
          )
        })
        .slice(0, 8)
    : []

  function selectCustomer(c: Customer) {
    if (c.phone) {
      setSelected({ name: c.first_name, phone: c.phone })
    }
    setSearch('')
    setShowDropdown(false)
  }

  function clearSelection() {
    setSelected(null)
    setSearch('')
    setTimeout(() => searchRef.current?.focus(), 0)
  }

  async function handleSend() {
    if (!selected || !message.trim()) return
    setSending(true)
    setError(null)
    setSuccess(null)

    const res = await fetch('/api/admin/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: selected.phone, message: message.trim() }),
    })

    setSending(false)

    if (res.ok) {
      const label = selected.name
        ? `${selected.name} (${selected.phone})`
        : selected.phone
      setSuccess(`Message sent to ${label}`)
      setMessage('')
      successTimer.current = setTimeout(() => setSuccess(null), 5000)
    } else {
      const data = await res.json()
      setError(data.error ?? 'Failed to send SMS')
    }
  }

  const charCount = message.length
  const overLimit = charCount > 160
  const nearLimit = charCount > 155

  return (
    <div className="space-y-5">
      {/* Search */}
      <div className="relative">
        <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
        <input
          ref={searchRef}
          type="text"
          value={search}
          placeholder="Name or phone number…"
          onChange={(e) => {
            setSearch(e.target.value)
            setShowDropdown(true)
          }}
          onFocus={() => setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400"
        />
        {showDropdown && results.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded shadow-md max-h-64 overflow-y-auto">
            {results.map((c) => (
              <li
                key={c.id}
                onMouseDown={() => selectCustomer(c)}
                className="px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 flex items-center justify-between gap-3"
              >
                <span className="font-medium text-gray-900">{c.first_name ?? '—'}</span>
                <span className="text-gray-500 font-mono text-xs">{c.phone}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* To: display */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
        {selected ? (
          <div className="flex items-center justify-between border border-gray-300 rounded px-3 py-2 bg-gray-50">
            <div className="text-sm">
              {selected.name && (
                <span className="font-medium text-gray-900 mr-2">{selected.name}</span>
              )}
              <span className="font-mono text-gray-600 text-xs">{selected.phone}</span>
            </div>
            <button
              onClick={clearSelection}
              className="text-gray-400 hover:text-gray-600 text-lg leading-none ml-2"
              aria-label="Clear selection"
            >
              ×
            </button>
          </div>
        ) : (
          <div className="border border-dashed border-gray-300 rounded px-3 py-2 text-sm text-gray-400">
            No recipient selected
          </div>
        )}
      </div>

      {/* Message */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium text-gray-700">Message</label>
          <span
            className={`text-xs font-mono ${
              overLimit ? 'text-red-600 font-bold' : nearLimit ? 'text-amber-600' : 'text-gray-400'
            }`}
          >
            {charCount} / 160
          </span>
        </div>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          placeholder="Type your message…"
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400"
        />
      </div>

      {/* Send button */}
      <button
        onClick={handleSend}
        disabled={!selected || !message.trim() || sending}
        className="bg-gray-900 text-white text-sm px-6 py-2 rounded hover:bg-gray-700 disabled:opacity-40"
      >
        {sending ? 'Sending…' : 'Send SMS'}
      </button>

      {/* Success */}
      {success && (
        <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded px-4 py-3 text-sm text-green-800">
          <span>{success}</span>
          <button
            onClick={() => setSuccess(null)}
            className="text-green-600 hover:text-green-800 text-lg leading-none ml-3"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  )
}
