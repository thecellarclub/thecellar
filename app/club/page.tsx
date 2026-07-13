import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'How the Club works — The Cellar Club',
}

const PAGE_BG  = '#E6D9CA'
const CARD_BG  = '#F2EAE0'
const TEXT_DARK = '#1C0E09'
const BORDER   = 'rgba(42,24,16,0.18)'
const ACCENT   = '#9B1B30'

function LadderRow({
  caseNumber,
  eyebrow,
  reward,
  detail,
  isTier,
}: {
  caseNumber: number
  eyebrow?: string
  reward: string
  detail?: string
  isTier: boolean
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
        {eyebrow && (
          <p
            className="font-sans text-xs uppercase tracking-[0.2em] mb-1"
            style={{ color: ACCENT }}
          >
            {eyebrow}
          </p>
        )}
        <p
          className={`font-serif ${isTier ? '' : 'italic'}`}
          style={{ fontSize: '1.05rem', color: TEXT_DARK }}
        >
          {reward}
        </p>
        {detail && (
          <p
            className="font-sans"
            style={{ fontSize: '0.85rem', color: 'rgba(42,24,16,0.5)', marginTop: '0.35rem' }}
          >
            {detail}
          </p>
        )}
      </div>
    </div>
  )
}

const LADDER = [
  {
    caseNumber: 1,
    reward: 'A free-shipping voucher — your next shipment goes free at just 6 bottles.',
    isTier: false,
  },
  {
    caseNumber: 2,
    eyebrow: 'New tier: Bailey',
    reward: "You're Bailey. 5% of every order back as credit, delivery drops to £7.",
    isTier: true,
  },
  {
    caseNumber: 3,
    reward: 'Six Riedel glasses, or two tasting tickets — your pick.',
    detail: 'Two tasting tickets: two tickets to use at our wine tasting events (redeemable anytime).',
    isTier: false,
  },
  {
    caseNumber: 4,
    eyebrow: 'New tier: Elvet',
    reward: "You're Elvet. Credit back doubles to 10%, delivery drops to £5.",
    isTier: true,
  },
  {
    caseNumber: 5,
    reward: 'A free bottle chosen by Daniel, or two tasting tickets.',
    detail: 'Two tasting tickets: two tickets to use at our wine tasting events (redeemable anytime).',
    isTier: false,
  },
  {
    caseNumber: 6,
    eyebrow: 'New tier: Palatine',
    reward: "You're Palatine. Wine texts two hours before everyone else — and a Coravin.",
    detail: 'A Coravin lets you pour a glass and taste a wine without ever pulling the cork, so the rest of the bottle stays fresh — a timeless piece of kit you\'ll use for years.',
    isTier: true,
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
              Free to join. Buy wine by text, build cases of twelve — and every case you
              complete unlocks a reward.
            </p>
          </div>

          {/* 2. How it works */}
          <div className="mb-10">
            <ol className="space-y-3">
              <li className="font-serif" style={{ fontSize: '1.05rem' }}>
                <span style={{ color: ACCENT }}>1.</span>{' '}
                Daniel texts you wines. You reply to buy — bottles wait in the cellar.
              </li>
              <li className="font-serif" style={{ fontSize: '1.05rem' }}>
                <span style={{ color: ACCENT }}>2.</span>{' '}
                Twelve bottles make a case. Cases ship free; fewer bottles ship from £5.
              </li>
              <li className="font-serif" style={{ fontSize: '1.05rem' }}>
                <span style={{ color: ACCENT }}>3.</span>{' '}
                Every case you complete earns you something. Here&rsquo;s the ladder.
              </li>
            </ol>
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

          {/* 5. Credit, plainly */}
          <div className="mb-10">
            <h2 className="font-serif text-xl mb-3" style={{ color: TEXT_DARK }}>Credit, not coupons.</h2>
            <p className="font-serif" style={{ fontSize: '1.05rem', color: 'rgba(42,24,16,0.7)' }}>
              Your rebate lands as credit on your account — real money against your next
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
              The gifts on the ladder — the glasses, the bottle, the Coravin — are
              lifetime milestones. You earn each one once, it&rsquo;s yours, and it&rsquo;s
              never taken back. The gift shelf changes from year to year, so there&rsquo;s
              always something new ahead of you.
            </p>
          </div>

          {/* 7. Your membership year */}
          <div>
            <h2 className="font-serif text-xl mb-3" style={{ color: TEXT_DARK }}>How the year works.</h2>
            <p className="font-serif" style={{ fontSize: '1.05rem', color: 'rgba(42,24,16,0.7)' }}>
              Your case count runs over your membership year — twelve months from your
              first case. When your anniversary comes round, the count starts fresh for
              the new year, and your tier eases down a single step at most: Palatine
              begins the new year as Elvet, Elvet as Bailey. Bailey is yours for good.
              Your credit and your gifts are untouched — only the climb resets. Order
              like you did last year and you&rsquo;ll be back where you were (and
              collecting anything on the ladder you haven&rsquo;t earned yet).
            </p>
          </div>

          {/* 8. Footnote */}
          <p className="font-serif italic text-sm mt-8" style={{ color: 'rgba(42,24,16,0.40)' }}>
            Tiers update automatically as you order — you&rsquo;ll get a text when you
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
