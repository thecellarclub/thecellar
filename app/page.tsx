'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { FadeUp } from './_components/FadeUp'
import { TextDemo } from './_components/TextDemo'

// ── Colour tokens ───────────────────────────────────────────────────────────

const PAGE_BG    = '#EDE8DF'
const CARD_BG    = '#F5EFE6'
const TEXT_DARK  = '#1C0E09'
const TEXT_FAINT = 'rgba(42,24,16,0.40)'
const BORDER     = 'rgba(42,24,16,0.18)'
const ACCENT     = '#9B1B30'

// ── Decorated headline — first letter of each word slightly larger ──────────

function DecoratedHeading({ text }: { text: string }) {
  const words = text.split(' ')
  return (
    <h1
      aria-label={text}
      className="font-serif uppercase leading-tight mb-5"
      style={{ color: TEXT_DARK, letterSpacing: '0.07em' }}
    >
      {words.map((word, wi) => (
        <span key={wi}>
          {wi > 0 ? ' ' : ''}
          <span style={{ fontSize: 'clamp(2.15rem, 4.2vw, 2.6rem)', fontWeight: 400 }}>
            {word.slice(0, 1)}
          </span>
          <span style={{ fontSize: 'clamp(1.7rem, 3.3vw, 2.1rem)', fontWeight: 400 }}>
            {word.slice(1)}
          </span>
        </span>
      ))}
    </h1>
  )
}

// ── Section title with flanking rules ──────────────────────────────────────

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-4 mb-7 justify-center">
      <div className="w-24 h-px shrink-0" style={{ background: 'rgba(100,50,20,0.2)' }} />
      <p
        className="font-sans text-sm uppercase tracking-[0.28em] shrink-0"
        style={{ color: 'rgba(42,24,16,0.65)' }}
      >
        {title}
      </p>
      <div className="w-24 h-px shrink-0" style={{ background: 'rgba(100,50,20,0.2)' }} />
    </div>
  )
}

// ── Sign-up form ────────────────────────────────────────────────────────────

function SignupForm({
  buttonText = 'JOIN THE CLUB',
  showLoginLink = false,
}: {
  buttonText?: string
  showLoginLink?: boolean
}) {
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
    <div className="w-full max-w-lg">
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
        <div
          className="flex-1 flex items-stretch transition-colors focus-within:border-opacity-60"
          style={{ border: `1px solid ${BORDER}` }}
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

      {showLoginLink && (
        <p className="font-serif italic text-sm mt-3" style={{ color: TEXT_FAINT }}>
          Already a member?{' '}
          <Link
            href="/portal"
            className="underline underline-offset-2 transition-opacity hover:opacity-70"
            style={{ color: 'rgba(42,24,16,0.52)' }}
          >
            Log in
          </Link>
        </p>
      )}
    </div>
  )
}

// ── FAQ data ────────────────────────────────────────────────────────────────

const FAQS: Array<{ q: string; a: React.ReactNode }> = [
  {
    q: 'How much does it cost to join?',
    a: (
      <>
        Nothing. The Cellar Club is free to join — you just need to have bought at least one bottle through us to unlock the benefits. Tier perks (more concierge access, tasting tickets, discounts) scale with your rolling twelve-month spend.{' '}
        <Link href="/club" className="underline underline-offset-2 transition-opacity hover:opacity-70" style={{ color: TEXT_DARK }}>
          See tiers
        </Link>
        .
      </>
    ),
  },
  {
    q: 'How does delivery work?',
    a: 'Free once you fill a case (12 bottles). If you want something sooner, you can ship early for a flat £15.',
  },
  {
    q: 'Why use The Cellar Club instead of a normal wine shop?',
    a: "Better prices and better wines. We buy in volume across both our wine bars and pass the direct-import rates on to you. Most of what we stock isn't on supermarket shelves — it's sourced directly from small producers Daniel knows personally.",
  },
  {
    q: 'Can you help me source a specific bottle?',
    a: "Yes. Text Daniel with what you're after. If we can find it, we'll run an offer to the whole club — if enough members are in, everyone gets it at the group-buy price.",
  },
  {
    q: 'How is this different from a wine club?',
    a: "Normal wine clubs send you a box of whatever they've decided on that month. We send you individual offers by text, you choose which (if any) you want, and your bottles are stored for free until you've got enough for a case. You're also texting a real person, not a subscription form.",
  },
  {
    q: 'What does Daniel actually send?',
    a: 'Two wines a week, chosen by him. Range varies wildly — could be a £12 everyday drinker, could be a £60 one-off from a producer who only makes a few hundred cases. All of them are wines Daniel would happily pour for himself.',
  },
]

