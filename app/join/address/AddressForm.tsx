'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

export default function AddressForm() {
  const router = useRouter()
  const [line1, setLine1] = useState('')
  const [line2, setLine2] = useState('')
  const [city, setCity] = useState('')
  const [postcode, setPostcode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (!line1.trim() || !city.trim() || !postcode.trim()) {
      setError('Please fill in your address, city and postcode.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/signup/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          line1: line1.trim(),
          line2: line2.trim() || null,
          city: city.trim(),
          postcode: postcode.trim().toUpperCase(),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.')
        return
      }

      router.push('/join/confirmed')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const inputClass =
    'w-full bg-maroon border border-cream/20 text-cream placeholder-cream/30 px-4 py-3 font-sans text-base focus:outline-none focus:border-cream/50 transition-colors'
  const labelClass = 'block font-sans text-xs text-cream/55 mb-1.5 uppercase tracking-wide'

  return (
    <div className="bg-maroon-dark border border-cream/12 p-8">
      <div className="mb-6">
        <p className="font-serif text-xs uppercase tracking-[0.3em] text-gold mb-1">
          Step 4 of 5
        </p>
        <h2 className="font-serif text-2xl text-cream">Where do you want your bottles sent?</h2>
        <p className="font-sans text-sm text-cream/50 mt-1">
          We&apos;ll store your wines until your case is full, then ship here for free.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelClass}>Address line 1</label>
          <input
            type="text"
            value={line1}
            onChange={(e) => setLine1(e.target.value)}
            placeholder="12 Castle Street"
            className={inputClass}
            autoComplete="address-line1"
            required
          />
        </div>

        <div>
          <label className={labelClass}>
            Address line 2{' '}
            <span className="text-cream/30 normal-case">(optional)</span>
          </label>
          <input
            type="text"
            value={line2}
            onChange={(e) => setLine2(e.target.value)}
            placeholder="Flat 2"
            className={inputClass}
            autoComplete="address-line2"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>City</label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Durham"
              className={inputClass}
              autoComplete="address-level2"
              required
            />
          </div>
          <div>
            <label className={labelClass}>Postcode</label>
            <input
              type="text"
              value={postcode}
              onChange={(e) => setPostcode(e.target.value.toUpperCase())}
              placeholder="DH1 3AG"
              className={inputClass}
              autoComplete="postal-code"
              required
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
          disabled={loading || !line1.trim() || !city.trim() || !postcode.trim()}
          className="w-full bg-rio text-cream font-sans font-medium px-4 py-3 transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? 'Completing sign-up…' : 'Complete sign-up →'}
        </button>
      </form>
    </div>
  )
}
