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
      className="absolute inset-0 w-full h-full hidden md:block"
      style={{ opacity: 0.18 }}
      aria-hidden="true"
    >
      {/* ── Outer door frame ──────────────────────────────────────────── */}
      {/* Semicircular arch: centre (500,310), radius 232, crown at y=78 */}
      <path
        d="M 268 782 L 268 310 A 232 232 0 0 1 732 310 L 732 782 Z"
        stroke="#F0E6DC"
        strokeWidth="2.5"
      />

      {/* ── Inner panel border (inset ~18 px, concentric arc) ─────────── */}
      <path
        d="M 286 770 L 286 310 A 214 214 0 0 1 714 310 L 714 770 Z"
        stroke="#F0E6DC"
        strokeWidth="1"
      />

      {/* ── Iron ring handle (right side, mid-height ≈ y=546) ─────────── */}
      <circle cx="666" cy="546" r="30" stroke="#F0E6DC" strokeWidth="1.5" />
      <circle cx="666" cy="546" r="16" stroke="#F0E6DC" strokeWidth="1.5" />
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 mb-4">
      <div className="flex items-stretch border border-cream/30 focus-within:border-cream/60 transition-colors">
        <span className="flex items-center px-3 font-sans text-base text-cream/60 border-r border-cream/20 select-none bg-transparent whitespace-nowrap">
          +44
        </span>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="7700 900000"
          className="flex-1 bg-transparent px-4 py-3 text-cream placeholder-cream/30 focus:outline-none font-sans text-base"
        />
      </div>
      <button
        type="submit"
        className="group w-full flex items-center justify-center bg-rio text-cream px-6 py-3 font-sans font-medium text-base transition-all duration-150 hover:bg-[#7d1526]"
      >
        Join the Club{' '}
        <span className="inline-block ml-1 transition-transform duration-150 group-hover:translate-x-[3px]">
          →
        </span>
      </button>
    </form>
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
        <CellarDoorSvg />

        {/* Dark scrim — keeps text legible over photo */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'rgba(10,3,6,0.58)' }}
          aria-hidden="true"
        />

        {/* Noise overlay */}
        <div
          className="absolute inset-0 pointer-events-none select-none"
          style={{ opacity: 0.05, backgroundImage: NOISE_BG, backgroundRepeat: 'repeat' }}
          aria-hidden="true"
        />

        <div className="relative z-10 max-w-6xl mx-auto w-full">
          <div className="flex flex-col md:flex-row md:items-center gap-10 md:gap-20">

            {/* Left column — brand mark + subtext */}
            <div className="flex-1 text-center md:text-left">
              {/* Brand mark */}
              <div className="mb-10">
                <span className="block font-serif text-sm uppercase tracking-[0.3em] text-cream/80 md:text-left">the</span>
                <span className="block font-serif text-8xl md:text-[9rem] lg:text-[11rem] uppercase tracking-[0.08em] leading-none text-cream">CELLAR</span>
                <span className="block font-serif text-sm uppercase tracking-[0.3em] text-cream/80 md:text-left">club</span>
              </div>

              {/* Divider */}
              <div className="w-16 h-px bg-gold mx-auto md:mx-0 mb-10 opacity-60" />

              {/* Subheading */}
              <div className="max-w-[600px] mx-auto md:mx-0">
                <p className="font-serif text-cream/85 text-[1.35rem] leading-snug text-center md:text-left mb-5">
                  Sommelier selected wines at insider rates.
                </p>
                <div className="space-y-2 text-center md:text-left">
                  {[
                    'We text you twice a week.',
                    'Reply how many you want.',
                    'We store it until you fill a case.',
                    'Then ship it to you for free.',
                  ].map((line) => (
                    <p key={line} className="font-serif text-cream/68 leading-snug" style={{ fontSize: '1.15rem' }}>
                      {line}
                    </p>
                  ))}
                </div>
              </div>
            </div>

            {/* Right column — form */}
            <div className="md:w-[400px] shrink-0">
              <HeroSignupForm />
              <p className="font-sans text-cream/35 text-xs mt-2 text-center md:text-left">
                Already a member?{' '}
                <Link href="/portal" className="underline underline-offset-2 text-cream/45 hover:text-cream/70 transition-colors">
                  Log in here
                </Link>
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ── Divider ── */}
      <div className="bg-maroon-dark py-10">
        <SectionDivider />
      </div>

      {/* ── Section 2: How It Works ── */}
      <section className="relative bg-maroon-dark px-6 pb-32 overflow-hidden">
        {/* Noise overlay */}
        <div
          className="absolute inset-0 pointer-events-none select-none"
          style={{ opacity: 0.05, backgroundImage: NOISE_BG, backgroundRepeat: 'repeat' }}
          aria-hidden="true"
        />

        <div className="relative z-10 max-w-5xl mx-auto">
          {/* Section label */}
          <FadeUp>
            <p className="font-serif text-base uppercase tracking-[0.2em] text-gold text-center mb-14">
              How It Works
            </p>
          </FadeUp>

          {/* Editorial stacked steps */}
          <div>
            {[
              {
                num: '01',
                heading: 'We text you',
                body: 'Twice a week, Daniel picks something remarkable. A skin-contact Slovenian, a Texan Tempranillo, a Burgundy that shouldn\'t be this affordable. It lands in your phone.',
              },
              {
                num: '02',
                heading: 'You reply',
                body: 'Text back how many bottles you want. We\'ll confirm the total and take payment straight away. That\'s it.',
              },
              {
                num: '03',
                heading: 'We store it, you collect',
                body: 'Your bottles go straight to your cellar. When you\'ve got 12, we ship the whole case to your door. Free.',
              },
            ].map(({ num, heading, body }, i) => (
              <FadeUp key={num} delay={i * 100}>
                <div className="flex gap-8 md:gap-16 items-start py-10 border-b border-gold/10 last:border-0">
                  {/* Step number */}
                  <div className="shrink-0 w-16 md:w-24 text-right">
                    <span
                      className="font-serif text-gold leading-none select-none"
                      style={{ fontSize: 'clamp(3rem, 8vw, 5rem)', opacity: 0.35 }}
                    >
                      {num}
                    </span>
                  </div>
                  {/* Content */}
                  <div className="flex-1 pt-1 md:pt-3">
                    <h3 className="font-serif text-cream text-2xl md:text-3xl mb-4">{heading}</h3>
                    <p className="font-sans text-cream/60 text-base leading-relaxed">{body}</p>
                  </div>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ── Divider ── */}
      <div className="bg-maroon py-10">
        <SectionDivider />
      </div>

      {/* ── Section 3: The Benefits ── */}
      <section className="relative bg-maroon px-6 pb-28 overflow-hidden">
        {/* Noise overlay */}
        <div
          className="absolute inset-0 pointer-events-none select-none"
          style={{ opacity: 0.05, backgroundImage: NOISE_BG, backgroundRepeat: 'repeat' }}
          aria-hidden="true"
        />

        <div className="relative z-10 max-w-5xl mx-auto">
          <FadeUp>
            <p className="font-serif text-base uppercase tracking-[0.2em] text-gold text-center mb-14">
              Membership
            </p>
          </FadeUp>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {[
              {
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="#C9851D" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7 mb-4" aria-hidden="true">
                    <circle cx="12" cy="12" r="9"/>
                    <path d="M12 3 Q9 7.5 9 12 Q9 16.5 12 21"/>
                    <path d="M12 3 Q15 7.5 15 12 Q15 16.5 12 21"/>
                    <line x1="3" y1="12" x2="21" y2="12"/>
                  </svg>
                ),
                heading: 'Off the beaten path',
                body: 'We import directly and have relationships most retailers don\'t. Taiwan, Georgia, Texas, India: if it\'s interesting, Daniel will find it.',
              },
              {
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="#C9851D" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7 mb-4" aria-hidden="true">
                    <path d="M8 3 h8 L14.5 12 C14 14.5 12 16 12 16 C12 16 10 14.5 9.5 12 Z"/>
                    <line x1="12" y1="16" x2="12" y2="21"/>
                    <line x1="8" y1="21" x2="16" y2="21"/>
                  </svg>
                ),
                heading: 'Sommelier selected',
                body: 'Every bottle is chosen by Daniel Jonberger, 20 years in wine, including time at the 2-star Raby Hunt. You\'re basically getting what he\'s drinking himself (or wishing he was).',
              },
              {
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="#C9851D" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7 mb-4" aria-hidden="true">
                    <path d="M4 7 h11 l5 5 -5 5 H4 z"/>
                    <circle cx="17" cy="12" r="1.5" fill="#C9851D"/>
                  </svg>
                ),
                heading: 'Better prices',
                body: 'We buy in volume across our two wine bars. You get the benefit of that.',
              },
              {
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="#C9851D" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7 mb-4" aria-hidden="true">
                    <path d="M4 21 L4 12 Q4 4 12 4 Q20 4 20 12 L20 21"/>
                    <path d="M7 21 L7 13 Q7 8 12 8 Q17 8 17 13 L17 21"/>
                  </svg>
                ),
                heading: 'Free storage & shipping',
                body: 'We hold your bottles until you\'ve got 12, then ship the whole case to your door for free. No faff, no trips to the post office.',
              },
              {
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="#C9851D" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7 mb-4" aria-hidden="true">
                    <path d="M5 4 h14 a1 1 0 0 1 1 1 v10 a1 1 0 0 1 -1 1 H5 a1 1 0 0 1 -1 -1 V5 a1 1 0 0 1 1 -1 z"/>
                    <path d="M4 5 L12 12 L20 5"/>
                    <line x1="12" y1="16" x2="12" y2="21"/>
                    <path d="M8 21 h8"/>
                  </svg>
                ),
                heading: 'Wine concierge',
                body: 'Got a question? Looking for a gift? Text Daniel directly. He\'ll sort it.',
              },
              {
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="#C9851D" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7 mb-4" aria-hidden="true">
                    <circle cx="12" cy="12" r="9"/>
                    <line x1="12" y1="8" x2="12" y2="16"/>
                    <line x1="8" y1="12" x2="16" y2="12"/>
                  </svg>
                ),
                heading: 'Request a wine',
                body: 'Want something we haven\'t featured? Request it. If enough members are in, we\'ll run it as a drop, at bulk prices.',
              },
            ].map(({ icon, heading, body }, i) => (
              <FadeUp key={heading} delay={i * 80}>
                <div
                  className="relative overflow-hidden p-6 transition-all duration-200 hover:scale-[1.015] hover:bg-[#261015] h-full"
                  style={{
                    background: '#1E0B10',
                    border: '1px solid rgba(240,230,220,0.12)',
                    borderTop: '3px solid #9B1B30',
                  }}
                >
                  {icon}
                  <h3 className="font-serif text-cream text-xl mb-2">{heading}</h3>
                  <p className="font-sans text-cream/55 text-sm leading-relaxed">{body}</p>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ── Divider ── */}
      <div className="bg-maroon-dark py-10">
        <SectionDivider />
      </div>

      {/* ── Pull quote ── */}
      <section className="bg-maroon-dark px-6 py-36 overflow-hidden">
        <FadeUp>
          <div className="max-w-3xl mx-auto text-center relative">
            <blockquote>
              <p
                className="font-serif text-cream/90 leading-[1.25]"
                style={{ fontSize: 'clamp(1.9rem, 4vw, 3rem)' }}
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

      {/* ── Divider ── */}
      <div className="bg-maroon-dark py-10">
        <SectionDivider />
      </div>

      {/* ── Section 4: The Story ── */}
      <section className="relative bg-maroon-dark px-6 pb-32 overflow-hidden">
        {/* Noise overlay */}
        <div
          className="absolute inset-0 pointer-events-none select-none"
          style={{ opacity: 0.05, backgroundImage: NOISE_BG, backgroundRepeat: 'repeat' }}
          aria-hidden="true"
        />

        <div className="relative z-10 max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            {/* Text column */}
            <div>
              <FadeUp>
                <p className="font-serif text-base uppercase tracking-[0.2em] text-gold mb-8">
                  Our Story
                </p>
              </FadeUp>

              <div className="space-y-5 font-serif text-cream/75 text-lg leading-relaxed">
                <FadeUp delay={60}>
                  <p>
                    We&apos;re Craig and Daniel. We run Crush and Norse — two wine bars and shops in Durham. Our cellar is big enough to warrant its own membership.
                  </p>
                </FadeUp>
                <FadeUp delay={120}>
                  <p>
                    Daniel is fab with wine. Somehow so knowledgeable yet totally unpretentious. Twenty years in the industry, time at the 2-star Raby Hunt, and a genuine obsession with finding bottles that make people feel something.
                  </p>
                </FadeUp>
                <FadeUp delay={180}>
                  <p>
                    The Cellar Club is what happens when a great sommelier has a big cellar, direct import relationships, and a group of people who trust him to find something worth drinking.
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

            {/* Photo panel */}
            <FadeUp className="relative h-[420px] md:h-[560px] overflow-hidden">
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: 'url(/images/story.jpg)',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center top',
                  backgroundColor: '#1E0B10',
                }}
              />
              {/* Bottom fade — blends into section background */}
              <div
                className="absolute inset-x-0 bottom-0 h-24 pointer-events-none"
                style={{ background: 'linear-gradient(to bottom, transparent, #1E0B10)' }}
                aria-hidden="true"
              />
            </FadeUp>
          </div>
        </div>
      </section>

      {/* ── Divider ── */}
      <div className="bg-maroon-dark py-10">
        <SectionDivider />
      </div>

      {/* ── Section 5: The Levels ── */}
      <section className="relative bg-maroon px-6 pb-24 overflow-hidden">
        {/* Noise overlay */}
        <div
          className="absolute inset-0 pointer-events-none select-none"
          style={{ opacity: 0.05, backgroundImage: NOISE_BG, backgroundRepeat: 'repeat' }}
          aria-hidden="true"
        />

        <div className="relative z-10 max-w-5xl mx-auto">
          <FadeUp>
            <p className="font-serif text-base uppercase tracking-[0.2em] text-gold mb-4 text-center pt-20">
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
                  background: '#1E0B10',
                  border: '1px solid rgba(240,230,220,0.12)',
                  borderTop: '3px solid #9B1B30',
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
                  background: '#1E0B10',
                  border: '1px solid rgba(201,133,29,0.25)',
                  borderTop: '3px solid #C9851D',
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
                  background: '#1E0B10',
                  border: '1px solid rgba(201,133,29,0.4)',
                  borderTop: '3px solid #C9851D',
                  boxShadow: '0 0 40px rgba(201,133,29,0.08)',
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
