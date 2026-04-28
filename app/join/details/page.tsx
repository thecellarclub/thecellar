'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

function WelcomePanel({ firstName }: { firstName: string }) {
  const router = useRouter()
  return (
    <div className="bg-[#F5EFE6] border p-8" style={{ borderColor: 'rgba(42,24,16,0.12)' }}>
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-14 h-14 mb-5" style={{ border: '1px solid rgba(42,24,16,0.20)' }}>
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: 'rgba(42,24,16,0.50)' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <h2 className="font-serif text-2xl mb-2" style={{ color: '#1C0E09' }}>
          Welcome to The Cellar Club, {firstName}.
        </h2>
        <p className="font-sans text-sm" style={{ color: 'rgba(42,24,16,0.65)' }}>
          You&apos;re in. Check your phone — we just sent you a welcome text.
        </p>
      </div>

      <p className="font-sans text-sm leading-relaxed mb-6" style={{ color: 'rgba(42,24,16,0.65)' }}>
        To order when Daniel texts you, you&apos;ll need a card and delivery address on file. It takes about a minute — and once it&apos;s done, buying is as simple as texting back a number.
      </p>

      <button
        onClick={() => router.push('/join/card')}
        className="w-full bg-rio text-cream font-sans font-medium px-4 py-3 transition-opacity hover:opacity-90 mb-3"
      >
        Complete my membership &rarr;
      </button>

      <div className="text-center">
        <button
          onClick={() => router.push('/join/confirmed?skipped=1')}
          className="font-sans text-sm underline"
          style={{ color: 'rgba(42,24,16,0.35)' }}
        >
          I&apos;ll do it later
        </button>
      </div>
    </div>
  )
}

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
  const [lastName, setLastName] = useState('')
  const [dobDay, setDobDay] = useState('')
  const [dobMonth, setDobMonth] = useState('')
  const [dobYear, setDobYear] = useState('')
  const [ageConsent, setAgeConsent] = useState(false)
  const [marketingConsent, setMarketingConsent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [welcomed, setWelcomed] = useState(false)
  const [submittedFirstName, setSubmittedFirstName] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (!ageConsent || !marketingConsent) {
      setError('Please tick both boxes to continue.')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/signup/save-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
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

      setSubmittedFirstName(firstName.trim())
      setWelcomed(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (welcomed) {
    return <WelcomePanel firstName={submittedFirstName} />
  }

  const inputClass = 'w-full bg-[#EDE8DF] border px-4 py-3 focus:outline-none transition-colors font-sans text-base'
  const inputStyle = { color: '#1C0E09', borderColor: 'rgba(42,24,16,0.18)' }
  const selectClass = 'w-full bg-[#EDE8DF] border px-3 py-3 focus:outline-none transition-colors appearance-none font-sans'
  const labelClass = 'block font-sans text-xs mb-1.5 uppercase tracking-wide'
  const labelStyle = { color: 'rgba(42,24,16,0.55)' }

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
          <label htmlFor="firstName" className={labelClass} style={labelStyle}>
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
            className={inputClass}
            style={inputStyle}
          />
        </div>

        {/* Last name */}
        <div>
          <label htmlFor="lastName" className={labelClass} style={labelStyle}>
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
            className={inputClass}
            style={inputStyle}
          />
        </div>

        {/* Date of birth */}
        <div>
          <label className={labelClass} style={labelStyle}>
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
                className={selectClass}
                style={inputStyle}
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
                className={selectClass}
                style={inputStyle}
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
                className={selectClass}
                style={inputStyle}
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
            <p className="font-sans text-xs mt-1 ml-7" style={{ color: 'rgba(42,24,16,0.40)' }}>
              Required — we sell alcohol and are legally required to verify your age.
            </p>
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
          disabled={loading || !firstName.trim() || !lastName.trim() || !dobDay || !dobMonth || !dobYear}
          className="w-full bg-rio text-cream font-sans font-medium px-4 py-3 transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? 'Saving…' : 'Continue →'}
        </button>
      </form>
    </div>
  )
}
