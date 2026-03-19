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

function CellarArchSvg() {
  return (
    <svg
      viewBox="0 0 1000 800"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="absolute inset-0 w-full h-full"
      style={{ opacity: 0.08 }}
      aria-hidden="true"
    >
      {/* Outer barrel vault arch */}
      <path
        d="M 150 800 L 150 350 Q 150 80 500 80 Q 850 80 850 350 L 850 800"
        stroke="#F0E6DC"
        strokeWidth="2"
      />
      {/* Middle arch */}
      <path
        d="M 200 800 L 200 360 Q 200 140 500 140 Q 800 140 800 360 L 800 800"
        stroke="#F0E6DC"
        strokeWidth="1"
      />
      {/* Inner arch */}
      <path
        d="M 260 800 L 260 380 Q 260 200 500 200 Q 740 200 740 380 L 740 800"
        stroke="#F0E6DC"
        strokeWidth="0.5"
      />
      {/* Horizontal rack shelves */}
      <line x1="150" y1="450" x2="850" y2="450" stroke="#F0E6DC" strokeWidth="1" />
      <line x1="150" y1="560" x2="850" y2="560" stroke="#F0E6DC" strokeWidth="1" />
      <line x1="150" y1="670" x2="850" y2="670" stroke="#F0E6DC" strokeWidth="1" />
      {/* Vertical rack dividers */}
      <line x1="285" y1="450" x2="285" y2="800" stroke="#F0E6DC" strokeWidth="0.5" />
      <line x1="345" y1="450" x2="345" y2="800" stroke="#F0E6DC" strokeWidth="0.5" />
      <line x1="405" y1="450" x2="405" y2="800" stroke="#F0E6DC" strokeWidth="0.5" />
      <line x1="465" y1="450" x2="465" y2="800" stroke="#F0E6DC" strokeWidth="0.5" />
      <line x1="535" y1="450" x2="535" y2="800" stroke="#F0E6DC" strokeWidth="0.5" />
      <line x1="595" y1="450" x2="595" y2="800" stroke="#F0E6DC" strokeWidth="0.5" />
      <line x1="655" y1="450" x2="655" y2="800" stroke="#F0E6DC" strokeWidth="0.5" />
      <line x1="715" y1="450" x2="715" y2="800" stroke="#F0E6DC" strokeWidth="0.5" />
      {/* Bottle circles — row 1 */}
      {[315, 375, 435, 500, 565, 625, 685].map((x) => (
        <circle key={`r1-${x}`} cx={x} cy={505} r={22} stroke="#F0E6DC" strokeWidth="0.75" />
      ))}
      {/* Bottle circles — row 2 */}
      {[315, 375, 435, 500, 565, 625, 685].map((x) => (
        <circle key={`r2-${x}`} cx={x} cy={615} r={22} stroke="#F0E6DC" strokeWidth="0.75" />
      ))}
      {/* Keystone */}
      <path d="M 485 80 L 500 55 L 515 80" stroke="#F0E6DC" strokeWidth="1.5" />
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
      {/* Bottle outline — clean Bordeaux profile */}
      <path
        d="
          M 44 20
          Q 44 14 50 14
          Q 56 14 56 20
          L 56 36
          Q 58 40 58 48
          L 57 82
          Q 68 96 72 118
          Q 80 138 80 162
          L 80 268
          Q 80 274 50 274
          Q 20 274 20 268
          L 20 162
          Q 20 138 28 118
          Q 32 96 43 82
          L 42 48
          Q 42 40 44 36
          Z
        "
        stroke="#F0E6DC"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Capsule line */}
      <line x1="42" y1="44" x2="58" y2="44" stroke="#F0E6DC" strokeWidth="1" opacity="0.6" />
      {/* Label area top */}
      <line x1="23" y1="168" x2="77" y2="168" stroke="#F0E6DC" strokeWidth="0.5" opacity="0.35" />
      {/* Label area bottom */}
      <line x1="23" y1="232" x2="77" y2="232" stroke="#F0E6DC" strokeWidth="0.5" opacity="0.35" />
    </svg>
  )
}

// ─── Marquee ticker ────────────────────────────────────────────────────────────

