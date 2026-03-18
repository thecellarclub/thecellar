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
    <div className="bg-stone-900 rounded-2xl border border-stone-700 p-8">
      <div className="mb-6">
        <p className="text-xs font-medium tracking-widest text-stone-500 uppercase mb-1">
          Step 3 of 4
        </p>
        <h2 className="text-xl font-light text-stone-100">A few more details</h2>
        <p className="mt-1 text-sm text-stone-400">
          Required for age verification and UK compliance.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* First name */}
        <div>
          <label htmlFor="firstName" className="block text-sm text-stone-400 mb-1.5">
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
            className="w-full bg-stone-800 border border-stone-600 rounded-lg px-4 py-3 text-stone-100 placeholder-stone-600 focus:outline-none focus:border-stone-400 transition-colors"
          />
        </div>

        {/* Date of birth */}
        <div>
          <label className="block text-sm text-stone-400 mb-1.5">
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
                className="w-full bg-stone-800 border border-stone-600 rounded-lg px-3 py-3 text-stone-100 focus:outline-none focus:border-stone-400 transition-colors appearance-none"
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
                className="w-full bg-stone-800 border border-stone-600 rounded-lg px-3 py-3 text-stone-100 focus:outline-none focus:border-stone-400 transition-colors appearance-none"
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
                className="w-full bg-stone-800 border border-stone-600 rounded-lg px-3 py-3 text-stone-100 focus:outline-none focus:border-stone-400 transition-colors appearance-none"
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
              className="mt-0.5 h-4 w-4 flex-shrink-0 accent-stone-100 cursor-pointer"
            />
            <span className="text-sm text-stone-400 leading-relaxed">
              I confirm I am 18 or over and a UK resident.{' '}
              <span className="text-red-400">*</span>
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={marketingConsent}
              onChange={(e) => setMarketingConsent(e.target.checked)}
              className="mt-0.5 h-4 w-4 flex-shrink-0 accent-stone-100 cursor-pointer"
            />
            <span className="text-sm text-stone-400 leading-relaxed">
              I agree to receive promotional SMS messages from Cellar Text. Reply{' '}
              <strong className="text-stone-300">STOP</strong> at any time to unsubscribe.{' '}
              <span className="text-red-400">*</span>
            </span>
          </label>
        </div>

        {error && (
          <p className="text-sm text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-4 py-3">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !firstName.trim() || !dobDay || !dobMonth || !dobYear}
          className="w-full bg-stone-100 hover:bg-white text-stone-900 font-medium rounded-lg px-4 py-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Completing sign-up…' : 'Complete sign-up'}
        </button>
      </form>
    </div>
  )
}
