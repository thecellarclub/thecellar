import Link from 'next/link'
import type { Metadata } from 'next'
import { TIER_PERKS } from '@/lib/tiers'

export const metadata: Metadata = {
  title: 'How the Club works - The Cellar Club',
}

const PAGE_BG  = '#E6D9CA'
const CARD_BG  = '#F2EAE0'
const TEXT_DARK = '#1C0E09'
const BORDER   = 'rgba(42,24,16,0.18)'
const ACCENT   = '#9B1B30'

function LadderRow({
  caseNumber,
  eyebrow,
  text,
}: {
  caseNumber: number
  eyebrow: string
  text: string
}) {
  return (
    <div className="flex gap-4 py-4" style={{ borderBottom: '1px dotted rgba(42,24,16,0.13)' }}>
      <span
        className="font-serif shrink-0 leading-none"
        style={{ color: ACCENT, fontSize: '2rem', minWidth: '2.5rem' }}
      >
        {caseNumber}
      </span>
      <div className="min-w-0">
        <p
          className="font-sans text-xs uppercase tracking-[0.2em] mb-1"
          style={{ color: ACCENT }}
        >
          {eyebrow}
        </p>
        <p
          className="font-serif"
          style={{ fontSize: '1.05rem', color: TEXT_DARK }}
        >
          {text}
        </p>
      </div>
    </div>
  )
}

/** Dotted-leader label/value row, used inside each tier detail block. */
function PerkEntry({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2" style={{ borderBottom: '1px dotted rgba(42,24,16,0.13)' }}>
      <span className="font-sans text-sm" style={{ color: 'rgba(42,24,16,0.65)' }}>{label}</span>
      <span className="font-serif shrink-0" style={{ fontSize: '1.05rem', color: TEXT_DARK }}>{value}</span>
    </div>
  )
}

function TierBlock({
  name,
  cases,
  perks,
}: {
  name: string
  cases: string
  perks: { label: string; value: string }[]
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="font-serif text-lg" style={{ color: TEXT_DARK }}>{name}</h3>
        <span className="font-sans text-xs uppercase tracking-[0.15em]" style={{ color: ACCENT }}>{cases}</span>
      </div>
      {perks.map((p) => (
        <PerkEntry key={p.label} label={p.label} value={p.value} />
      ))}
    </div>
  )
}

const LADDER: { caseNumber: number; eyebrow: string; text: string }[] = [
  { caseNumber: 1, eyebrow: 'Gift', text: 'A free shipping voucher - your next shipment goes free at just 6 bottles.' },
  { caseNumber: 2, eyebrow: 'New tier: Bailey', text: "5% of every order back as credit, deliver less than a case for £7." },
  { caseNumber: 3, eyebrow: 'Gift', text: 'A free bottle chosen by Daniel, or 2 tasting tickets.' },
  { caseNumber: 4, eyebrow: 'New tier: Elvet', text: '7% of every order back as credit, deliver less than a case for £5.' },
  { caseNumber: 5, eyebrow: 'Gift', text: 'Six Riedel glasses, or 2 tasting tickets.' },
  { caseNumber: 6, eyebrow: 'New tier: Palatine', text: '10% of every order back as credit, get texts two hours before everyone else, free shipping of any amount anytime.' },
  { caseNumber: 7, eyebrow: 'Gift', text: 'A Coravin Timeless, or 4 tasting tickets.' },
]

const TIERS: { name: string; cases: string; perks: { label: string; value: string }[] }[] = [
  { name: 'Bailey', cases: '2 cases', perks: TIER_PERKS.bailey },
  { name: 'Elvet', cases: '4 cases', perks: TIER_PERKS.elvet },
  { name: 'Palatine', cases: '6 cases', perks: TIER_PERKS.palatine },
]

