'use client'

// Deliberately NOT shared with app/page.tsx's SignupForm — this is a full
// duplicate so the homepage's signup flow can never be affected by changes
// made here (and vice versa). Same behaviour: capture + forward utm_*/gclid,
// push straight to /join with the phone number pre-filled.

import { useState, useEffect, FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

const TEXT_DARK = '#1C0E09'
const TEXT_FAINT = 'rgba(42,24,16,0.40)'
const ACCENT = '#9B1B30'

const TRACKING_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid'] as const

export function DropSignupForm({ buttonText = 'GET THE DROP' }: { buttonText?: string }) {
  const [phone, setPhone] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const tracking: Record<string, string> = {}
    for (const key of TRACKING_KEYS) {
      const val = searchParams.get(key)
      if (val) tracking[key] = val
    }
    if (Object.keys(tracking).length > 0) {
      try { sessionStorage.setItem('cellar_utm', JSON.stringify(tracking)) } catch {}
    }
  }, [searchParams])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trackingPart = TRACKING_KEYS
      .filter((k) => searchParams.get(k))
      .map((k) => `${k}=${encodeURIComponent(searchParams.get(k)!)}`)
      .join('&')
    const phonePart = phone.trim() ? `phone=${encodeURIComponent(phone.trim())}` : ''
    const qs = [phonePart, trackingPart].filter(Boolean).join('&')
    router.push(qs ? `/join?${qs}` : '/join')
  }

  return (
    <div className="w-full max-w-lg">
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
        <div
          className="flex-1 flex items-stretch transition-colors"
          style={{ border: '1.5px solid rgba(155,27,48,0.38)' }}
        >
          <span
            className="flex items-center px-3 font-sans select-none whitespace-nowrap border-r bg-transparent"
            style={{ color: TEXT_FAINT, borderColor: 'rgba(42,24,16,0.12)', fontSize: 11 }}
          >
            +44
          </span>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="YOUR MOBILE NUMBER"
            className="flex-1 bg-transparent px-4 py-3.5 focus:outline-none"
            style={{
              color: TEXT_DARK,
              fontSize: phone ? 14 : 11,
              letterSpacing: phone ? '0.01em' : '0.22em',
              textTransform: phone ? 'none' : 'uppercase',
              fontFamily: 'var(--font-spectral)',
            }}
          />
        </div>
        <button
          type="submit"
          className="group whitespace-nowrap font-sans font-medium px-5 py-3.5 transition-all duration-150 hover:opacity-90 active:opacity-75"
          style={{ background: ACCENT, color: '#F0E6DC', fontSize: 11, letterSpacing: '0.22em' }}
        >
          <span className="uppercase">{buttonText}</span>
          {' '}
          <span className="inline-block transition-transform duration-150 group-hover:translate-x-[3px]">→</span>
        </button>
      </form>
      <p className="font-serif text-sm mt-3" style={{ color: TEXT_FAINT }}>
        Already a member?{' '}
        <a href="/portal" className="underline underline-offset-2 transition-opacity hover:opacity-70" style={{ color: 'rgba(42,24,16,0.52)' }}>
          Log in
        </a>
      </p>
    </div>
  )
}
