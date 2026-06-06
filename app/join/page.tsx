'use client'

import { useState, useEffect, useRef, FormEvent, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const

function buildPhone(raw: string): string {
  let s = raw.replace(/[\s\-]/g, '')
  if (s.startsWith('+44')) s = s.slice(3)
  else if (s.startsWith('44')) s = s.slice(2)
  else if (s.startsWith('0')) s = s.slice(1)
  s = s.replace(/^\+/, '')
  return '+44' + s
}

function JoinPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const phoneParam = searchParams.get('phone') ?? ''
  const [phone, setPhone] = useState(phoneParam)
  const [error, setError] = useState('')
  const [alreadySignedUp, setAlreadySignedUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [autoSubmitting, setAutoSubmitting] = useState(!!phoneParam)

  // Keep a ref to the latest searchParams so sendCode always reads current
  // values even when called from the stale-closure useEffect below.
  const searchParamsRef = useRef(searchParams)
  useEffect(() => { searchParamsRef.current = searchParams }, [searchParams])

  // Also persist UTMs to sessionStorage on this page in case the user
  // landed here directly (e.g. ad final URL = /join?utm_source=...).
  useEffect(() => {
    const utms: Record<string, string> = {}
    for (const key of UTM_KEYS) {
      const val = searchParams.get(key)
      if (val) utms[key] = val
    }
    if (Object.keys(utms).length > 0) {
      try { sessionStorage.setItem('cellar_utm', JSON.stringify(utms)) } catch {}
    }
  }, [searchParams])

  async function sendCode(e164: string) {
    setError('')
    setAlreadySignedUp(false)
    setLoading(true)

    // Read UTMs at call time (not from stale closure).
    // 1. Try current URL params via ref.
    // 2. Fall back to sessionStorage set on homepage or a previous /join visit.
    const sp = searchParamsRef.current
    let utmSource = sp.get('utm_source') ?? undefined
    let utmMedium = sp.get('utm_medium') ?? undefined
    let utmCampaign = sp.get('utm_campaign') ?? undefined
    let utmTerm = sp.get('utm_term') ?? undefined
    let utmContent = sp.get('utm_content') ?? undefined

    if (!utmSource && !utmMedium && !utmCampaign) {
      try {
        const stored = sessionStorage.getItem('cellar_utm')
        if (stored) {
          const p = JSON.parse(stored) as Record<string, string>
          utmSource   = p.utm_source   || undefined
          utmMedium   = p.utm_medium   || undefined
          utmCampaign = p.utm_campaign || undefined
          utmTerm     = p.utm_term     || undefined
          utmContent  = p.utm_content  || undefined
        }
      } catch {}
    }

    try {
      const res = await fetch('/api/signup/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: e164,
          utmSource,
          utmMedium,
          utmCampaign,
          utmTerm,
          utmContent,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.error === 'looks_like_already_signed_up') {
          setAlreadySignedUp(true)
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
      setAutoSubmitting(false)
    }
  }

  useEffect(() => {
    if (phoneParam) {
      sendCode(buildPhone(phoneParam))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    await sendCode(buildPhone(phone))
  }

  if (autoSubmitting) {
    return (
      <div className="bg-[#F5EFE6] border p-8" style={{ borderColor: 'rgba(42,24,16,0.12)' }}>
        <p className="font-sans text-sm" style={{ color: 'rgba(42,24,16,0.55)' }}>Sending code…</p>
      </div>
    )
  }

  return (
    <div className="bg-[#F5EFE6] border p-8" style={{ borderColor: 'rgba(42,24,16,0.12)' }}>
      <div className="mb-6">
        <p className="font-serif text-xs uppercase tracking-[0.3em] mb-1" style={{ color: '#9B1B30' }}>
          Step 1 of 3
        </p>
        <h2 className="font-serif text-2xl" style={{ color: '#1C0E09' }}>Your mobile number</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="phone" className="block font-sans text-xs mb-1.5 uppercase tracking-wide" style={{ color: 'rgba(42,24,16,0.55)' }}>
            UK mobile number
          </label>
          <div className="flex items-stretch transition-colors" style={{ border: '1.5px solid rgba(155,27,48,0.38)' }}>
            <span className="flex items-center px-3 font-sans text-base border-r select-none bg-transparent whitespace-nowrap" style={{ color: 'rgba(42,24,16,0.60)', borderColor: 'rgba(155,27,48,0.25)' }}>
              +44
            </span>
            <input
              id="phone"
              type="tel"
              autoComplete="tel"
              placeholder="7700 900000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              className="flex-1 bg-[#EDE8DF] px-4 py-3 focus:outline-none font-sans text-base"
              style={{ color: '#1C0E09' }}
            />
          </div>
        </div>

        {alreadySignedUp && (
          <p className="font-sans text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
            Looks like you&apos;re already signed up.{' '}
            <Link href="/portal" className="underline underline-offset-2 hover:opacity-80 transition-opacity" style={{ color: '#9B1B30' }}>
              Log in here →
            </Link>
          </p>
        )}

        {error && (
          <p className="font-sans text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !phone.trim()}
          className="w-full bg-rio text-cream font-sans font-medium px-4 py-3 transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? 'Sending code…' : 'Send verification code'}
        </button>
      </form>
    </div>
  )
}

export default function JoinPage() {
  return (
    <Suspense>
      <JoinPageInner />
    </Suspense>
  )
}
