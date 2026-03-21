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
      <path
        d="M 268 782 L 268 310 A 232 232 0 0 1 732 310 L 732 782 Z"
        stroke="#F0E6DC"
        strokeWidth="2.5"
      />
      <path
        d="M 286 770 L 286 310 A 214 214 0 0 1 714 310 L 714 770 Z"
        stroke="#F0E6DC"
        strokeWidth="1"
      />
      <circle cx="666" cy="546" r="30" stroke="#F0E6DC" strokeWidth="1.5" />
      <circle cx="666" cy="546" r="16" stroke="#F0E6DC" strokeWidth="1.5" />
    </svg>
  )
}

// ─── Menu components ───────────────────────────────────────────────────────────

function MenuEntry({
  name,
  price,
  description,
  onClick,
  active,
}: {
  name: string
  price: string
  description?: string
  onClick?: () => void
  active?: boolean
}) {
  const clickable = !!onClick
  return (
    <div
      className={`mb-5 ${clickable ? 'cursor-pointer select-none' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-baseline gap-3">
        <span
          className="font-serif text-lg shrink-0 transition-colors duration-150"
          style={{ color: active === false ? 'rgba(240,230,220,0.55)' : '#F0E6DC' }}
        >
          {name}
        </span>
        <span
          className="flex-1 min-w-0"
          style={{
            borderBottom: '1px dotted rgba(240,230,220,0.18)',
            marginBottom: '0.3em',
          }}
        />
        <span
          className="font-serif text-base shrink-0 text-right transition-colors duration-150"
          style={{ color: active === false ? 'rgba(201,133,29,0.45)' : 'rgba(201,133,29,0.85)' }}
        >
          {price}
        </span>
      </div>
      {description && (
        <p
          className="font-serif italic text-sm leading-relaxed mt-1.5"
          style={{ color: 'rgba(240,230,220,0.42)' }}
        >
          {description}
        </p>
      )}
    </div>
  )
}

function MenuSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-14">
      <div className="flex items-center gap-4 mb-8">
        <div className="flex-1 h-px" style={{ background: 'rgba(201,133,29,0.28)' }} />
        <p
          className="font-serif text-xs uppercase tracking-[0.32em] shrink-0"
          style={{ color: 'rgba(201,133,29,0.65)' }}
        >
          {title}
        </p>
        <div className="flex-1 h-px" style={{ background: 'rgba(201,133,29,0.28)' }} />
      </div>
      {children}
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
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 mb-0">
      <div
        className="flex items-stretch transition-colors"
        style={{ border: '1px solid rgba(201,133,29,0.5)', boxShadow: '0 0 0 3px rgba(201,133,29,0.06)' }}
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

      {/* ── Header: brand mark ── */}
      <section className="relative flex flex-col items-center justify-center px-6 pt-20 pb-14 overflow-hidden">
        <CellarDoorSvg />
        <div
          className="absolute inset-0 pointer-events-none select-none"
          style={{ opacity: 0.03, backgroundImage: NOISE_BG, backgroundRepeat: 'repeat' }}
          aria-hidden="true"
        />

        <div className="relative z-10 text-center">
          <div className="mb-6">
            <span className="block font-serif text-xs uppercase tracking-[0.35em] text-cream/70">the</span>
            <span className="block font-serif text-6xl md:text-7xl uppercase tracking-[0.08em] leading-none text-cream">CELLAR</span>
            <span className="block font-serif text-xs uppercase tracking-[0.35em] text-cream/70">club</span>
          </div>

          <div className="w-12 h-px bg-gold mx-auto mb-5 opacity-60" />

          {/* Quote headline */}
          <p
            className="font-serif text-cream/88 leading-snug mb-8 max-w-lg mx-auto"
            style={{ fontSize: 'clamp(1.15rem, 3vw, 1.7rem)' }}
          >
            Wines you won&apos;t find on any shelf, at prices that feel like a secret.
          </p>

          {/* Mini wine menu summary */}
          <div className="max-w-xs mx-auto text-left mb-6">
            {[
              ['We text you each week', 'twice'],
              ['Reply how many you want', '3 bottles'],
              ['We store it until you fill a case of', '12'],
              ['Then ship it to you for', '£0'],
            ].map(([name, price]) => (
              <div key={name} className="flex items-baseline gap-2 mb-2.5">
                <span className="font-serif text-sm shrink-0" style={{ color: 'rgba(240,230,220,0.68)' }}>
                  {name}
                </span>
                <span
                  className="flex-1 min-w-0"
                  style={{ borderBottom: '1px dotted rgba(240,230,220,0.16)', marginBottom: '0.3em' }}
                />
                <span className="font-serif text-sm shrink-0" style={{ color: 'rgba(201,133,29,0.82)' }}>
                  {price}
                </span>
              </div>
            ))}
          </div>

          <p className="font-sans text-cream/28 text-xs tracking-[0.22em] uppercase">
            Sommelier &middot; Daniel Jonberger
          </p>
        </div>
      </section>

      {/* ── Menu body ── */}
      <div className="max-w-2xl mx-auto px-8 pb-20">

        {/* ── Reservations (join) ── */}
        <MenuSection title="Reservations">
          <MenuEntry name="Membership" price="free to join" />
          <div className="mt-6 max-w-sm mx-auto">
            <HeroSignupForm />
          </div>
          <p className="font-serif italic text-cream/32 text-xs text-center mt-4">
            Already a member?{' '}
            <Link href="/portal" className="underline underline-offset-2 text-cream/42 hover:text-cream/65 transition-colors">
              Log in here
            </Link>
          </p>
        </MenuSection>

        {/* ── Membership ── */}
        <MenuSection title="Membership">
          <MenuEntry
            name="Off the beaten path"
            price="40+ countries"
            description="We import directly and have relationships most retailers don't. Taiwan, Georgia, Texas, India: if it's interesting, Daniel will find it."
          />
          <MenuEntry
            name="Sommelier selected"
            price="20 years"
            description="Every bottle is chosen by Daniel Jonberger. Time at the 2-star Raby Hunt. A genuine obsession with finding bottles that make people feel something."
          />
          <MenuEntry
            name="Better prices"
            price="direct import rates"
            description="We buy in volume across our two wine bars. You get the benefit of that."
          />
          <MenuEntry
            name="Free storage"
            price="until your case is full"
            description="Your bottles wait for you. No storage charge, no pressure to buy more."
          />
          <MenuEntry
            name="Wine concierge"
            price="unlimited questions"
            description="Got a question? Looking for a gift? Text Daniel directly. He'll sort it."
          />
          <MenuEntry
            name="Request a wine"
            price="group buy, bulk price"
            description="Want something we haven't featured? Request it. If enough members are in, we'll run it as a drop."
          />
        </MenuSection>

        {/* ── The Levels ── */}
        <MenuSection title="The Levels">
          <p
            className="font-serif italic text-sm leading-relaxed mb-8"
            style={{ color: 'rgba(240,230,220,0.35)' }}
          >
            Tiers assessed annually on your rolling twelve-month spend.
          </p>

          {/* Bailey */}
          <MenuEntry name="Bailey" price="free to join" />
          <div className="pl-4 mb-10">
            {[
              ['SMS drops', '2 / week'],
              ['Concierge requests', '2 / month'],
              ['Wine requests', 'unlimited'],
              ['Free delivery', 'at 12 bottles'],
            ].map(([name, price]) => (
              <div key={name} className="flex items-baseline gap-2 mb-2">
                <span className="font-serif text-sm shrink-0" style={{ color: 'rgba(240,230,220,0.48)' }}>
                  {name}
                </span>
                <span
                  className="flex-1 min-w-0"
                  style={{ borderBottom: '1px dotted rgba(240,230,220,0.12)', marginBottom: '0.3em' }}
                />
                <span className="font-serif text-sm shrink-0 text-right" style={{ color: 'rgba(201,133,29,0.55)' }}>
                  {price}
                </span>
              </div>
            ))}
          </div>

          {/* Elvet */}
          <MenuEntry name="Elvet" price="unlocks at £500" />
          <div className="pl-4 mb-10">
            {[
              ['SMS drops', '2 / week'],
              ['Concierge requests', '5 / month'],
              ['Wine requests', 'unlimited'],
              ['Tasting tickets', '2 / year'],
              ['Discount', '5%'],
              ['Free delivery', 'at 12 bottles'],
            ].map(([name, price]) => (
              <div key={name} className="flex items-baseline gap-2 mb-2">
                <span className="font-serif text-sm shrink-0" style={{ color: 'rgba(240,230,220,0.48)' }}>
                  {name}
                </span>
                <span
                  className="flex-1 min-w-0"
                  style={{ borderBottom: '1px dotted rgba(240,230,220,0.12)', marginBottom: '0.3em' }}
                />
                <span className="font-serif text-sm shrink-0 text-right" style={{ color: 'rgba(201,133,29,0.55)' }}>
                  {price}
                </span>
              </div>
            ))}
          </div>

          {/* Palatine */}
          <MenuEntry name="Palatine" price="unlocks at £1,000" />
          <div className="pl-4 mb-2">
            {[
              ['SMS drops', '2 / week'],
              ['Concierge requests', 'unlimited'],
              ['Wine requests', 'unlimited'],
              ['Tasting tickets', '4 / year'],
              ['Discount', '10%'],
              ['Free delivery', 'at 6 bottles'],
              ['First look', '2 hrs early'],
            ].map(([name, price]) => (
              <div key={name} className="flex items-baseline gap-2 mb-2">
                <span className="font-serif text-sm shrink-0" style={{ color: 'rgba(240,230,220,0.48)' }}>
                  {name}
                </span>
                <span
                  className="flex-1 min-w-0"
                  style={{ borderBottom: '1px dotted rgba(240,230,220,0.12)', marginBottom: '0.3em' }}
                />
                <span className="font-serif text-sm shrink-0 text-right" style={{ color: 'rgba(201,133,29,0.55)' }}>
                  {price}
                </span>
              </div>
            ))}
          </div>
        </MenuSection>

        {/* ── Our Story ── */}
        <MenuSection title="Our Story">
          <div className="space-y-5 font-serif text-cream/70 text-base leading-relaxed">
            <FadeUp>
              <p>
                We&apos;re Craig and Daniel. We opened Crush wine bar in Durham a couple years ago and just got the keys to a second one — with a cellar big enough to warrant its own membership.
              </p>
            </FadeUp>
            <FadeUp delay={60}>
              <p>
                Daniel is fab with wine. Twenty years in the industry, time at the 2-star Raby Hunt, and yet he still manages to talk about wine without coming across like a tw**.
              </p>
            </FadeUp>
            <FadeUp delay={120}>
              <p>
                The Cellar Club is what happens when a great sommelier has lots of storage space, direct import relationships, and a group of people who trust him to find something worth drinking.
              </p>
            </FadeUp>
          </div>

          <FadeUp delay={180}>
            <div className="mt-10 text-center">
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
        </MenuSection>

      </div>

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
