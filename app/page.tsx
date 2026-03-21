'use client'

import { useState, useEffect, useRef, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

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

// ─── Menu components ───────────────────────────────────────────────────────────

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
        <span
          className="font-serif text-lg shrink-0"
          style={{ color: '#120608' }}
        >
          {name}
        </span>
        <span
          className="flex-1 min-w-0"
          style={{
            borderBottom: '1px dotted rgba(18,6,8,0.18)',
            marginBottom: '0.3em',
          }}
        />
        <span
          className="font-serif text-base shrink-0 text-right"
          style={{ color: 'rgba(160,100,10,0.9)' }}
        >
          {price}
        </span>
      </div>
      {description && (
        <p
          className="font-serif italic text-sm leading-relaxed mt-1.5"
          style={{ color: 'rgba(18,6,8,0.48)' }}
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
        <div className="flex-1 h-px" style={{ background: 'rgba(160,100,10,0.3)' }} />
        <p
          className="font-serif text-xs uppercase tracking-[0.32em] shrink-0"
          style={{ color: 'rgba(160,100,10,0.75)' }}
        >
          {title}
        </p>
        <div className="flex-1 h-px" style={{ background: 'rgba(160,100,10,0.3)' }} />
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
        style={{ border: '1px solid rgba(160,100,10,0.5)', boxShadow: '0 0 0 3px rgba(160,100,10,0.06)' }}
      >
        <span
          className="flex items-center px-3 font-sans text-base border-r select-none bg-transparent whitespace-nowrap"
          style={{ color: 'rgba(18,6,8,0.45)', borderColor: 'rgba(160,100,10,0.3)' }}
        >
          +44
        </span>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="7700 900000"
          style={{ color: '#120608', background: 'transparent' }}
          className="flex-1 px-4 py-3 focus:outline-none font-sans text-base placeholder:text-maroon/30"
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
    <div className="bg-cream min-h-screen py-10 px-4 sm:px-6">

      {/* ── Card ── */}
      <div
        className="max-w-2xl mx-auto"
        style={{
          background: '#F0E6DC',
          border: '1px solid rgba(18,6,8,0.14)',
          boxShadow: '0 2px 16px rgba(18,6,8,0.08)',
        }}
      >

        {/* ── Header ── */}
        <div className="px-8 pt-10 pb-8" style={{ borderBottom: '1px solid rgba(18,6,8,0.1)' }}>
          {/* Brand mark — centred */}
          <div className="text-center mb-6">
            <span className="block font-serif text-xs uppercase tracking-[0.35em]" style={{ color: 'rgba(18,6,8,0.5)' }}>the</span>
            <span className="block font-serif text-6xl md:text-7xl uppercase tracking-[0.08em] leading-none" style={{ color: '#120608' }}>CELLAR</span>
            <span className="block font-serif text-xs uppercase tracking-[0.35em]" style={{ color: 'rgba(18,6,8,0.5)' }}>club</span>
          </div>
          <div className="w-12 h-px mx-auto mb-6 opacity-60" style={{ background: '#C9851D' }} />

          {/* Quote headline — styled like section titles */}
          <p
            className="font-serif text-xs uppercase tracking-[0.32em] text-center"
            style={{ color: 'rgba(160,100,10,0.75)' }}
          >
            Wines you won&apos;t find on any shelf, at prices that feel like a secret.
          </p>
        </div>

        {/* ── Menu body ── */}
        <div className="px-8 py-10">

          {/* ── Reservations (join) — no section title ── */}
          <div className="mb-14">
            <MenuEntry name="We text you twice each week" price="2" />
            <MenuEntry name="Reply how many bottles you want" price="4" />
            <MenuEntry name="We store it until you fill a case of" price="12" />
            <MenuEntry name="Then ship it to you for" price="free" />
            <div className="mt-6 max-w-sm mx-auto">
              <HeroSignupForm />
            </div>
            <p className="font-serif italic text-xs text-center mt-4" style={{ color: 'rgba(18,6,8,0.32)' }}>
              Already a member?{' '}
              <Link href="/portal" className="underline underline-offset-2 hover:opacity-70 transition-opacity" style={{ color: 'rgba(18,6,8,0.45)' }}>
                Log in here
              </Link>
            </p>
          </div>

          {/* ── Membership ── */}
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

          {/* ── The Levels ── */}
          <MenuSection title="Welcome to the Club">
            <p
              className="font-serif italic text-sm leading-relaxed mb-8"
              style={{ color: 'rgba(18,6,8,0.38)' }}
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
                  <span className="font-serif text-sm shrink-0" style={{ color: 'rgba(18,6,8,0.48)' }}>
                    {name}
                  </span>
                  <span
                    className="flex-1 min-w-0"
                    style={{ borderBottom: '1px dotted rgba(18,6,8,0.14)', marginBottom: '0.3em' }}
                  />
                  <span className="font-serif text-sm shrink-0 text-right" style={{ color: 'rgba(160,100,10,0.7)' }}>
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
                  <span className="font-serif text-sm shrink-0" style={{ color: 'rgba(18,6,8,0.48)' }}>
                    {name}
                  </span>
                  <span
                    className="flex-1 min-w-0"
                    style={{ borderBottom: '1px dotted rgba(18,6,8,0.14)', marginBottom: '0.3em' }}
                  />
                  <span className="font-serif text-sm shrink-0 text-right" style={{ color: 'rgba(160,100,10,0.7)' }}>
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
                  <span className="font-serif text-sm shrink-0" style={{ color: 'rgba(18,6,8,0.48)' }}>
                    {name}
                  </span>
                  <span
                    className="flex-1 min-w-0"
                    style={{ borderBottom: '1px dotted rgba(18,6,8,0.14)', marginBottom: '0.3em' }}
                  />
                  <span className="font-serif text-sm shrink-0 text-right" style={{ color: 'rgba(160,100,10,0.7)' }}>
                    {price}
                  </span>
                </div>
              ))}
            </div>
          </MenuSection>

          {/* ── Our Story ── */}
          <MenuSection title="Our Story">
            <div className="space-y-5 font-serif text-base leading-relaxed" style={{ color: 'rgba(18,6,8,0.68)' }}>
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

        {/* ── In-card footer ── */}
        <div
          className="px-8 py-6 text-center space-y-1.5"
          style={{ borderTop: '1px solid rgba(18,6,8,0.1)' }}
        >
          <p className="font-sans text-xs" style={{ color: 'rgba(18,6,8,0.3)' }}>
            CD WINES LTD &middot; Company No. 15796479
          </p>
          <p className="font-sans text-xs" style={{ color: 'rgba(18,6,8,0.3)' }}>
            Licensed under the Licensing Act 2003 &middot; Licence No. DCCC/PLA0856
          </p>
          <p className="font-sans text-xs" style={{ color: 'rgba(18,6,8,0.3)' }}>
            We do not sell alcohol to anyone under 18. Please drink responsibly.
          </p>
          <div className="flex justify-center gap-6 pt-1">
            <Link href="/privacy" className="font-sans text-xs underline underline-offset-2 transition-opacity hover:opacity-70" style={{ color: 'rgba(18,6,8,0.38)' }}>
              Privacy Policy
            </Link>
            <Link href="/terms" className="font-sans text-xs underline underline-offset-2 transition-opacity hover:opacity-70" style={{ color: 'rgba(18,6,8,0.38)' }}>
              Terms &amp; Conditions
            </Link>
          </div>
        </div>

      </div>
    </div>
  )
}
