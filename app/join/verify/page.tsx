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
      <div className="bg-[#F5EFE6] border p-8 text-center" style={{ borderColor: 'rgba(42,24,16,0.12)' }}>
        <p className="font-sans mb-4" style={{ color: 'rgba(42,24,16,0.70)' }}>Too many incorrect attempts.</p>
        <p className="font-sans text-sm mb-6" style={{ color: 'rgba(42,24,16,0.55)' }}>
          Please wait a few minutes and{' '}
          <Link href="/join" className="underline underline-offset-2" style={{ color: '#9B1B30' }}>
            request a new code
          </Link>
          .
        </p>
      </div>
    )
  }

  return (
    <div className="bg-[#F5EFE6] border p-8" style={{ borderColor: 'rgba(42,24,16,0.12)' }}>
      <div className="mb-6">
        <p className="font-serif text-xs uppercase tracking-[0.3em] mb-1" style={{ color: '#9B1B30' }}>
          Step 1 of 4
        </p>
        <h2 className="font-serif text-2xl" style={{ color: '#1C0E09' }}>Check your messages</h2>
        <p className="font-sans text-sm mt-1" style={{ color: 'rgba(42,24,16,0.55)' }}>
          Enter the 6-digit code we just sent to your phone.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="code" className="block font-sans text-xs mb-1.5 uppercase tracking-wide" style={{ color: 'rgba(42,24,16,0.55)' }}>
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
            className="w-full bg-[#EDE8DF] border px-4 py-3 focus:outline-none transition-colors text-base tracking-widest text-center text-xl font-sans"
            style={{ color: '#1C0E09', borderColor: 'rgba(42,24,16,0.18)' }}
          />
        </div>

        {error && (
          <p className="font-sans text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
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

        <p className="text-center font-sans text-sm" style={{ color: 'rgba(42,24,16,0.45)' }}>
          Didn&apos;t get a code?{' '}
          <Link href="/join" className="underline underline-offset-2" style={{ color: '#9B1B30' }}>
            Go back and resend
          </Link>
        </p>
      </form>
    </div>
  )
}
