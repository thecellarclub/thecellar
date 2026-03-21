'use client'

import { useState, useEffect, useRef, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// ─── Scroll fade-up ────────────────────────────────────────────────────────────

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
        if (entry.isIntersecting) { setVisible(true); observer.disconnect() }
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

// ─── Arch SVG — dark strokes for cream background ─────────────────────────────

function CellarDoorSvg() {
  return (
    <svg
      viewBox="0 0 1000 800"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="absolute inset-0 w-full h-full hidden sm:block"
      style={{ opacity: 0.22 }}
      aria-hidden="true"
    >
      <path
        d="M 268 782 L 268 310 A 232 232 0 0 1 732 310 L 732 782 Z"
        stroke="#3D1A12"
        strokeWidth="2.5"
      />
      <path
        d="M 286 770 L 286 310 A 214 214 0 0 1 714 310 L 714 770 Z"
        stroke="#3D1A12"
        strokeWidth="1"
      />
      <circle cx="666" cy="546" r="30" stroke="#3D1A12" strokeWidth="1.5" />
      <circle cx="666" cy="546" r="16" stroke="#3D1A12" strokeWidth="1.5" />
    </svg>
  )
}

// ─── Menu components ───────────────────────────────────────────────────────────

function MenuSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-12">
      <div className="flex items-center gap-4 mb-7">
        <div className="flex-1 h-px" style={{ background: 'rgba(100,50,20,0.2)' }} />
        <p
          className="font-serif text-sm uppercase tracking-[0.28em] shrink-0"
          style={{ color: 'rgba(42,24,16,0.65)' }}
        >
          {title}
        </p>
        <div className="flex-1 h-px" style={{ background: 'rgba(100,50,20,0.2)' }} />
      </div>
      {children}
    </div>
  )
}

function MenuEntry({
  name,
  price,
  description,
}: {
  name: string
  price: string
  description?: string
}) {
  return (
    <div className="mb-5">
      <div className="flex items-baseline gap-3">
        <span className="font-serif text-lg md:text-xl shrink-0" style={{ color: '#1C0E09' }}>
          {name}
        </span>
        <span
          className="flex-1 min-w-0"
          style={{ borderBottom: '1px dotted rgba(42,24,16,0.2)', marginBottom: '0.3em' }}
        />
        <span className="font-serif text-lg shrink-0 text-right" style={{ color: '#9B1B30' }}>
          {price}
        </span>
      </div>
      {description && (
        <p
          className="font-serif italic text-base leading-relaxed mt-1.5"
          style={{ color: 'rgba(42,24,16,0.55)' }}
        >
          {description}
        </p>
      )}
    </div>
  )
}

// ─── Tier perk row (indented, smaller) ────────────────────────────────────────

function PerkEntry({ name, value }: { name: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2 mb-2">
      <span className="font-serif text-base shrink-0" style={{ color: 'rgba(42,24,16,0.55)' }}>
        {name}
      </span>
      <span
        className="flex-1 min-w-0"
        style={{ borderBottom: '1px dotted rgba(42,24,16,0.13)', marginBottom: '0.3em' }}
      />
      <span className="font-serif text-base shrink-0 text-right" style={{ color: 'rgba(155,27,48,0.7)' }}>
        {value}
      </span>
    </div>
  )
}

// ─── Sign-up form — light theme ────────────────────────────────────────────────

