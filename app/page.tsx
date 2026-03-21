'use client'

import { useState, useEffect, useRef, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// ─── Noise texture URL ─────────────────────────────────────────────────────────

const NOISE_BG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`

// ─── Scroll fade-up animation component ───────────────────────────────────────

function FadeUp({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [animated, setAnimated] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Respect reduced motion preference — skip animation entirely
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    setAnimated(true)

    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.08 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={className}
      style={
        animated
          ? {
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0)' : 'translateY(20px)',
              transition: `opacity 500ms ease-out ${delay}ms, transform 500ms ease-out ${delay}ms`,
            }
          : {}
      }
    >
      {children}
    </div>
  )
}

// ─── SVG Line Art ──────────────────────────────────────────────────────────────

function CellarDoorSvg() {
  return (
    <svg
      viewBox="0 0 1000 800"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="absolute inset-0 w-full h-full hidden sm:block"
      style={{ opacity: 0.18 }}
      aria-hidden="true"
    >
      {/* ── Outer door frame ──────────────────────────────────────────── */}
      <path
        d="M 268 782 L 268 310 A 232 232 0 0 1 732 310 L 732 782 Z"
        stroke="#F0E6DC"
        strokeWidth="2.5"
      />
      {/* ── Inner panel border ─────────────────────────────────────────── */}
      <path
        d="M 286 770 L 286 310 A 214 214 0 0 1 714 310 L 714 770 Z"
        stroke="#F0E6DC"
        strokeWidth="1"
      />
      {/* ── Iron ring handle ───────────────────────────────────────────── */}
      <circle cx="666" cy="546" r="30" stroke="#F0E6DC" strokeWidth="1.5" />
      <circle cx="666" cy="546" r="16" stroke="#F0E6DC" strokeWidth="1.5" />
    </svg>
  )
}

function WineBottleSvg() {
  return (
    <svg
      viewBox="0 0 100 290"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ height: '400px', width: 'auto', opacity: 0.75 }}
      className="mx-auto"
      aria-hidden="true"
    >
      <path
        d="M 44 20 Q 44 14 50 14 Q 56 14 56 20 L 56 36 Q 58 40 58 48 L 57 82 Q 68 96 72 118 Q 80 138 80 162 L 80 268 Q 80 274 50 274 Q 20 274 20 268 L 20 162 Q 20 138 28 118 Q 32 96 43 82 L 42 48 Q 42 40 44 36 Z"
        stroke="#F0E6DC"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <line x1="42" y1="44" x2="58" y2="44" stroke="#F0E6DC" strokeWidth="1" opacity="0.6" />
      <line x1="23" y1="168" x2="77" y2="168" stroke="#F0E6DC" strokeWidth="0.5" opacity="0.35" />
      <line x1="23" y1="232" x2="77" y2="232" stroke="#F0E6DC" strokeWidth="0.5" opacity="0.35" />
    </svg>
  )
}

// ─── Wave divider ──────────────────────────────────────────────────────────────

function WaveDivider({
  from,
  to,
  flip = false,
}: {
  from: string
  to: string
  flip?: boolean
}) {
  return (
    <svg
      viewBox="0 0 1440 56"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="none"
      style={{
        display: 'block',
        width: '100%',
        height: '56px',
        background: from,
        transform: flip ? 'scaleX(-1)' : undefined,
      }}
      aria-hidden="true"
    >
      <path
        d="M0,28 C240,56 480,0 720,28 C960,56 1200,0 1440,28 L1440,56 L0,56 Z"
        fill={to}
      />
    </svg>
  )
}

// ─── Section divider ───────────────────────────────────────────────────────────

function SectionDivider() {
  return (
    <div className="flex items-center justify-center gap-3">
      <span
        aria-hidden="true"
        style={{ color: 'rgba(201,133,29,0.5)', fontSize: '7px', lineHeight: 1 }}
      >
        ◆
      </span>
      <div style={{ width: '120px', height: '1px', background: 'rgba(201,133,29,0.4)' }} />
      <span
        aria-hidden="true"
        style={{ color: 'rgba(201,133,29,0.5)', fontSize: '7px', lineHeight: 1 }}
      >
        ◆
      </span>
    </div>
  )
}

// ─── Hero form ─────────────────────────────────────────────────────────────────

function buildPhone(raw: string): string {
  const stripped = raw.replace(/[\s\-]/g, '')
  if (stripped.startsWith('0')) return '+44' + stripped.slice(1)
  return '+44' + stripped
}

function HeroSignupForm() {
  const [phone, setPhone] = useState('')
  const router = useRouter()

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (phone.trim()) {
      router.push(`/join?phone=${encodeURIComponent(phone.trim())}`)
    } else {
      router.push('/join')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 mx-auto mb-4" style={{ maxWidth: '300px' }}>
      <div
        className="flex items-stretch transition-colors"
        style={{ border: '1px solid rgba(201,133,29,0.55)', boxShadow: '0 0 0 3px rgba(201,133,29,0.07)' }}
      >
        <span
          className="flex items-center px-3 font-sans text-base text-cream/60 border-r select-none bg-transparent whitespace-nowrap"
          style={{ borderColor: 'rgba(201,133,29,0.3)' }}
        >
          +44
        </span>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="7700 900000"
          className="flex-1 bg-transparent px-4 py-3 text-cream placeholder-cream/40 focus:outline-none font-sans text-base"
        />
      </div>
      <button
        type="submit"
        className="group w-full bg-rio text-cream px-6 py-3 font-sans font-medium text-base transition-all duration-150 hover:bg-[#7d1526]"
      >
        Join the Club{' '}
        <span className="inline-block transition-transform duration-150 group-hover:translate-x-[3px]">
          →
        </span>
      </button>
    </form>
  )
}

// ─── Interactive How It Works ──────────────────────────────────────────────────

function HowItWorks() {
  const [active, setActive] = useState(0)

  const steps = [
    {
      num: '01',
      heading: 'We text you',
      body: 'Twice a week, Daniel picks something remarkable and texts it to you. A skin-contact Slovenian, a Texan Tempranillo, a Burgundy that shouldn\'t be this affordable.',
      messages: [
        { from: 'daniel', text: 'Morning. Just landed a beautiful Primitivo from Puglia — 2018, proper Sunday drinking. £14/bottle. How many?' },
      ],
    },
    {
      num: '02',
      heading: 'You reply',
      body: 'Text back how many bottles you want. We confirm, charge your card, and that\'s it. No login, no basket, no faff.',
      messages: [
        { from: 'daniel', text: 'Morning. Just landed a beautiful Primitivo from Puglia — 2018, proper Sunday drinking. £14/bottle. How many?' },
        { from: 'you', text: '3 please' },
        { from: 'daniel', text: 'Sorted — 3 × Primitivo at £14 = £42. Card charged. Added to your cellar.' },
      ],
    },
    {
      num: '03',
      heading: 'We store it, you collect',
      body: 'Your bottles go straight into your cellar account. When you\'ve got 12, we ship the whole case to your door for free.',
      messages: [
        { from: 'you', text: 'How many bottles do I have?' },
        { from: 'daniel', text: 'You\'ve got 9 bottles stored. 3 more until we ship your case for free.' },
        { from: 'you', text: 'What have I got so far?' },
        { from: 'daniel', text: '2 × Primitivo · 3 × Grüner Veltliner · 2 × Mencia · 2 × Xinomavro. A very good case.' },
      ],
    },
  ]

  return (
    <div className="relative z-10 max-w-5xl mx-auto pt-16">
      {/* Section label */}
      <p className="font-serif text-xl md:text-2xl uppercase tracking-[0.2em] text-gold text-center mb-14">
        How It Works
      </p>

      <div className="flex flex-col md:flex-row gap-10 md:gap-12 items-start">

        {/* Left: step tabs — 50% */}
        <div className="flex-1 flex flex-col gap-2">
          {steps.map((step, i) => (
            <button
              key={step.num}
              onClick={() => setActive(i)}
              className="text-left px-5 py-4 transition-all duration-200 rounded-sm"
              style={{
                background: active === i ? 'rgba(201,133,29,0.1)' : 'transparent',
                borderLeft: `3px solid ${active === i ? '#C9851D' : 'rgba(240,230,220,0.1)'}`,
              }}
            >
              <span
                className="block font-serif text-xs tracking-[0.2em] mb-1 transition-colors"
                style={{ color: active === i ? '#C9851D' : 'rgba(240,230,220,0.4)' }}
              >
                {step.num}
              </span>
              <span
                className="block font-serif text-xl transition-colors"
                style={{ color: active === i ? '#F0E6DC' : 'rgba(240,230,220,0.55)' }}
              >
                {step.heading}
              </span>
              {active === i && (
                <p className="font-sans text-sm leading-relaxed mt-2" style={{ color: 'rgba(240,230,220,0.6)' }}>
                  {step.body}
                </p>
              )}
            </button>
          ))}
        </div>

        {/* Right: phone mockup — 50% */}
        <div className="flex-1 flex justify-center">
          {/* Phone shell */}
          <div
            className="w-full max-w-[300px]"
            style={{
              background: '#1C1C1E',
              borderRadius: '2.5rem',
              border: '2px solid rgba(255,255,255,0.12)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)',
              overflow: 'hidden',
            }}
          >
            {/* Status bar */}
            <div className="flex items-center justify-between px-6 pt-4 pb-1">
              <span className="font-sans text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>9:41</span>
              <div className="flex items-center gap-1.5">
                {/* Signal bars */}
                <svg width="17" height="12" viewBox="0 0 17 12" fill="none" aria-hidden="true">
                  <rect x="0" y="7" width="3" height="5" rx="0.5" fill="rgba(255,255,255,0.9)"/>
                  <rect x="4.5" y="4.5" width="3" height="7.5" rx="0.5" fill="rgba(255,255,255,0.9)"/>
                  <rect x="9" y="2" width="3" height="10" rx="0.5" fill="rgba(255,255,255,0.9)"/>
                  <rect x="13.5" y="0" width="3" height="12" rx="0.5" fill="rgba(255,255,255,0.35)"/>
                </svg>
                {/* Battery */}
                <svg width="25" height="12" viewBox="0 0 25 12" fill="none" aria-hidden="true">
                  <rect x="0.5" y="0.5" width="21" height="11" rx="3" stroke="rgba(255,255,255,0.4)" strokeWidth="1"/>
                  <rect x="2" y="2" width="15" height="8" rx="1.5" fill="rgba(255,255,255,0.9)"/>
                  <path d="M22.5 4v4" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
            </div>

            {/* iMessage header */}
            <div
              className="flex flex-col items-center px-4 py-3 border-b"
              style={{ borderColor: 'rgba(255,255,255,0.08)' }}
            >
              {/* Avatar */}
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center mb-1"
                style={{ background: 'rgba(201,133,29,0.25)', border: '1px solid rgba(201,133,29,0.4)' }}
              >
                <span className="font-serif text-sm" style={{ color: '#C9851D' }}>C</span>
              </div>
              <span className="font-sans text-[13px] font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>
                The Cellar Club
              </span>
              <span className="font-sans text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                +44 7888 871161
              </span>
            </div>

            {/* Messages */}
            <div className="px-3 py-4 space-y-2 min-h-[220px]">
              {steps[active].messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.from === 'you' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className="max-w-[78%] px-3.5 py-2 font-sans text-[13px] leading-relaxed"
                    style={
                      msg.from === 'you'
                        ? {
                            background: '#0A84FF',
                            color: '#FFFFFF',
                            borderRadius: '18px 18px 4px 18px',
                          }
                        : {
                            background: '#2C2C2E',
                            color: 'rgba(255,255,255,0.88)',
                            borderRadius: '18px 18px 18px 4px',
                          }
                    }
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>

            {/* iMessage input bar */}
            <div
              className="flex items-center gap-2 px-3 pb-5 pt-2 border-t"
              style={{ borderColor: 'rgba(255,255,255,0.08)' }}
            >
              <div
                className="flex-1 flex items-center px-3 py-2"
                style={{
                  background: 'rgba(255,255,255,0.07)',
                  borderRadius: '18px',
                  border: '1px solid rgba(255,255,255,0.12)',
                }}
              >
                <span className="font-sans text-[13px]" style={{ color: 'rgba(255,255,255,0.3)' }}>iMessage</span>
              </div>
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                style={{ background: '#0A84FF' }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M6 10V2M6 2L2 6M6 2L10 6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

// ─── Landing page ──────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <div className="bg-maroon text-cream">

      {/* ── Section 1: Hero ── */}
      <section
        className="relative min-h-screen flex flex-col items-center justify-center px-6 py-24 overflow-hidden bg-maroon"
        style={{
          backgroundImage: 'url(/images/hero.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Dark scrim — keeps text legible over photo */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'rgba(10,3,6,0.62)' }}
          aria-hidden="true"
        />

        <CellarDoorSvg />

        {/* Noise overlay */}
        <div
          className="absolute inset-0 pointer-events-none select-none"
          style={{ opacity: 0.03, backgroundImage: NOISE_BG, backgroundRepeat: 'repeat' }}
          aria-hidden="true"
        />

        <div className="relative z-10 text-center max-w-2xl mx-auto">
          {/* Brand mark */}
          <div className="mb-10">
            <span className="block font-serif text-sm uppercase tracking-[0.3em] text-cream/80">the</span>
            <span className="block font-serif text-7xl md:text-8xl uppercase tracking-[0.08em] leading-none text-cream">CELLAR</span>
            <span className="block font-serif text-sm uppercase tracking-[0.3em] text-cream/80">club</span>
          </div>

          {/* Divider */}
          <div className="w-16 h-px bg-gold mx-auto mb-10 opacity-60" />

          {/* Subheading */}
          <div className="mb-10 max-w-[600px] mx-auto">
            <p className="font-serif text-cream/85 text-[1.35rem] leading-snug text-center mb-5">
              Sommelier selected wines at insider rates.
            </p>
            <div className="space-y-2 text-center">
              {[
                'We text you twice a week.',
                'Reply how many you want.',
                'We store it until you fill a case.',
                'Then ship it to you for free.',
              ].map((line) => (
                <p key={line} className="font-serif text-cream/55 text-[1.1rem] leading-snug">
                  {line}
                </p>
              ))}
            </div>
          </div>

          {/* Sign-up form */}
          <HeroSignupForm />

          <p className="font-sans text-cream/35 text-xs mt-2">
            Already a member?{' '}
            <Link href="/portal" className="underline underline-offset-2 text-cream/45 hover:text-cream/70 transition-colors">
              Log in here
            </Link>
          </p>
        </div>
      </section>

      {/* Hero → How It Works */}
      <WaveDivider from="#120608" to="#1E0B10" />

      {/* ── Section 2: How It Works ── */}
      <section className="relative bg-maroon-dark px-6 pb-24 overflow-hidden">
        {/* Noise overlay */}
        <div
          className="absolute inset-0 pointer-events-none select-none"
          style={{ opacity: 0.03, backgroundImage: NOISE_BG, backgroundRepeat: 'repeat' }}
          aria-hidden="true"
        />

        <HowItWorks />
      </section>

      {/* How It Works → Membership */}
      <WaveDivider from="#1E0B10" to="#120608" flip />

      {/* ── Section 3: Membership ── */}
      <section className="relative bg-maroon px-6 pb-28 overflow-hidden">
        {/* Noise overlay */}
        <div
          className="absolute inset-0 pointer-events-none select-none"
          style={{ opacity: 0.03, backgroundImage: NOISE_BG, backgroundRepeat: 'repeat' }}
          aria-hidden="true"
        />

        <div className="relative z-10 max-w-3xl mx-auto">
          <FadeUp>
            <p className="font-serif text-xl md:text-2xl uppercase tracking-[0.2em] text-gold text-center mb-4 pt-16">
              Membership
            </p>
            <p className="font-sans text-cream/45 text-sm text-center mb-14 tracking-wide">
              Everything you get, just for joining.
            </p>
          </FadeUp>

          {/* Wine-list style — no boxes */}
          <div>
            {[
              {
                heading: 'Two drops a week',
                body: 'Monday and Thursday. Hand-picked by Daniel — a skin-contact Slovenian, a Texan Tempranillo, whatever\'s worth drinking right now.',
              },
              {
                heading: 'Free storage',
                body: 'We hold your bottles at Crush until you\'ve got 12. No extra cost, no decisions, no trips to the post office.',
              },
              {
                heading: 'Free shipping at 12',
                body: 'Once your case is full we ship the whole thing to your door. Palatine members get free delivery at 6.',
              },
              {
                heading: 'Better prices',
                body: 'We buy in volume across both wine bars. You get the benefit — usually 15–25% below high street.',
              },
              {
                heading: 'Wine concierge',
                body: 'Got a question, need a gift, want something we haven\'t featured? Text Daniel. He\'ll sort it.',
              },
              {
                heading: 'Request a drop',
                body: 'Name a wine or region and we\'ll try to run it. If enough members are in, it goes out as a members-only drop.',
              },
            ].map(({ heading, body }, i) => (
              <FadeUp key={heading} delay={i * 60}>
                <div
                  className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-8 py-6"
                  style={{ borderBottom: '1px solid rgba(240,230,220,0.08)' }}
                >
                  <h3 className="font-serif text-cream text-lg sm:text-xl shrink-0 sm:w-52">
                    {heading}
                  </h3>
                  <p className="font-sans text-cream/55 text-sm leading-relaxed">
                    {body}
                  </p>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* Membership → Pull quote */}
      <WaveDivider from="#120608" to="#1E0B10" />

      {/* ── Pull quote ── */}
      <section className="bg-maroon-dark px-6 py-28 overflow-hidden">
        <FadeUp>
          <div className="max-w-3xl mx-auto text-center relative">
            <span
              className="font-serif select-none pointer-events-none absolute"
              aria-hidden="true"
              style={{
                fontSize: '28rem',
                lineHeight: 0.8,
                color: '#F0E6DC',
                opacity: 0.045,
                top: '-3rem',
                left: '50%',
                transform: 'translateX(-52%)',
                fontStyle: 'normal',
                zIndex: 0,
              }}
            >
              &ldquo;
            </span>

            <blockquote className="relative" style={{ zIndex: 1 }}>
              <p
                className="font-serif text-cream/90 leading-[1.25]"
                style={{ fontSize: 'clamp(1.6rem, 3.5vw, 2.5rem)' }}
              >
                Wines you won&apos;t find on any shelf, at prices that feel like a secret.
              </p>
              <footer className="mt-10 space-y-1.5">
                <p className="font-sans text-cream/35 text-[0.7rem] tracking-[0.25em] uppercase">
                  The Cellar Club
                </p>
                <p className="font-serif text-cream/30 text-sm italic">
                  Not recommended for anyone who was happy with their wine spend.
                </p>
              </footer>
            </blockquote>
          </div>
        </FadeUp>
      </section>

      {/* Pull quote and Story share maroon-dark — no divider needed */}

      {/* ── Section 4: The Story ── */}
      <section className="relative bg-maroon-dark px-6 pb-24 overflow-hidden">
        {/* Noise overlay */}
        <div
          className="absolute inset-0 pointer-events-none select-none"
          style={{ opacity: 0.03, backgroundImage: NOISE_BG, backgroundRepeat: 'repeat' }}
          aria-hidden="true"
        />

        <div className="relative z-10 max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            {/* Text column */}
            <div>
              <FadeUp>
                <p className="font-serif text-xl md:text-2xl uppercase tracking-[0.2em] text-gold mb-8 pt-20">
                  Our Story
                </p>
              </FadeUp>

              <div className="space-y-5 font-serif text-cream/75 text-lg leading-relaxed">
                <FadeUp delay={60}>
                  <p>
                    We&apos;re Craig and Daniel. We opened Crush wine bar in Durham a couple years ago and just got the keys to a second one — with a cellar big enough to warrant its own membership.
                  </p>
                </FadeUp>
                <FadeUp delay={120}>
                  <p>
                    Daniel is fab with wine. Twenty years in the industry, time at the 2-star Raby Hunt, and yet he still manages to talk about wine without coming across like a tw**.
                  </p>
                </FadeUp>
                <FadeUp delay={180}>
                  <p>
                    The Cellar Club is what happens when a great sommelier has lots of storage space, direct import relationships, and a group of people who trust him to find something worth drinking.
                  </p>
                </FadeUp>
              </div>

              <FadeUp delay={240}>
                <div className="mt-12 text-center md:text-left">
                  <p className="font-serif text-cream/60 text-lg mb-5">
                    Ready to fill your cellar?
                  </p>
                  <Link
                    href="/join"
                    className="group inline-block bg-rio text-cream font-sans font-medium px-8 py-3.5 transition-all duration-150 hover:bg-[#7d1526]"
                  >
                    Join the Club{' '}
                    <span className="inline-block transition-transform duration-150 group-hover:translate-x-[3px]">
                      →
                    </span>
                  </Link>
                </div>
              </FadeUp>
            </div>

            {/* Bottle illustration */}
            <FadeUp className="flex items-center justify-center">
              <WineBottleSvg />
            </FadeUp>
          </div>
        </div>
      </section>

      {/* Story → Levels */}
      <WaveDivider from="#1E0B10" to="#120608" flip />

      {/* ── Section 5: The Levels ── */}
      <section
        className="relative px-6 pb-24 overflow-hidden"
        style={{
          backgroundImage: 'url(/images/levels.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundColor: '#120608',
        }}
      >
        {/* Dark scrim */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'rgba(8,2,4,0.78)' }}
          aria-hidden="true"
        />
        {/* Noise overlay */}
        <div
          className="absolute inset-0 pointer-events-none select-none"
          style={{ opacity: 0.03, backgroundImage: NOISE_BG, backgroundRepeat: 'repeat' }}
          aria-hidden="true"
        />

        <div className="relative z-10 max-w-5xl mx-auto">
          <FadeUp>
            <p className="font-serif text-xl md:text-2xl uppercase tracking-[0.2em] text-gold mb-4 text-center pt-20">
              The Levels
            </p>
            <p className="font-sans text-cream/55 text-sm text-center max-w-md mx-auto mb-14">
              The more you spend, the more you unlock. Tiers are assessed annually on your rolling 12-month spend.
            </p>
          </FadeUp>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Bailey */}
            <FadeUp delay={0}>
              <div
                className="relative overflow-hidden p-8 h-full"
                style={{
                  background: 'rgba(30,11,16,0.85)',
                  border: '1px solid rgba(240,230,220,0.12)',
                  borderTop: '3px solid #9B1B30',
                  backdropFilter: 'blur(8px)',
                }}
              >
                <p className="font-serif text-xs uppercase tracking-[0.25em] text-cream/50 mb-1">Entry · Free to join</p>
                <h3 className="font-serif text-2xl text-cream mb-5">Bailey</h3>
                <ul className="space-y-3 font-sans text-sm text-cream/65 leading-relaxed">
                  <li>Two weekly drops via SMS</li>
                  <li>Free delivery at 12 bottles</li>
                  <li>Unlimited wine request service</li>
                  <li>Wine concierge (up to 2 requests/month)</li>
                </ul>
                <p className="font-sans text-xs text-cream/30 mt-6">Free to join.</p>
              </div>
            </FadeUp>

            {/* Elvet */}
            <FadeUp delay={80}>
              <div
                className="relative overflow-hidden p-8 h-full"
                style={{
                  background: 'rgba(30,11,16,0.85)',
                  border: '1px solid rgba(201,133,29,0.25)',
                  borderTop: '3px solid #C9851D',
                  backdropFilter: 'blur(8px)',
                }}
              >
                <p className="font-serif text-xs uppercase tracking-[0.25em] text-gold/70 mb-1">Unlocks at £500</p>
                <h3 className="font-serif text-2xl text-cream mb-5">Elvet</h3>
                <ul className="space-y-3 font-sans text-sm text-cream/65 leading-relaxed">
                  <li>Everything in Bailey</li>
                  <li>Up to 5 wine concierge requests/month</li>
                  <li>2 × tickets to wine tastings (Durham or London)</li>
                  <li>5% discount on all orders</li>
                </ul>
                <p className="font-sans text-xs text-gold/50 mt-6">Unlocks automatically when you hit £500 in a rolling 12 months.</p>
              </div>
            </FadeUp>

            {/* Palatine */}
            <FadeUp delay={160}>
              <div
                className="relative overflow-hidden p-8 h-full md:-translate-y-2"
                style={{
                  background: 'rgba(30,11,16,0.85)',
                  border: '1px solid rgba(201,133,29,0.4)',
                  borderTop: '3px solid #C9851D',
                  boxShadow: '0 0 40px rgba(201,133,29,0.1)',
                  backdropFilter: 'blur(8px)',
                }}
              >
                <p className="font-serif text-xs uppercase tracking-[0.25em] text-gold/70 mb-1">Unlocks at £1,000</p>
                <h3 className="font-serif text-2xl text-cream mb-5">Palatine</h3>
                <ul className="space-y-3 font-sans text-sm text-cream/65 leading-relaxed">
                  <li>Everything in Elvet</li>
                  <li>Free delivery at 6 bottles</li>
                  <li>10% discount on all orders</li>
                  <li>4 × tickets to wine tastings (Durham or London)</li>
                  <li>First look — 2 hours before everyone else</li>
                </ul>
                <p className="font-sans text-xs text-gold/50 mt-6">Unlocks at £1,000. Free shipping drops to 6 bottles.</p>
              </div>
            </FadeUp>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-maroon border-t border-cream/10 px-6 py-10">
        <div className="max-w-2xl mx-auto text-center space-y-2">
          <p className="font-sans text-cream/35 text-xs">
            CD WINES LTD &middot; Company No. 15796479
          </p>
          <p className="font-sans text-cream/35 text-xs">
            Licensed under the Licensing Act 2003 &middot; Licence No. DCCC/PLA0856
          </p>
          <p className="font-sans text-cream/35 text-xs">
            We do not sell alcohol to anyone under 18. Please drink responsibly.
          </p>
          <div className="flex justify-center gap-6 pt-2">
            <Link href="/privacy" className="font-sans text-cream/40 hover:text-cream/70 text-xs underline underline-offset-2 transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="font-sans text-cream/40 hover:text-cream/70 text-xs underline underline-offset-2 transition-colors">
              Terms &amp; Conditions
            </Link>
          </div>
        </div>
      </footer>

    </div>
  )
}
