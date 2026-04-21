'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

function formatDob(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return digits.slice(0, 2) + '-' + digits.slice(2)
  return digits.slice(0, 2) + '-' + digits.slice(2, 4) + '-' + digits.slice(4)
}

export default function DetailsPage() {
  const router = useRouter()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [dob, setDob] = useState('')
  const [ageConsent, setAgeConsent] = useState(false)
  const [marketingConsent, setMarketingConsent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const dobComplete = dob.replace(/\D/g, '').length === 8

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (!ageConsent || !marketingConsent) {
      setError('Please tick both boxes to continue.')
      return
    }

    const digits = dob.replace(/\D/g, '')
    const dobDay = parseInt(digits.slice(0, 2), 10)
    const dobMonth = parseInt(digits.slice(2, 4), 10)
    const dobYear = parseInt(digits.slice(4, 8), 10)

    setLoading(true)

    try {
      const res = await fetch('/api/signup/save-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          dobDay,
          dobMonth,
          dobYear,
          ageConsent,
          marketingConsent,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.error === 'under_18') {
          setError('Sorry — you must be 18 or over to sign up.')
        } else if (data.error === 'looks_like_already_signed_up') {
          setError("Looks like you're already signed up!")
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

  return (
    <div className="bg-[#F5EFE6] border p-8" style={{ borderColor: 'rgba(42,24,16,0.12)' }}>
      <div className="mb-6">
        <p className="font-serif text-xs uppercase tracking-[0.3em] mb-1" style={{ color: '#9B1B30' }}>
          Step 2 of 4
        </p>
        <h2 className="font-serif text-2xl" style={{ color: '#1C0E09' }}>A few more details</h2>
        <p className="font-sans text-sm mt-1" style={{ color: 'rgba(42,24,16,0.55)' }}>
          Required for age verification and UK compliance.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* First name */}
        <div>
          <label htmlFor="firstName" className="block font-sans text-xs mb-1.5 uppercase tracking-wide" style={{ color: 'rgba(42,24,16,0.55)' }}>
            First name
          </label>
          <input
            id="firstName"
            type="text"
            autoComplete="given-name"
            placeholder="Jane"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            className="w-full bg-[#EDE8DF] border px-4 py-3 focus:outline-none transition-colors font-sans text-base"
            style={{ borderColor: 'rgba(42,24,16,0.18)', color: '#1C0E09' }}
          />
        </div>

        {/* Last name */}
        <div>
          <label htmlFor="lastName" className="block font-sans text-xs mb-1.5 uppercase tracking-wide" style={{ color: 'rgba(42,24,16,0.55)' }}>
            Last name
          </label>
          <input
            id="lastName"
            type="text"
            autoComplete="family-name"
            placeholder="Smith"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
            className="w-full bg-[#EDE8DF] border px-4 py-3 focus:outline-none transition-colors font-sans text-base"
            style={{ borderColor: 'rgba(42,24,16,0.18)', color: '#1C0E09' }}
          />
        </div>

        {/* Date of birth */}
        <div>
          <label htmlFor="dob" className="block font-sans text-xs mb-1.5 uppercase tracking-wide" style={{ color: 'rgba(42,24,16,0.55)' }}>
            Date of birth <span style={{ color: 'rgba(42,24,16,0.40)', textTransform: 'none', letterSpacing: 0 }}>(DD-MM-YYYY)</span>
          </label>
          <input
            id="dob"
            type="text"
            inputMode="numeric"
            autoComplete="bday"
            placeholder="DD-MM-YYYY"
            value={dob}
            onChange={(e) => setDob(formatDob(e.target.value))}
            required
            maxLength={10}
            className="w-full bg-[#EDE8DF] border px-4 py-3 focus:outline-none transition-colors font-sans text-base tracking-widest"
            style={{ borderColor: 'rgba(42,24,16,0.18)', color: '#1C0E09' }}
          />
        </div>

        {/* Consent checkboxes */}
        <div className="space-y-3 pt-1">
          {/* Age + UK delivery address */}
          <div>
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={ageConsent}
                onChange={(e) => setAgeConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[#9B1B30] cursor-pointer"
              />
              <span className="text-sm leading-relaxed font-sans" style={{ color: 'rgba(42,24,16,0.65)' }}>
                I confirm I am 18 or over and have a UK delivery address.{' '}
                <span className="text-red-600">*</span>
              </span>
            </label>
          </div>

          {/* Marketing consent */}
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={marketingConsent}
              onChange={(e) => setMarketingConsent(e.target.checked)}
              className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[#9B1B30] cursor-pointer"
            />
            <span className="text-sm leading-relaxed font-sans" style={{ color: 'rgba(42,24,16,0.65)' }}>
              I agree to receive SMS messages from The Cellar Club. Reply{' '}
              <strong style={{ color: '#1C0E09' }} className="font-medium">STOP</strong> at any time to unsubscribe.{' '}
              <span className="text-red-600">*</span>
            </span>
          </label>
        </div>

        {error && (
          <p className="font-sans text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !firstName.trim() || !lastName.trim() || !dobComplete}
          className="w-full bg-rio text-cream font-sans font-medium px-4 py-3 transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? 'Saving…' : 'Continue →'}
        </button>
      </form>
    </div>
  )
}
