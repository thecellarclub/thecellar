import Link from 'next/link'
import type { Metadata } from 'next'

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
  isTier,
  text,
}: {
  caseNumber: number
  eyebrow: string
  isTier: boolean
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
          style={{ fontSize: '1.05rem', color: TEXT_DARK, fontWeight: isTier ? 600 : 400 }}
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

const LADDER: { caseNumber: number; eyebrow: string; isTier: boolean; text: string }[] = [
  { caseNumber: 1, eyebrow: 'Gift', isTier: false, text: 'A free shipping voucher - your next shipment goes free at just 6 bottles.' },
  { caseNumber: 2, eyebrow: 'New tier: Bailey', isTier: true, text: "5% of every order back as credit, deliver less than a case for £7." },
  { caseNumber: 3, eyebrow: 'Gift', isTier: false, text: 'A free bottle chosen by Daniel, or two tickets to our wine tasting events.' },
  { caseNumber: 4, eyebrow: 'New tier: Elvet', isTier: true, text: '7% of every order back as credit, deliver less than a case for £5.' },
  { caseNumber: 5, eyebrow: 'Gift', isTier: false, text: 'Six Riedel glasses, or two tickets to our wine tasting events.' },
  { caseNumber: 6, eyebrow: 'New tier: Palatine', isTier: true, text: '10% of every order back as credit, get texts two hours before everyone else, free shipping of any amount anytime.' },
  { caseNumber: 7, eyebrow: 'Gift', isTier: false, text: 'A Coravin Timeless - so you can try your wine without removing the cork.' },
]

const TIERS: { name: string; cases: string; perks: { label: string; value: string }[] }[] = [
  {
    name: 'Bailey',
    cases: '2 cases',
    perks: [
      { label: 'Credit back', value: '5% of every order' },
      { label: 'Delivery (under a case)', value: '£7' },
      { label: 'Wine texts', value: '2 / week' },
      { label: 'Concierge requests', value: '2 / month' },
    ],
  },
  {
    name: 'Elvet',
    cases: '4 cases',
    perks: [
      { label: 'Credit back', value: '7% of every order' },
      { label: 'Delivery (under a case)', value: '£5' },
      { label: 'Wine texts', value: '2 / week' },
      { label: 'Concierge requests', value: '5 / month' },
    ],
  },
  {
    name: 'Palatine',
    cases: '6 cases',
    perks: [
      { label: 'Credit back', value: '10% of every order' },
      { label: 'Shipping', value: 'free, any amount, anytime' },
      { label: 'Wine texts', value: '2 / week, 2 hrs early' },
      { label: 'Concierge requests', value: 'unlimited' },
    ],
  },
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
              Free to join. Buy wine by text, build cases of twelve - and every case you
              complete unlocks a reward.
            </p>
          </div>

          {/* 2. How it works */}
          <div className="mb-10 space-y-3">
            <p className="font-serif" style={{ fontSize: '1.05rem', color: 'rgba(42,24,16,0.7)' }}>
              1. Daniel texts you wines. You reply to buy - bottles wait in the cellar.
            </p>
            <p className="font-serif" style={{ fontSize: '1.05rem', color: 'rgba(42,24,16,0.7)' }}>
              2. Twelve bottles make a case. Cases ship free; fewer bottles ship from £5.
            </p>
            <p className="font-serif" style={{ fontSize: '1.05rem', color: 'rgba(42,24,16,0.7)' }}>
              3. Every case you complete earns you something. Here&rsquo;s the ladder.
            </p>
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px solid rgba(42,24,16,0.10)' }} className="my-8" />

          {/* 3. The ladder */}
          <div className="mb-10">
            {LADDER.map((row) => (
              <LadderRow key={row.caseNumber} {...row} />
            ))}
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px solid rgba(42,24,16,0.10)' }} className="my-8" />

          {/* 4. Tier detail */}
          <div className="mb-10 space-y-8">
            {TIERS.map((tier) => (
              <TierBlock key={tier.name} {...tier} />
            ))}
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px solid rgba(42,24,16,0.10)' }} className="my-8" />

          {/* 5. Credit, plainly */}
          <div className="mb-10">
            <h2 className="font-serif text-xl mb-3" style={{ color: TEXT_DARK }}>Credit, not coupons.</h2>
            <p className="font-serif" style={{ fontSize: '1.05rem', color: 'rgba(42,24,16,0.7)' }}>
              Your rebate lands as credit on your account - real money against your next
              order. When you order and have credit, we&rsquo;ll offer it automatically:
              reply BALANCE and it covers as much of the order as it can, with any
              remainder going to your card. Text BALANCE any time to check what
              you&rsquo;ve got. Credit never expires.
            </p>
          </div>

          {/* 6. Gifts are forever */}
          <div className="mb-10">
            <h2 className="font-serif text-xl mb-3" style={{ color: TEXT_DARK }}>Earn it once, keep it.</h2>
            <p className="font-serif" style={{ fontSize: '1.05rem', color: 'rgba(42,24,16,0.7)' }}>
              The gifts on the ladder - the glasses, the bottle, the Coravin - are
              lifetime milestones. You earn each one once, it&rsquo;s yours, and it&rsquo;s
              never taken back. The gift shelf changes from year to year, so there&rsquo;s
              always something new ahead of you.
            </p>
          </div>

          {/* 7. Your membership year */}
          <div>
            <h2 className="font-serif text-xl mb-3" style={{ color: TEXT_DARK }}>How the year works.</h2>
            <p className="font-serif" style={{ fontSize: '1.05rem', color: 'rgba(42,24,16,0.7)' }}>
              Your case count runs over your membership year - twelve months from your
              first order, the day you began your first case. When your anniversary
              comes round, the count starts fresh for the new year, and your tier eases
              down a single step at most: Palatine begins the new year as Elvet, Elvet
              as Bailey. Bailey is yours for good. Your credit and your gifts are
              untouched - only the climb resets. Order like you did last year and
              you&rsquo;ll be back where you were, collecting the new rewards we put on
              the ladder each year.
            </p>
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