function MarqueeTicker() {
  const text = '\u00a0\u00a0\u00a0\u00a0◆\u00a0\u00a0\u00a0\u00a0THE CELLAR CLUB\u00a0\u00a0\u00a0\u00a0◆\u00a0\u00a0\u00a0\u00a0DURHAM\u00a0\u00a0\u00a0\u00a0◆\u00a0\u00a0\u00a0\u00a0SOMMELIER SELECTED\u00a0\u00a0\u00a0\u00a0◆\u00a0\u00a0\u00a0\u00a0FINE WINE BY SMS\u00a0\u00a0\u00a0\u00a0◆\u00a0\u00a0\u00a0\u00a0DIRECT IMPORT'
  return (
    <div
      className="overflow-hidden border-t border-b py-3"
      style={{ borderColor: 'rgba(201,133,29,0.2)' }}
      aria-hidden="true"
    >
      <div
        style={{
          display: 'flex',
          whiteSpace: 'nowrap',
          animation: 'marquee 28s linear infinite',
        }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="font-serif uppercase tracking-[0.25em] pr-8"
            style={{ fontSize: '0.7rem', color: 'rgba(201,133,29,0.65)', flexShrink: 0 }}
          >
            {text}
          </span>
        ))}
      </div>
    </div>
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
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto mb-4">
      <input
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="Your mobile number"
        className="flex-1 bg-transparent border border-cream/30 px-4 py-3 text-cream placeholder-cream/30 focus:outline-none focus:border-cream/60 font-sans text-base"
      />
      <button
        type="submit"
        className="group bg-rio text-cream px-6 py-3 font-sans font-medium text-base transition-all duration-150 hover:bg-[#7d1526] whitespace-nowrap"
      >
        Join the Club{' '}
        <span className="inline-block transition-transform duration-150 group-hover:translate-x-[3px]">
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
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 py-24 overflow-hidden bg-maroon">
        <CellarArchSvg />

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

          {/* Subheading — three lines, staggered fade-in */}
          <div className="mb-10 max-w-[600px] mx-auto space-y-3">
            <p className="hero-line hero-line-1 font-serif text-cream/85 text-[1.5rem] leading-snug text-center">
              Two texts a week. Reply how many bottles you want.
            </p>
            <p className="hero-line hero-line-2 font-serif text-cream/85 text-[1.5rem] leading-snug text-center">
              Wines you won&apos;t find on any shelf, at prices that feel like a secret.
            </p>
            <p className="hero-line hero-line-3 font-serif text-cream/85 text-[1.5rem] leading-snug text-center">
              We store and ship for free once you fill a case.
            </p>
          </div>

          {/* Sign-up form */}
          <HeroSignupForm />

          {/* Reassurance */}
          <p className="font-sans text-cream/40 text-xs">
            You&apos;re only ever charged when you confirm an order.
          </p>
          <p className="font-sans text-cream/35 text-xs mt-2">
            Already a member?{' '}
            <Link href="/portal" className="underline underline-offset-2 text-cream/45 hover:text-cream/70 transition-colors">
              Log in here
            </Link>
          </p>
        </div>
      </section>

      {/* ── Marquee ── */}
      <MarqueeTicker />

      {/* ── Divider ── */}
      <div className="bg-maroon py-10">
        <SectionDivider />
      </div>

      {/* ── Section 2: How It Works ── */}
      <section className="relative bg-maroon px-6 pb-24 overflow-hidden">
        {/* Noise overlay */}
        <div
          className="absolute inset-0 pointer-events-none select-none"
          style={{ opacity: 0.03, backgroundImage: NOISE_BG, backgroundRepeat: 'repeat' }}
          aria-hidden="true"
        />

        <div className="relative z-10 max-w-5xl mx-auto">
          {/* Section label */}
          <FadeUp>
            <p className="font-serif text-base uppercase tracking-[0.2em] text-gold text-center mb-14">
              How It Works
            </p>
          </FadeUp>

          {/* Three steps */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8">
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
              <FadeUp key={num} delay={i * 80}>
                <div className="text-center md:text-left relative">
                  {/* Large background number */}
                  <span
                    className="font-serif absolute -top-2 left-0 select-none pointer-events-none"
                    style={{
                      fontSize: '7rem',
                      lineHeight: 1,
                      color: '#C9851D',
                      opacity: 0.07,
                    }}
                    aria-hidden="true"
                  >
                    {num}
                  </span>
                  {/* Step label */}
                  <span className="font-serif text-gold text-sm tracking-[0.2em] uppercase relative z-10">
                    Step {num}
                  </span>
                  <h3 className="font-serif text-cream text-2xl mt-2 mb-3 relative z-10">{heading}</h3>
                  <p
                    className="font-sans text-cream/75 text-base leading-relaxed relative z-10"
                    style={{ borderLeft: '3px solid #9B1B30', paddingLeft: '1rem' }}
                  >
                    {body}
                  </p>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ── Marquee ── */}
      <MarqueeTicker />

      {/* ── Divider ── */}
      <div className="bg-maroon py-10">
        <SectionDivider />
      </div>

      {/* ── Section 3: The Benefits ── */}
      <section className="relative bg-maroon px-6 pb-24 overflow-hidden">
        {/* Noise overlay */}
        <div
          className="absolute inset-0 pointer-events-none select-none"
          style={{ opacity: 0.03, backgroundImage: NOISE_BG, backgroundRepeat: 'repeat' }}
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
                heading: 'Wines you won\'t find anywhere else',
                body: 'We import directly and have relationships most retailers don\'t. Taiwan, Georgia, Texas, India — if it\'s interesting, Daniel will find it.',
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
                body: 'Every bottle is chosen by Daniel Jonberger — 20 years in wine, including time at the 2-star Raby Hunt. He doesn\'t pick anything he wouldn\'t open himself.',
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
                body: 'Want something we haven\'t featured? Request it. If enough members are in, we\'ll run it as a drop — at bulk prices.',
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
                  <p className="font-sans text-cream/75 text-base leading-relaxed">{body}</p>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pull quote ── */}
      <section className="bg-maroon px-6 py-20 overflow-hidden">
        <FadeUp>
          <blockquote className="max-w-3xl mx-auto text-center">
            <p
              className="font-serif text-cream/90 leading-tight"
              style={{ fontSize: 'clamp(1.75rem, 4vw, 3rem)' }}
            >
              &ldquo;We don&apos;t send you wine. We send you a chance to say yes or no. You&apos;re always in control.&rdquo;
            </p>
            <footer className="mt-6 font-sans text-cream/40 text-sm tracking-[0.2em] uppercase">
              Daniel Jonberger &mdash; Sommelier
            </footer>
          </blockquote>
        </FadeUp>
      </section>

      {/* ── Divider ── */}
      <div className="bg-maroon py-10">
        <SectionDivider />
      </div>

      {/* ── Section 4: The Story ── */}
      <section className="relative bg-maroon px-6 pb-24 overflow-hidden">
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
                <p className="font-serif text-base uppercase tracking-[0.2em] text-gold mb-8">
                  Our Story
                </p>
              </FadeUp>

              <div className="space-y-5 font-serif text-cream/80 text-xl leading-relaxed">
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

            {/* Bottle illustration */}
            <FadeUp className="flex items-center justify-center">
              <WineBottleSvg />
            </FadeUp>
          </div>
        </div>
      </section>

      {/* ── Divider ── */}
      <div className="bg-maroon py-10">
        <SectionDivider />
      </div>

      {/* ── Section 5: The Levels ── */}
      <section className="relative bg-maroon px-6 pb-24 overflow-hidden">
        {/* Noise overlay */}
        <div
          className="absolute inset-0 pointer-events-none select-none"
          style={{ opacity: 0.03, backgroundImage: NOISE_BG, backgroundRepeat: 'repeat' }}
          aria-hidden="true"
        />

        <div className="relative z-10 max-w-5xl mx-auto">
          <FadeUp>
            <p className="font-serif text-base uppercase tracking-[0.2em] text-gold mb-4 text-center pt-20">
              The Levels
            </p>
            <p className="font-sans text-cream/75 text-base text-center max-w-md mx-auto mb-14">
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
                <ul className="space-y-3 font-sans text-base text-cream/80 leading-relaxed">
                  <li>Two weekly drops via SMS</li>
                  <li>Free delivery at 12 bottles</li>
                  <li>Unlimited wine request service</li>
                  <li>Wine concierge (up to 2 requests/month)</li>
                </ul>
                <p className="font-sans text-sm text-cream/60 mt-6">Free to join.</p>
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
                <ul className="space-y-3 font-sans text-base text-cream/80 leading-relaxed">
                  <li>Everything in Bailey</li>
                  <li>Up to 5 wine concierge requests/month</li>
                  <li>2 × tickets to wine tastings (Durham or London)</li>
                  <li>5% discount on all orders</li>
                </ul>
                <p className="font-sans text-sm text-gold/80 mt-6">Unlocks automatically when you hit £500 in a rolling 12 months.</p>
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
                <ul className="space-y-3 font-sans text-base text-cream/80 leading-relaxed">
                  <li>Everything in Elvet</li>
                  <li>Free delivery at 6 bottles</li>
                  <li>10% discount on all orders</li>
                  <li>4 × tickets to wine tastings (Durham or London)</li>
                  <li>First look — 2 hours before everyone else</li>
                </ul>
                <p className="font-sans text-sm text-gold/80 mt-6">Unlocks at £1,000. Free shipping halves to 6 bottles.</p>
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
