'use client'

import { useState, FormEvent, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

function JoinPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [phone, setPhone] = useState(searchParams.get('phone') ?? '')
  const [error, setError] = useState('')
  const [alreadySignedUp, setAlreadySignedUp] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setAlreadySignedUp(false)
    setLoading(true)

    try {
      const res = await fetch('/api/signup/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
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
    }
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
          <input
            id="phone"
            type="tel"
            autoComplete="tel"
            placeholder="07700 900000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            className="w-full bg-maroon border border-cream/20 px-4 py-3 text-cream placeholder-cream/30 focus:outline-none focus:border-cream/50 transition-colors font-sans text-base"
          />
          <p className="font-sans text-xs text-cream/35 mt-1.5">UK numbers only (07xxx or +447xxx)</p>
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
