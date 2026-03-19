'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

function buildPhone(raw: string): string {
  const stripped = raw.replace(/[\s\-]/g, '')
  if (stripped.startsWith('0')) return '+44' + stripped.slice(1)
  return '+44' + stripped
}

export default function PortalLoginForm() {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const builtPhone = buildPhone(phone)

    try {
      const res = await fetch('/api/portal/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: builtPhone }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Something went wrong. Please try again.')
        return
      }

      // Store E.164 phone in sessionStorage for verify page
      sessionStorage.setItem('portal_phone', builtPhone)
      router.push('/portal/verify')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="phone" className="block font-sans text-xs text-cream/55 mb-1.5 uppercase tracking-wide">
          Mobile number
        </label>
        <div className="flex items-stretch border border-cream/20 focus-within:border-cream/50 transition-colors">
          <span className="flex items-center px-3 font-sans text-base text-cream/60 border-r border-cream/20 select-none bg-transparent whitespace-nowrap">
            +44
          </span>
          <input
            id="phone"
            type="tel"
            autoComplete="tel"
            placeholder="7700 900000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            className="flex-1 bg-maroon px-4 py-3 text-cream placeholder-cream/30 focus:outline-none font-sans text-base"
          />
        </div>
      </div>

      {error && (
        <p className="font-sans text-sm text-red-400 bg-red-950/30 border border-red-900/40 px-4 py-3">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || !phone.trim()}
        className="w-full bg-rio text-cream font-sans font-medium px-4 py-3 transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading ? 'Sending code…' : 'Send login code →'}
      </button>
    </form>
  )
}
