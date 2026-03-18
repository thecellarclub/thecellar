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

      router.push('/join/card')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (tooManyAttempts) {
    return (
      <div className="bg-stone-900 rounded-2xl border border-stone-700 p-8 text-center">
        <p className="text-stone-300 mb-4">Too many incorrect attempts.</p>
        <p className="text-stone-500 text-sm mb-6">
          Please wait a few minutes and{' '}
          <Link href="/join" className="text-stone-300 underline underline-offset-2 hover:text-white">
            request a new code
          </Link>
          .
        </p>
      </div>
    )
  }

  return (
    <div className="bg-stone-900 rounded-2xl border border-stone-700 p-8">
      <div className="mb-6">
        <p className="text-xs font-medium tracking-widest text-stone-500 uppercase mb-1">
          Step 1 of 4
        </p>
        <h2 className="text-xl font-light text-stone-100">Check your messages</h2>
        <p className="mt-1 text-sm text-stone-400">
          Enter the 6-digit code we just sent to your phone.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="code" className="block text-sm text-stone-400 mb-1.5">
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
            className="w-full bg-stone-800 border border-stone-600 rounded-lg px-4 py-3 text-stone-100 placeholder-stone-600 focus:outline-none focus:border-stone-400 transition-colors text-base tracking-widest text-center text-xl"
          />
        </div>

        {error && (
          <p className="text-sm text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-4 py-3">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || code.length !== 6}
          className="w-full bg-stone-100 hover:bg-white text-stone-900 font-medium rounded-lg px-4 py-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Verifying…' : 'Verify code'}
        </button>

        <p className="text-center text-sm text-stone-500">
          Didn&apos;t get a code?{' '}
          <Link href="/join" className="text-stone-300 underline underline-offset-2 hover:text-white">
            Go back and resend
          </Link>
        </p>
      </form>
    </div>
  )
}
