'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

export default function JoinPage() {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
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
          setError("Looks like you're already signed up. Check your texts!")
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
    <div className="bg-stone-900 rounded-2xl border border-stone-700 p-8">
      <div className="mb-6">
        <p className="text-xs font-medium tracking-widest text-stone-500 uppercase mb-1">
          Step 1 of 4
        </p>
        <h2 className="text-xl font-light text-stone-100">Your mobile number</h2>
        <p className="mt-1 text-sm text-stone-400">
          We&apos;ll send a verification code to confirm it&apos;s you.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="phone" className="block text-sm text-stone-400 mb-1.5">
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
            className="w-full bg-stone-800 border border-stone-600 rounded-lg px-4 py-3 text-stone-100 placeholder-stone-600 focus:outline-none focus:border-stone-400 transition-colors text-base"
          />
        </div>

        {error && (
          <p className="text-sm text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-4 py-3">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !phone.trim()}
          className="w-full bg-stone-100 hover:bg-white text-stone-900 font-medium rounded-lg px-4 py-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Sending code…' : 'Send verification code'}
        </button>
      </form>
    </div>
  )
}
