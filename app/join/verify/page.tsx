'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function VerifyPage() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [tooManyAttempts, setTooManyAttempts] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/signup/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.error === 'too_many_attempts' || res.status === 429) {
          setTooManyAttempts(true)
        } else {
          setError(data.error || 'Something went wrong. Please try again.')
        }
        return
      }

      router.push('/join/details')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (tooManyAttempts) {
    return (
      <div className="bg-maroon-dark border border-cream/12 p-8 text-center">
        <p className="text-cream/70 font-sans mb-4">Too many incorrect attempts.</p>
        <p className="font-sans text-cream/50 text-sm mb-6">
          Please wait a few minutes and{' '}
          <Link href="/join" className="text-cream/60 underline underline-offset-2 hover:text-cream">
            request a new code
          </Link>
          .
        </p>
      </div>
    )
  }

  return (
    <div className="bg-maroon-dark border border-cream/12 p-8">
      <div className="mb-6">
        <p className="font-serif text-xs uppercase tracking-[0.3em] text-gold mb-1">
          Step 1 of 4
        </p>
        <h2 className="font-serif text-2xl text-cream">Check your messages</h2>
        <p className="font-sans text-sm text-cream/55 mt-1">
          Enter the 6-digit code we just sent to your phone.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="code" className="block font-sans text-xs text-cream/55 mb-1.5 uppercase tracking-wide">
            Verification code
          </label>
          <input
            id="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            required
            className="w-full bg-maroon border border-cream/20 px-4 py-3 text-cream placeholder-cream/30 focus:outline-none focus:border-cream/50 transition-colors text-base tracking-widest text-center text-xl font-sans"
          />
        </div>

        {error && (
          <p className="font-sans text-sm text-red-400 bg-red-950/30 border border-red-900/40 px-4 py-3">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || code.length !== 6}
          className="w-full bg-rio text-cream font-sans font-medium px-4 py-3 transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? 'Verifying…' : 'Verify code'}
        </button>

        <p className="text-center font-sans text-sm text-cream/40">
          Didn&apos;t get a code?{' '}
          <Link href="/join" className="text-cream/60 underline underline-offset-2 hover:text-cream">
            Go back and resend
          </Link>
        </p>
      </form>
    </div>
  )
}