// ── Page ────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <div style={{ background: PAGE_BG, color: TEXT_DARK, minHeight: '100vh' }}>

      {/* ── Hero: logo + headline + subheading + form + demo ────────────── */}
      <section className="px-6 pt-5 md:pt-6 pb-10 md:pb-14">
        {/* Logo — centred above the two-column grid */}
        <div className="flex justify-center mb-3 md:mb-4">
          <Image
            src="/logo.png"
            alt="The Cellar Club"
            width={880}
            height={720}
            priority
            className="h-auto w-[155px] md:w-[192px]"
            style={{ mixBlendMode: 'multiply' }}
          />
        </div>

        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12 md:gap-16 items-center">

          {/* Left column: headline → sub → form */}
          <div>
            <DecoratedHeading text="Text your personal sommelier." />

            <div
              className="font-serif mb-7 space-y-3"
              style={{ fontSize: 'clamp(1.15rem, 2vw, 1.15rem)', color: TEXT_DARK }}
            >
              <p>Meet Daniel - former sommelier at the 2-Michelin-star Raby Hunt.</p>
              <p>He&apos;ll text you whenever he finds a sensational wine. Like the sound of it? Reply how many bottles.</p>
              <p>Need a pairing for Friday&apos;s dinner, a thoughtful gift, or that wine you can&apos;t stop thinking about from holiday? Text him.</p>
              <p>We store everything in our cellar and deliver it for free once you&apos;ve filled a case.</p>
            </div>

            <SignupForm buttonText="THIS WEEK'S WINE" />
            <p className="font-serif mt-3" style={{ fontSize: '0.88rem', color: TEXT_DARK }}>
              Free to join. You only pay for wines you order.
            </p>
            <p className="font-serif text-sm mt-2" style={{ color: TEXT_FAINT }}>
              Already a member?{' '}
              <a href="/portal" className="underline underline-offset-2 transition-opacity hover:opacity-70" style={{ color: 'rgba(42,24,16,0.52)' }}>
                Log in
              </a>
            </p>
          </div>

          {/* Right column: animated text demo */}
          <div className="flex justify-center md:justify-end">
            <TextDemo />
          </div>

        </div>
      </section>

      {/* ── A NOTE FROM DANIEL + letter card ────────────────────────────── */}
      <section className="px-6 py-10 md:py-12">
        <div className="max-w-2xl mx-auto">
          <FadeUp>
            <SectionTitle title="A Note From Daniel" />
            <div style={{ background: CARD_BG, border: `1px solid ${BORDER}` }} className="p-8 sm:p-10">
              <div
                className="font-serif space-y-5 leading-[1.75]"
                style={{ fontSize: 'clamp(1.05rem, 2vw, 1.12rem)', color: TEXT_DARK }}
              >
                <p>
                  I&apos;ve worked in wine for twenty years — sommelier at the 2-star Raby Hunt, Rockcliffe Hall, all that jazz. I think it&apos;s hard to call yourself a sommelier out loud without coming across like a complete tw**, so let&apos;s forget the labels.
                </p>

                <p>
                  All you need to know is I bloody love wine. Not the poncy, swirl-and-spit, guess-the-vintage kind. The kind where you open something on a Tuesday night and it makes you stop and go &ldquo;…what is that?&rdquo; That&apos;s the feeling I chase. That&apos;s what I text you about.
                </p>

                <p>
                  Twice a week, you&apos;ll get a message from me. Not a newsletter — an actual text, from my actual phone. Two wines I&apos;m genuinely excited about. Could be a Georgian amber wine that smells like your nan&apos;s garden. Could be something from a tiny producer in the Jura who only makes 200 cases a year. Could be a Texas red that has no business being as good as it is. I import a lot of this stuff directly, so you&apos;re getting prices most people can&apos;t.
                </p>

                <p>
                  Here&apos;s the thing that makes this different: you can text me back. Want a recommendation for a dinner party? I&apos;ll sort it. Looking for a special present for someone? Tell me and I&apos;ll find something. Want to see your favourite wine featured? If enough of you want it, everyone gets it at a price that&apos;d make a merchant weep.
                </p>

                <p>
                  I opened Crush wine bar in Durham a couple of years ago and just got the keys to a second place with a proper cellar. So your wine lives there, climate-controlled, no charge, until you&apos;ve filled a case. Then we ship it to you for free.
                </p>

                <p>
                  This kind of access — a direct line to someone who knows every winemaker worth knowing, free storage, direct import prices — it&apos;s usually reserved for people with land, lineage and names like Tarquin. I wanted to change that.
                </p>

                <p>
                  So welcome. Your cellar&apos;s ready. Text me anytime.
                </p>

                {/* Sign-off image */}
                <div className="mt-6">
                  <Image
                    src="/sign-off.png"
                    alt="Daniel Jonberger"
                    width={430}
                    height={430}
                    className="w-[180px] md:w-[220px] h-auto"
                    style={{ mixBlendMode: 'multiply' }}
                  />
                </div>
              </div>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ── GOOD TO KNOW + FAQ card ──────────────────────────────────────── */}
      <section className="px-6 py-10 md:py-12">
        <div className="max-w-2xl mx-auto">
          <FadeUp>
            <SectionTitle title="Good to Know" />
            <div style={{ background: CARD_BG, border: `1px solid ${BORDER}` }} className="px-8 py-8 sm:px-10">
              {FAQS.map((faq, i) => (
                <details
                  key={i}
                  className="group"
                  style={{ borderTop: i === 0 ? undefined : `1px solid ${BORDER}` }}
                >
                  <summary
                    className="flex items-center justify-between gap-4 py-4 cursor-pointer list-none font-serif select-none"
                    style={{ fontSize: 'clamp(1.05rem, 2vw, 1.15rem)', color: TEXT_DARK }}
                  >
                    <span>{faq.q}</span>
                    <span
                      className="shrink-0 leading-none transition-transform duration-200 group-open:rotate-45"
                      style={{ color: 'rgba(42,24,16,0.35)', fontSize: '1.4rem' }}
                      aria-hidden="true"
                    >
                      +
                    </span>
                  </summary>
                  <div
                    className="font-serif pb-4 leading-relaxed"
                    style={{ fontSize: 'clamp(1rem, 1.8vw, 1.08rem)', color: TEXT_DARK }}
                  >
                    {faq.a}
                  </div>
                </details>
              ))}
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ── THIS WEEK'S WINE + final CTA ────────────────────────────────── */}
      <section className="px-6 py-10 md:py-12">
        <div className="max-w-lg mx-auto">
          <FadeUp>
            <SectionTitle title="This Week's Wine" />
            <div className="flex justify-center">
              <SignupForm buttonText="JOIN THE CLUB" />
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer
        className="px-6 pt-8 pb-10 text-center"
        style={{ borderTop: `1px solid ${BORDER}` }}
      >
        <div className="max-w-2xl mx-auto space-y-2">
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
      </footer>

    </div>
  )
}