export default function ClubPage() {
  return (
    <div style={{ background: PAGE_BG, color: TEXT_DARK, minHeight: '100vh' }}>
      <div className="max-w-2xl mx-auto pt-10 pb-16 px-4 sm:px-6">

        {/* Back link */}
        <Link
          href="/"
          className="inline-block font-sans text-sm mb-8 transition-opacity hover:opacity-60"
          style={{ color: 'rgba(42,24,16,0.45)' }}
        >
          ← Back to home
        </Link>

        <div style={{ background: CARD_BG, border: `1px solid ${BORDER}` }} className="p-8 sm:p-10">

          {/* 1. Header */}
          <div className="text-center mb-10">
            <p
              className="font-sans text-xs uppercase tracking-[0.28em] mb-3"
              style={{ color: 'rgba(42,24,16,0.38)' }}
            >
              The Club
            </p>
            <h1 className="font-serif text-3xl" style={{ color: TEXT_DARK }}>Every case earns something</h1>
            <p className="font-serif italic mt-3" style={{ fontSize: '1.05rem', color: 'rgba(42,24,16,0.55)' }}>
              Free to join. Reply how many bottles you want by text. Every case you
              complete unlocks a reward.
            </p>
          </div>

          {/* 3. The ladder */}
          <div className="mb-10">
            <p
              className="font-sans text-xs uppercase tracking-[0.28em] mb-2"
              style={{ color: 'rgba(42,24,16,0.38)' }}
            >
              The Ladder
            </p>
            <p className="font-serif mb-6" style={{ fontSize: '1.05rem', color: 'rgba(42,24,16,0.7)' }}>
              Each number below is a completed case, 12 bottles.
            </p>
            {LADDER.map((row) => (
              <LadderRow key={row.caseNumber} {...row} />
            ))}
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px solid rgba(42,24,16,0.10)' }} className="my-8" />

          {/* 4. Tier detail */}
          <div className="mb-10 space-y-8">
            <p
              className="font-sans text-xs uppercase tracking-[0.28em]"
              style={{ color: 'rgba(42,24,16,0.38)' }}
            >
              The Tiers
            </p>
            {TIERS.map((tier) => (
              <TierBlock key={tier.name} {...tier} />
            ))}
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px solid rgba(42,24,16,0.10)' }} className="my-8" />

          {/* 5. In plain English */}
          <div className="mb-10 space-y-8">
            <p
              className="font-sans text-xs uppercase tracking-[0.28em]"
              style={{ color: 'rgba(42,24,16,0.38)' }}
            >
              In Plain English
            </p>

            <div>
              <h2
                className="font-sans text-xs uppercase tracking-[0.2em] mb-3"
                style={{ color: ACCENT }}
              >
                Credit, not coupons.
              </h2>
              <p className="font-serif" style={{ fontSize: '1.05rem', color: 'rgba(42,24,16,0.7)' }}>
                Your rebate lands as credit on your account - real money against your next
                order. When you order and have credit, we&rsquo;ll offer it automatically:
                reply BALANCE and it covers as much of the order as it can, with any
                remainder going to your card. Text BALANCE any time to check what
                you&rsquo;ve got. Credit never expires.
              </p>
            </div>

            <div>
              <h2
                className="font-sans text-xs uppercase tracking-[0.2em] mb-3"
                style={{ color: ACCENT }}
              >
                Earn it once, keep it.
              </h2>
              <p className="font-serif" style={{ fontSize: '1.05rem', color: 'rgba(42,24,16,0.7)' }}>
                The gifts on the ladder - the glasses, the bottle, the Coravin - are
                lifetime milestones. You earn each one once, it&rsquo;s yours, and it&rsquo;s
                never taken back. The gift shelf changes from year to year, so there&rsquo;s
                always something new ahead of you.
              </p>
            </div>

            <div>
              <h2
                className="font-sans text-xs uppercase tracking-[0.2em] mb-3"
                style={{ color: ACCENT }}
              >
                How the year works.
              </h2>
              <p className="font-serif" style={{ fontSize: '1.05rem', color: 'rgba(42,24,16,0.7)' }}>
                Your climb runs over your membership year - twelve months from your first
                order, the day you began your first case. When your anniversary comes
                round, you step back to the tier below where you finished - Palatine
                begins the new year as Elvet, Elvet as Bailey, and Bailey is yours for
                good - then climb on from there: every case still moves you up one rung.
                Your credit and your gifts are untouched. Order like you did last year
                and you&rsquo;ll be back where you were, collecting the new rewards we put
                on the ladder each year.
              </p>
            </div>
          </div>

          {/* 8. Footnote */}
          <p className="font-serif italic text-sm mt-8" style={{ color: 'rgba(42,24,16,0.40)' }}>
            Tiers update automatically as you order - you&rsquo;ll get a text when you
            move up. One case = 12 bottles.
          </p>

        </div>

        {/* CTA */}
        <div className="text-center mt-8">
          <Link
            href="/join"
            className="group inline-block font-sans font-medium px-8 py-3.5 transition-all duration-150 hover:opacity-90"
            style={{ background: ACCENT, color: '#F0E6DC' }}
          >
            Join the Club{' '}
            <span className="inline-block transition-transform duration-150 group-hover:translate-x-[3px]">→</span>
          </Link>
        </div>

      </div>
    </div>
  )
}
