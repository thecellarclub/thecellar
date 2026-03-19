'use client'

import { useState, FormEvent } from 'react'

type SavedAddress = {
  line1: string
  line2?: string | null
  city: string
  postcode: string
}

type BottleEntry = {
  name: string
  quantity: number
  price_pence: number
}

interface Props {
  token: string
  savedAddress?: SavedAddress | null
  bottles?: BottleEntry[]
}

export default function ShipForm({ token, savedAddress, bottles }: Props) {
  const [line1, setLine1] = useState(savedAddress?.line1 ?? '')
  const [line2, setLine2] = useState(savedAddress?.line2 ?? '')
  const [city, setCity] = useState(savedAddress?.city ?? '')
  const [postcode, setPostcode] = useState(savedAddress?.postcode ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  if (done) {
    return (
      <div className="text-center py-4 space-y-3">
        <div className="w-12 h-px bg-cream/20 mx-auto mb-4" />
        <p className="font-serif text-xl text-cream">Your case is being packed.</p>
        <p className="font-sans text-sm text-cream/50">
          We&apos;ll drop you a message as soon as it&apos;s on its way. Nice one.
        </p>
      </div>
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const res = await fetch('/api/ship/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, line1, line2: line2 || undefined, city, postcode }),
    })

    setLoading(false)

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Something went wrong. Please try again.')
      return
    }

    setDone(true)
  }

  const totalBottles = (bottles ?? []).reduce((s, b) => s + b.quantity, 0)

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Bottle list */}
      {bottles && bottles.length > 0 && (
        <div className="mb-6">
          <p className="font-sans text-xs uppercase tracking-[0.15em] text-cream/40 mb-3">
            Your case
          </p>
          <ul className="space-y-1.5">
            {bottles.map((b) => (
              <li key={b.name} className="flex items-baseline justify-between gap-2">
                <span className="font-sans text-sm text-cream leading-snug">
                  {b.quantity}× {b.name}
                </span>
                <span className="font-sans text-xs text-cream/40 shrink-0">
                  £{(b.price_pence / 100).toFixed(0)}/bottle
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 pt-3 border-t border-cream/10 flex justify-between items-baseline">
            <span className="font-sans text-xs text-cream/40 uppercase tracking-[0.1em]">Total</span>
            <span className="font-sans text-sm text-cream/70">
              {totalBottles} bottle{totalBottles !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      )}

      {/* Pre-fill note */}
      {savedAddress && (
        <p className="font-sans text-xs text-cream/45 mb-4 leading-relaxed">
          We&apos;ll ship to your saved address — update below if anything&apos;s changed.
        </p>
      )}

      <div>
        <label className="block font-sans text-xs text-cream/55 mb-1 uppercase tracking-wide">
          Address line 1
        </label>
        <input
          type="text"
          required
          value={line1}
          onChange={(e) => setLine1(e.target.value)}
          placeholder="House number and street"
          className="w-full bg-maroon border border-cream/20 px-3 py-2 text-cream text-sm font-sans placeholder-cream/30 focus:outline-none focus:border-cream/50 transition-colors"
        />
      </div>

      <div>
        <label className="block font-sans text-xs text-cream/55 mb-1 uppercase tracking-wide">
          Address line 2{' '}
          <span className="font-sans text-cream/30 text-xs normal-case tracking-normal">(optional)</span>
        </label>
        <input
          type="text"
          value={line2}
          onChange={(e) => setLine2(e.target.value)}
          placeholder="Apartment, flat, etc."
          className="w-full bg-maroon border border-cream/20 px-3 py-2 text-cream text-sm font-sans placeholder-cream/30 focus:outline-none focus:border-cream/50 transition-colors"
        />
      </div>

      <div>
        <label className="block font-sans text-xs text-cream/55 mb-1 uppercase tracking-wide">City</label>
        <input
          type="text"
          required
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="w-full bg-maroon border border-cream/20 px-3 py-2 text-cream text-sm font-sans placeholder-cream/30 focus:outline-none focus:border-cream/50 transition-colors"
        />
      </div>

      <div>
        <label className="block font-sans text-xs text-cream/55 mb-1 uppercase tracking-wide">Postcode</label>
        <input
          type="text"
          required
          value={postcode}
          onChange={(e) => setPostcode(e.target.value)}
          placeholder="e.g. SW1A 1AA"
          className="w-full bg-maroon border border-cream/20 px-3 py-2 text-cream text-sm font-sans placeholder-cream/30 focus:outline-none focus:border-cream/50 transition-colors"
        />
      </div>

      {error && <p className="font-sans text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-rio text-cream font-sans font-medium py-2.5 text-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
      >
        {loading ? 'Confirming…' : 'Confirm and ship to this address →'}
      </button>
    </form>
  )
}
