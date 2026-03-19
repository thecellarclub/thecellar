'use client'

import { useState, useEffect, FormEvent, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

function buildPhone(raw: string): string {
  const stripped = raw.replace(/[\s\-]/g, '')
  if (stripped.startsWith('0')) return '+44' + stripped.slice(1)
  return '+44' + stripped
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
      <div className="bg-maroon-dark border border-cream/12 p-8">
        <p className="font-sans text-sm text-cream/60">Sending code…</p>
      </div>
    )
  }

  return (
    <div className="bg-maroon-dark border border-cream/12 p-8">
      <div className="mb-6">
        <p className="font-serif text-xs uppercase tracking-[0.3em] text-gold mb-1">
          Step 1 of 4
        </p>
        <h2 className="font-serif text-2xl text-cream">Your mobile number</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="phone" className="block font-sans text-xs text-cream/55 mb-1.5 uppercase tracking-wide">
            UK mobile number
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

        {alreadySignedUp && (
          <p className="font-sans text-sm text-red-400 bg-red-950/30 border border-red-900/40 px-4 py-3">
            Looks like you&apos;re already signed up.{' '}
            <Link href="/portal" className="underline underline-offset-2 text-cream/80 hover:text-cream transition-colors">
              Log in here →
            </Link>
          </p>
        )}

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
