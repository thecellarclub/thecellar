'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1)
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const currentYear = new Date().getFullYear()
const YEARS = Array.from({ length: 100 }, (_, i) => currentYear - 18 - i)

export default function DetailsPage() {
  const router = useRouter()
  const [firstName, setFirstName] = useState('')
  const [dobDay, setDobDay] = useState('')
  const [dobMonth, setDobMonth] = useState('')
  const [dobYear, setDobYear] = useState('')
  const [ageConsent, setAgeConsent] = useState(false)
  const [marketingConsent, setMarketingConsent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (!ageConsent || !marketingConsent) {
      setError('Please tick both boxes to continue.')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/signup/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          dobDay: parseInt(dobDay),
          dobMonth: parseInt(dobMonth),
          dobYear: parseInt(dobYear),
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

      router.push('/join/confirmed')
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
          Step 3 of 4
        </p>
        <h2 className="font-serif text-2xl text-cream">A few more details</h2>
        <p className="font-sans text-sm text-cream/55 mt-1">
          Required for age verification and UK compliance.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* First name */}
        <div>
          <label htmlFor="firstName" className="block font-sans text-xs text-cream/55 mb-1.5 uppercase tracking-wide">
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
            className="w-full bg-maroon border border-cream/20 px-4 py-3 text-cream placeholder-cream/30 focus:outline-none focus:border-cream/50 transition-colors font-sans text-base"
          />
        </div>

        {/* Date of birth */}
        <div>
          <label className="block font-sans text-xs text-cream/55 mb-1.5 uppercase tracking-wide">
            Date of birth
          </label>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label htmlFor="dob-day" className="sr-only">Day</label>
              <select
                id="dob-day"
                value={dobDay}
                onChange={(e) => setDobDay(e.target.value)}
                required
                className="w-full bg-maroon border border-cream/20 px-3 py-3 text-cream focus:outline-none focus:border-cream/50 transition-colors appearance-none font-sans"
              >
                <option value="">Day</option>
                {DAYS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="dob-month" className="sr-only">Month</label>
              <select
                id="dob-month"
                value={dobMonth}
                onChange={(e) => setDobMonth(e.target.value)}
                required
                className="w-full bg-maroon border border-cream/20 px-3 py-3 text-cream focus:outline-none focus:border-cream/50 transition-colors appearance-none font-sans"
              >
                <option value="">Month</option>
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="dob-year" className="sr-only">Year</label>
              <select
                id="dob-year"
                value={dobYear}
                onChange={(e) => setDobYear(e.target.value)}
                required
                className="w-full bg-maroon border border-cream/20 px-3 py-3 text-cream focus:outline-none focus:border-cream/50 transition-colors appearance-none font-sans"
              >
                <option value="">Year</option>
                {YEARS.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Consent checkboxes */}
        <div className="space-y-3 pt-1">
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={ageConsent}
              onChange={(e) => setAgeConsent(e.target.checked)}
              className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[#9B1B30] cursor-pointer"
            />
            <span className="text-sm text-cream/60 leading-relaxed font-sans">
              I confirm I am 18 or over and a UK resident.{' '}
              <span className="text-red-400">*</span>
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={marketingConsent}
              onChange={(e) => setMarketingConsent(e.target.checked)}
              className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[#9B1B30] cursor-pointer"
            />
            <span className="text-sm text-cream/60 leading-relaxed font-sans">
              I agree to receive promotional SMS messages from The Cellar Club. Reply{' '}
              <strong className="text-cream/80 font-medium">STOP</strong> at any time to unsubscribe.{' '}
              <span className="text-red-400">*</span>
            </span>
          </label>
        </div>

        {error && (
          <p className="font-sans text-sm text-red-400 bg-red-950/30 border border-red-900/40 px-4 py-3">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !firstName.trim() || !dobDay || !dobMonth || !dobYear}
          className="w-full bg-rio text-cream font-sans font-medium px-4 py-3 transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? 'Completing sign-up…' : 'Complete sign-up'}
        </button>
      </form>
    </div>
  )
}
