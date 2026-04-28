'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

function buildPhone(raw: string): string {
  let s = raw.replace(/[\s\-]/g, '')
  if (s.startsWith('+44')) s = s.slice(3)
  else if (s.startsWith('44')) s = s.slice(2)
  else if (s.startsWith('0')) s = s.slice(1)
  s = s.replace(/^\+/, '')
  return '+44' + s
}

export default function PortalLoginForm() {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [wrapperFocused, setWrapperFocused] = useState(false)

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
        <label htmlFor="phone" className="block font-sans text-xs mb-1.5 uppercase tracking-wide" style={{ color: 'rgba(42,24,16,0.55)' }}>
          Mobile number
        </label>
        <div
          className="flex items-stretch border transition-colors"
          style={{ borderColor: wrapperFocused ? 'rgba(42,24,16,0.50)' : 'rgba(42,24,16,0.18)' }}
          onFocus={() => setWrapperFocused(true)}
          onBlur={() => setWrapperFocused(false)}
        >
          <span
            className="flex items-center px-3 font-sans text-base select-none bg-transparent whitespace-nowrap border-r"
            style={{ color: 'rgba(42,24,16,0.50)', borderColor: 'rgba(42,24,16,0.18)' }}
          >
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
            className="flex-1 px-4 py-3 focus:outline-none font-sans text-base"
            style={{ background: '#EDE8DF', color: '#1C0E09' }}
          />
        </div>
      </div>

      {error && (
        <p className="font-sans text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
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