function SignupForm() {
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
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
      <div
        className="flex-1 flex items-stretch focus-within:border-opacity-60 transition-colors"
        style={{ border: '1px solid rgba(42,24,16,0.28)' }}
      >
        <span
          className="flex items-center px-3 font-sans text-base select-none bg-transparent whitespace-nowrap border-r"
          style={{ color: 'rgba(42,24,16,0.45)', borderColor: 'rgba(42,24,16,0.18)' }}
        >
          +44
        </span>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="7700 900000"
          className="flex-1 bg-transparent px-4 py-3 focus:outline-none font-sans text-base"
          style={{ color: '#1C0E09' }}
        />
      </div>
      <button
        type="submit"
        className="group text-white px-6 py-3 font-sans font-medium text-base transition-all duration-150 hover:opacity-90 whitespace-nowrap"
        style={{ background: '#9B1B30' }}
      >
        Join the Club{' '}
        <span className="inline-block transition-transform duration-150 group-hover:translate-x-[3px]">→</span>
      </button>
    </form>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const PAGE_BG = '#E6D9CA'
  const CARD_BG = '#F2EAE0'
  const TEXT_DARK = '#1C0E09'
  const BORDER = 'rgba(42,24,16,0.18)'

  return (
    <div style={{ background: PAGE_BG, color: TEXT_DARK, minHeight: '100vh' }}>

      {/* ── Centered menu card with border all the way around ── */}
      <div className="max-w-2xl mx-auto py-6 sm:py-10 px-4 sm:px-6">
        <div
          style={{
            background: CARD_BG,
            border: `1px solid ${BORDER}`,
            color: TEXT_DARK,
          }}
        >

          {/* ── Arch header — logo + door ── */}
          <div
            className="relative flex flex-col items-center justify-center pt-14 pb-10 overflow-hidden"
          >
            <CellarDoorSvg />
            <div className="relative z-10 text-center">
              <div className="mb-5">
                <span
                  className="block font-serif text-xs uppercase tracking-[0.35em]"
                  style={{ color: 'rgba(42,24,16,0.45)' }}
                >
                  the
                </span>
                <span
                  className="block font-serif text-6xl md:text-7xl uppercase tracking-[0.08em] leading-none"
                  style={{ color: TEXT_DARK }}
                >
                  CELLAR
                </span>
                <span
                  className="block font-serif text-xs uppercase tracking-[0.35em]"
                  style={{ color: 'rgba(42,24,16,0.45)' }}
                >
                  club
                </span>
              </div>
            </div>
          </div>

          {/* ── Tagline + sommelier — below the door ── */}
          <div className="text-center px-8 pt-6 pb-8">
            <p
              className="font-serif italic"
              style={{ fontSize: 'clamp(1rem, 2.5vw, 1.25rem)', color: 'rgba(42,24,16,0.72)' }}
            >
              A private cellar. Two offers a week. Yours by text.
            </p>
            <p
              className="font-sans text-xs uppercase tracking-[0.28em] mt-2"
              style={{ color: 'rgba(42,24,16,0.38)' }}
            >
              Sommelier &middot; Daniel Jonberger
            </p>
          </div>

          {/* ── Sign-up form ── */}
          <FadeUp>
            <div className="px-8 pb-6">
              <SignupForm />
              <p
                className="font-serif italic text-xs text-center mt-4"
                style={{ color: 'rgba(42,24,16,0.38)' }}
              >
                Already a member?{' '}
                <Link
                  href="/portal"
                  className="underline underline-offset-2 transition-colors hover:opacity-70"
                  style={{ color: 'rgba(42,24,16,0.5)' }}
                >
                  Log in here
                </Link>
              </p>
            </div>
          </FadeUp>

          {/* ── Menu sections ── */}
          <div className="px-8 pt-6 pb-4">

            {/* ── How It Works ── */}
            <MenuSection title="How It Works">
              <MenuEntry name="We text you twice each week" price="2" />
              <MenuEntry name="Reply how many bottles you want" price="4" />
              <MenuEntry name="We store it until you fill a case of" price="12" />
              <MenuEntry name="Then ship it to you for" price="free" />
            </MenuSection>

            {/* ── Why Bother ── */}
            <MenuSection title="Why Bother">
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

            {/* ── Welcome to the Club (tiers) ── */}
            <MenuSection title="The Club">
              <p
                className="font-serif italic text-base leading-relaxed mb-7"
                style={{ color: 'rgba(42,24,16,0.55)' }}
              >
                Your tier is awarded on your rolling twelve-month spend.
              </p>

              <MenuEntry name="Bailey" price="free to join" />
              <div className="mb-9">
                <PerkEntry name="SMS drops" value="2 / week" />
                <PerkEntry name="Concierge requests" value="2 / month" />
                <PerkEntry name="Wine requests" value="unlimited" />
                <PerkEntry name="Free delivery" value="at 12 bottles" />
              </div>

              <MenuEntry name="Elvet" price="unlocks at £500" />
              <div className="mb-9">
                <PerkEntry name="SMS drops" value="2 / week" />
                <PerkEntry name="Concierge requests" value="5 / month" />
                <PerkEntry name="Wine requests" value="unlimited" />
                <PerkEntry name="Tasting tickets" value="2 / year" />
                <PerkEntry name="Discount" value="5%" />
                <PerkEntry name="Free delivery" value="at 12 bottles" />
              </div>

              <MenuEntry name="Palatine" price="unlocks at £1,000" />
              <div className="mb-2">
                <PerkEntry name="SMS drops" value="2 / week" />
                <PerkEntry name="Concierge requests" value="unlimited" />
                <PerkEntry name="Wine requests" value="unlimited" />
                <PerkEntry name="Tasting tickets" value="4 / year" />
                <PerkEntry name="Discount" value="10%" />
                <PerkEntry name="Free delivery" value="at 6 bottles" />
                <PerkEntry name="First look" value="2 hrs early" />
              </div>
            </MenuSection>

            {/* ── Our Story ── */}
            <MenuSection title="Our Story">
              <div
                className="space-y-5 font-serif text-base leading-relaxed"
                style={{ color: 'rgba(42,24,16,0.72)' }}
              >
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
                    className="group inline-block font-sans font-medium px-8 py-3.5 transition-all duration-150 hover:opacity-90"
                    style={{ background: '#9B1B30', color: '#F0E6DC' }}
                  >
                    Join the Club{' '}
                    <span className="inline-block transition-transform duration-150 group-hover:translate-x-[3px]">→</span>
                  </Link>
                </div>
              </FadeUp>
            </MenuSection>

          </div>

          {/* ── Footer — inside the card ── */}
          <div className="px-8 py-8 text-center space-y-2">
            <p className="font-sans text-xs" style={{ color: 'rgba(42,24,16,0.32)' }}>
              CD WINES LTD &middot; Company No. 15796479
            </p>
            <p className="font-sans text-xs" style={{ color: 'rgba(42,24,16,0.32)' }}>
              Licensed under the Licensing Act 2003 &middot; Licence No. DCCC/PLA0856
            </p>
            <p className="font-sans text-xs" style={{ color: 'rgba(42,24,16,0.32)' }}>
              We do not sell alcohol to anyone under 18. Please drink responsibly.
            </p>
            <div className="flex justify-center gap-6 pt-2">
              <Link
                href="/privacy"
                className="font-sans text-xs underline underline-offset-2 transition-opacity hover:opacity-70"
                style={{ color: 'rgba(42,24,16,0.38)' }}
              >
                Privacy Policy
              </Link>
              <Link
                href="/terms"
                className="font-sans text-xs underline underline-offset-2 transition-opacity hover:opacity-70"
                style={{ color: 'rgba(42,24,16,0.38)' }}
              >
                Terms &amp; Conditions
              </Link>
            </div>
          </div>

        </div>
      </div>

    </div>
  )
}
