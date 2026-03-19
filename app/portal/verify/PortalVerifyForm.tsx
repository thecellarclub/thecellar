'use client'

import { useState, FormEvent, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function PortalVerifyForm() {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const stored = sessionStorage.getItem('portal_phone')
    if (!stored) {
      router.push('/portal')
    } else {
      setPhone(stored)
    }
  }, [router])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/portal/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong.')
        return
      }

      sessionStorage.removeItem('portal_phone')
      router.push('/portal/dashboard')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    if (!phone) return
    setError('')
    await fetch('/api/portal/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    })
    setError('New code sent.')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="code" className="block font-sans text-xs text-cream/55 mb-1.5 uppercase tracking-wide">
          Login code
        </label>
        <input
          id="code"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          placeholder="123456"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          required
          autoFocus
          className="w-full bg-maroon border border-cream/20 px-4 py-3 text-cream placeholder-cream/30 focus:outline-none focus:border-cream/50 transition-colors font-sans text-base tracking-widest"
        />
      </div>

      {error && (
        <p className={`font-sans text-sm px-4 py-3 border ${error === 'New code sent.' ? 'text-green-400 bg-green-950/30 border-green-900/40' : 'text-red-400 bg-red-950/30 border-red-900/40'}`}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || code.length !== 6}
        className="w-full bg-rio text-cream font-sans font-medium px-4 py-3 transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading ? 'Verifying…' : 'Verify →'}
      </button>

      <p className="font-sans text-xs text-cream/40 text-center">
        Didn&apos;t get it?{' '}
        <button type="button" onClick={handleResend} className="underline underline-offset-2 text-cream/60 hover:text-cream transition-colors">
          Send a new code
        </button>
      </p>
    </form>
  )
}
