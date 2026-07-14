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
  blocks,
}: {
  caseNumber: number
  blocks: { eyebrow: string; text: string; italic?: boolean }[]
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
        {blocks.map((block, i) => (
          <div key={i} className={i > 0 ? 'mt-3' : ''}>
            <p
              className="font-sans text-xs uppercase tracking-[0.2em] mb-1"
              style={{ color: ACCENT }}
            >
              {block.eyebrow}
            </p>
            <p
              className={`font-serif ${block.italic ? 'italic' : ''}`}
              style={{ fontSize: '1.05rem', color: TEXT_DARK }}
            >
              {block.text}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

const LADDER = [
  {
    caseNumber: 1,
    blocks: [
      { eyebrow: 'Gift', text: 'A free-shipping voucher - your next shipment goes free at just 6 bottles.', italic: true },
    ],
  },
  {
    caseNumber: 2,
    blocks: [
      { eyebrow: 'New tier: Bailey', text: '5% of every order back as credit, deliver less than a case for £7.' },
    ],
  },
  {
    caseNumber: 3,
    blocks: [
      { eyebrow: 'Gift', text: 'A free bottle chosen by Daniel, or two tasting tickets.', italic: true },
    ],
  },
  {
    caseNumber: 4,
    blocks: [
      { eyebrow: 'New tier: Elvet', text: 'Credit back doubles to 10%, deliver less than a case for £5.' },
    ],
  },
  {
    caseNumber: 5,
    blocks: [
      { eyebrow: 'Gift', text: 'Six Riedel glasses, or two tasting tickets - your pick.', italic: true },
    ],
  },
  {
    caseNumber: 6,
    blocks: [
      { eyebrow: 'New tier: Palatine', text: 'Get texts two hours before everyone else & free shipping anytime.' },
      { eyebrow: 'Gift', text: 'Coravin Timeless (a device to try your wine without removing the cork).', italic: true },
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
          <div className="mb-10">
            <p className="font-serif" style={{ fontSize: '1.05rem' }}>
              Reply to any text with the number of bottles you want. Once you reach 12
              bottles, it always ships free. You can ship anytime earlier for a small
              fee. Every 12 bottles purchased unlocks a new Cellar Club Reward.
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

          {/* 5. Credit, plainly */}
          <div className="mb-10">
            <h2 className="font-serif text-xl mb-3" style={{ color: TEXT_DARK }}>Credit, not coupons.</h2>
            <p className="font-serif" style={{ fontSize: '1.05rem', color: 'rgba(42,24,16,0.7)' }}>
              Every time you spend, you earn credit back into your account. Use it
              against your next order or save it up for something special.
              We&rsquo;ll give you the chance to spend it whenever you&rsquo;re placing
              an order, if it doesn&rsquo;t cover it all, the remainder is charged to
              your card like normal. Text BALANCE any time to check what
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
              first case. When your anniversary comes round, the count starts fresh for
              the new year, and your tier eases down a single step at most: Palatine
              begins the new year as Elvet, Elvet as Bailey. Bailey is yours for good.
              Your credit and your gifts are untouched - only the climb resets. Order
              like you did last year and you&rsquo;ll be back where you were (and
              collecting anything on the ladder you haven&rsquo;t earned yet).
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
