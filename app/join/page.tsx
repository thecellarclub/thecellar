'use client'

import { useState, useEffect, FormEvent, Suspense } from 'react'

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
  }
}
import { useRouter } from 'next/navigation'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

function buildPhone(raw: string): string {
  let s = raw.replace(/[\s\-]/g, '')
  if (s.startsWith('+44')) s = s.slice(3)
  else if (s.startsWith('44')) s = s.slice(2)
  else if (s.startsWith('0')) s = s.slice(1)
  s = s.replace(/^\+/, '')
  return '+44' + s
}

function JoinPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const phoneParam = searchParams.get('phone') ?? ''
  const [phone, setPhone] = useState(phoneParam)
  const [error, setError] = useState('')
  const [alreadySignedUp, setAlreadySignedUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [autoSubmitting, setAutoSubmitting] = useState(!!phoneParam)

  async function sendCode(e164: string) {
    setError('')
    setAlreadySignedUp(false)
    setLoading(true)

    try {
      const res = await fetch('/api/signup/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: e164 }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.error === 'looks_like_already_signed_up') {
          setAlreadySignedUp(true)
        } else {
          setError(data.error || 'Something went wrong. Please try again.')
        }
        return
      }

      window.gtag?.('event', 'conversion', {
        send_to: 'AW-17764225252/SoKhCIivrZ4cEOSh0pZC',
      })
      router.push('/join/verify')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
      setAutoSubmitting(false)
    }
  }

  useEffect(() => {
    if (phoneParam) {
      sendCode(buildPhone(phoneParam))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    await sendCode(buildPhone(phone))
  }

  if (autoSubmitting) {
    return (
      <div className="bg-[#F5EFE6] border p-8" style={{ borderColor: 'rgba(42,24,16,0.12)' }}>
        <p className="font-sans text-sm" style={{ color: 'rgba(42,24,16,0.55)' }}>Sending code…</p>
      </div>
    )
  }

  return (
    <div className="bg-[#F5EFE6] border p-8" style={{ borderColor: 'rgba(42,24,16,0.12)' }}>
      <div className="mb-6">
        <p className="font-serif text-xs uppercase tracking-[0.3em] mb-1" style={{ color: '#9B1B30' }}>
          Step 1 of 4
        </p>
        <h2 className="font-serif text-2xl" style={{ color: '#1C0E09' }}>Your mobile number</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="phone" className="block font-sans text-xs mb-1.5 uppercase tracking-wide" style={{ color: 'rgba(42,24,16,0.55)' }}>
            UK mobile number
          </label>
          <div className="flex items-stretch border transition-colors" style={{ borderColor: 'rgba(42,24,16,0.18)' }}>
            <span className="flex items-center px-3 font-sans text-base border-r select-none bg-transparent whitespace-nowrap" style={{ color: 'rgba(42,24,16,0.60)', borderColor: 'rgba(42,24,16,0.18)' }}>
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
              className="flex-1 bg-[#EDE8DF] px-4 py-3 focus:outline-none font-sans text-base"
              style={{ color: '#1C0E09' }}
            />
          </div>
        </div>

        {alreadySignedUp && (
          <p className="font-sans text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
            Looks like you&apos;re already signed up.{' '}
            <Link href="/portal" className="underline underline-offset-2 hover:opacity-80 transition-opacity" style={{ color: '#9B1B30' }}>
              Log in here →
            </Link>
          </p>
        )}

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
          {loading ? 'Sending code…' : 'Send verification code'}
        </button>
      </form>
    </div>
  )
}

export default function JoinPage() {
  return (
    <Suspense>
      <JoinPageInner />
    </Suspense>
  )
}
