import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Membership Tiers — The Cellar Club',
}

const PAGE_BG  = '#E6D9CA'
const CARD_BG  = '#F2EAE0'
const TEXT_DARK = '#1C0E09'
const BORDER   = 'rgba(42,24,16,0.18)'

function PerkEntry({ name, value }: { name: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2 mb-2.5">
      <span className="font-serif text-base shrink-0" style={{ color: 'rgba(42,24,16,0.55)' }}>
        {name}
      </span>
      <span
        className="flex-1 min-w-0"
        style={{ borderBottom: '1px dotted rgba(42,24,16,0.13)', marginBottom: '0.25em' }}
      />
      <span className="font-serif text-base shrink-0 text-right" style={{ color: 'rgba(155,27,48,0.7)' }}>
        {value}
      </span>
    </div>
  )
}

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

          {/* Header */}
          <div className="text-center mb-10">
            <p
              className="font-sans text-xs uppercase tracking-[0.28em] mb-3"
              style={{ color: 'rgba(42,24,16,0.38)' }}
            >
              The Club
            </p>
            <h1 className="font-serif text-3xl" style={{ color: TEXT_DARK }}>Membership tiers</h1>
            <p className="font-serif italic mt-3" style={{ fontSize: '1.05rem', color: 'rgba(42,24,16,0.55)' }}>
              Free to join. Perks scale with your rolling twelve-month spend.
            </p>
          </div>

          {/* Tier: Elvet */}
          <div className="mb-10">
            <div className="flex items-baseline gap-3 mb-1">
              <span className="font-serif text-xl" style={{ color: TEXT_DARK }}>Elvet</span>
              <span
                className="flex-1 min-w-0"
                style={{ borderBottom: '1px dotted rgba(42,24,16,0.2)', marginBottom: '0.3em' }}
              />
              <span className="font-serif text-lg shrink-0" style={{ color: '#9B1B30' }}>free to join</span>
            </div>
            <div className="mt-4">
              <PerkEntry name="Wine texts" value="2 / week" />
              <PerkEntry name="Concierge requests" value="2 / month" />
              <PerkEntry name="Wine requests" value="unlimited" />
              <PerkEntry name="Free delivery" value="per 12 bottles" />
            </div>
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px solid rgba(42,24,16,0.10)' }} className="my-8" />

          {/* Tier: Bailey */}
          <div className="mb-10">
            <div className="flex items-baseline gap-3 mb-1">
              <span className="font-serif text-xl" style={{ color: TEXT_DARK }}>Bailey</span>
              <span
                className="flex-1 min-w-0"
                style={{ borderBottom: '1px dotted rgba(42,24,16,0.2)', marginBottom: '0.3em' }}
              />
              <span className="font-serif text-lg shrink-0" style={{ color: '#9B1B30' }}>from £500 / year</span>
            </div>
            <div className="mt-4">
              <PerkEntry name="Wine texts" value="2 / week" />
              <PerkEntry name="Concierge requests" value="5 / month" />
              <PerkEntry name="Wine requests" value="unlimited" />
              <PerkEntry name="Tasting tickets" value="2 / year" />
              <PerkEntry name="Discount" value="5%" />
              <PerkEntry name="Free delivery" value="per 12 bottles" />
            </div>
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px solid rgba(42,24,16,0.10)' }} className="my-8" />

          {/* Tier: Palatine */}
          <div className="mb-6">
            <div className="flex items-baseline gap-3 mb-1">
              <span className="font-serif text-xl" style={{ color: TEXT_DARK }}>Palatine</span>
              <span
                className="flex-1 min-w-0"
                style={{ borderBottom: '1px dotted rgba(42,24,16,0.2)', marginBottom: '0.3em' }}
              />
              <span className="font-serif text-lg shrink-0" style={{ color: '#9B1B30' }}>from £1,000 / year</span>
            </div>
            <div className="mt-4">
              <PerkEntry name="Wine texts" value="2 / week (2 hrs early)" />
              <PerkEntry name="Concierge requests" value="unlimited" />
              <PerkEntry name="Wine requests" value="unlimited" />
              <PerkEntry name="Tasting tickets" value="4 / year" />
              <PerkEntry name="Discount" value="10%" />
              <PerkEntry name="Free delivery" value="per 6 bottles" />
            </div>
          </div>

          {/* Note */}
          <p className="font-serif italic text-sm mt-8" style={{ color: 'rgba(42,24,16,0.40)' }}>
            Tiers are calculated on your rolling twelve-month spend and update automatically.
          </p>

        </div>

        {/* CTA */}
        <div className="text-center mt-8">
          <Link
            href="/join"
            className="group inline-block font-sans font-medium px-8 py-3.5 transition-all duration-150 hover:opacity-90"
            style={{ background: '#9B1B30', color: '#F0E6DC' }}
          >
            Join the Club{' '}
            <span className="inline-block transition-transform duration-150 group-hover:translate-x-[3px]">→</span>
          </Link>
        </div>

      </div>
    </div>
  )
}
