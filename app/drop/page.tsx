import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { createServiceClient } from '@/lib/supabase'
import { DropSignupForm } from './DropSignupForm'
import { DropPhoneMockup } from './DropPhoneMockup'

export const metadata: Metadata = {
  title: 'The Drop — 48 bottles, twice a week | The Cellar Club',
  description: "A real sommelier texts you a wine drop twice a week. Reply how many bottles you want — first come, first served. Trade prices, direct import.",
}

// Wine showcase + sell-out stat are live data — without this, Next.js
// prerenders the page once at build time and the numbers go stale until the
// next deploy, exactly what the spec's "don't hard-code stale numbers" rule
// is about. Hourly revalidation keeps it fresh without a DB hit per visitor.
export const revalidate = 3600

const PAGE_BG   = '#EDE8DF'
const CARD_BG   = '#F5EFE6'
const TEXT_DARK = '#1C0E09'
const TEXT_FAINT = 'rgba(42,24,16,0.40)'
const BORDER    = 'rgba(42,24,16,0.18)'
const ACCENT    = '#9B1B30'

// Wines below this price are pre-launch test fixtures (real drops are never
// under £5) — filtered out so a stray test row never surfaces here.
const MIN_REAL_PRICE_PENCE = 500

type ShowcaseWine = {
  id: string
  name: string
  region: string | null
  country: string | null
  price_pence: number
  stock_bottles: number
}

async function getDropData() {
  const sb = createServiceClient()

  const { data: rows } = await sb
    .from('texts')
    .select('sent_at, wine_id, wines(id, name, region, country, price_pence, stock_bottles)')
    .order('sent_at', { ascending: false })
    .limit(50)

  const seen = new Set<string>()
  const distinctWines: ShowcaseWine[] = []

  for (const row of rows ?? []) {
    const wine = row.wines as unknown as ShowcaseWine | null
    if (!wine || seen.has(wine.id)) continue
    if (wine.price_pence < MIN_REAL_PRICE_PENCE) continue
    seen.add(wine.id)
    distinctWines.push(wine)
  }

  // Sample for the sell-out stat: a wider, more credible window.
  const statSample = distinctWines.slice(0, 20)
  const soldOutCount = statSample.filter((w) => w.stock_bottles === 0).length

  // Showcase: the most recent handful, for the "recently sent" strip.
  const showcase = distinctWines.slice(0, 6)

  return {
    showcase,
    soldOutCount,
    sampleSize: statSample.length,
  }
}

export default async function DropPage() {
  const { showcase, soldOutCount, sampleSize } = await getDropData()

  return (
    <div style={{ background: PAGE_BG, color: TEXT_DARK, minHeight: '100vh' }}>

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="px-6 pt-10 md:pt-14 pb-10 md:pb-14">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12 md:gap-16 items-center">

          <div>
            <p
              className="font-sans text-xs uppercase tracking-[0.28em] mb-4"
              style={{ color: ACCENT }}
            >
              The Drop
            </p>
            <h1
              className="font-serif uppercase leading-tight mb-5"
              style={{ color: TEXT_DARK, letterSpacing: '0.03em', fontSize: 'clamp(2rem, 4.5vw, 2.75rem)' }}
            >
              48 bottles. Twice a week.<br />Usually gone within the hour.
            </h1>

            <div className="font-serif mb-7 space-y-3" style={{ fontSize: 'clamp(1.1rem, 2vw, 1.15rem)' }}>
              <p>
                Daniel — former sommelier at the 2-Michelin-star Raby Hunt — texts the drop
                himself, twice a week. Fancy it? Reply how many bottles. First come, first served.
              </p>
              <p>
                We import direct, so you get trade prices. No middleman, no markup for the label.
              </p>
            </div>

            <Suspense fallback={null}>
              <DropSignupForm />
            </Suspense>
            <p className="font-serif mt-3" style={{ fontSize: '0.88rem', color: TEXT_DARK }}>
              Free to join. You only pay for wines you order.
            </p>

            {sampleSize > 0 && (
              <p className="font-sans text-xs mt-4 uppercase tracking-wide" style={{ color: TEXT_FAINT }}>
                {soldOutCount} of the last {sampleSize} drops have already sold out.
              </p>
            )}
          </div>

          <div className="flex justify-center md:justify-end">
            <DropPhoneMockup />
          </div>

        </div>
      </section>

      {/* ── Recently sent ────────────────────────────────────────────── */}
      {showcase.length > 0 && (
        <section className="px-6 py-10 md:py-12">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center gap-4 mb-7 justify-center">
              <div className="w-24 h-px shrink-0" style={{ background: 'rgba(100,50,20,0.2)' }} />
              <p className="font-sans text-sm uppercase tracking-[0.28em] shrink-0" style={{ color: 'rgba(42,24,16,0.65)' }}>
                Members Recently Received
              </p>
              <div className="w-24 h-px shrink-0" style={{ background: 'rgba(100,50,20,0.2)' }} />
            </div>

            <div style={{ background: CARD_BG, border: `1px solid ${BORDER}` }} className="px-8 py-2 sm:px-10">
              {showcase.map((wine, i) => (
                <div
                  key={wine.id}
                  className="flex items-baseline justify-between gap-4 py-4"
                  style={{ borderTop: i === 0 ? undefined : `1px solid ${BORDER}` }}
                >
                  <div className="min-w-0">
                    <p className="font-serif" style={{ fontSize: '1.05rem', color: TEXT_DARK }}>{wine.name}</p>
                    {(wine.region || wine.country) && (
                      <p className="font-sans text-xs mt-0.5" style={{ color: TEXT_FAINT }}>
                        {[wine.region, wine.country].filter(Boolean).join(', ')}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-serif" style={{ fontSize: '1.05rem', color: TEXT_DARK }}>
                      £{(wine.price_pence / 100).toFixed(0)}
                    </p>
                    <p
                      className="font-sans text-xs uppercase tracking-wide mt-0.5"
                      style={{ color: wine.stock_bottles === 0 ? ACCENT : TEXT_FAINT }}
                    >
                      {wine.stock_bottles === 0 ? 'Sold out' : `${wine.stock_bottles} left`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── How it works ─────────────────────────────────────────────── */}
      <section className="px-6 py-10 md:py-12">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-7 justify-center">
            <div className="w-24 h-px shrink-0" style={{ background: 'rgba(100,50,20,0.2)' }} />
            <p className="font-sans text-sm uppercase tracking-[0.28em] shrink-0" style={{ color: 'rgba(42,24,16,0.65)' }}>
              How It Works
            </p>
            <div className="w-24 h-px shrink-0" style={{ background: 'rgba(100,50,20,0.2)' }} />
          </div>

          <div style={{ background: CARD_BG, border: `1px solid ${BORDER}` }} className="px-8 py-8 sm:px-10">
            <ol className="space-y-5">
              {[
                'Daniel texts the drop — 48 bottles, twice a week.',
                'Reply how many you want. First come, first served.',
                "We store it free until you've got a case, then ship for free.",
              ].map((line, i) => (
                <li key={i} className="flex gap-4 items-baseline">
                  <span className="font-serif shrink-0" style={{ color: ACCENT, fontSize: '1.3rem', minWidth: '1.5rem' }}>
                    {i + 1}
                  </span>
                  <span className="font-serif" style={{ fontSize: '1.05rem', color: TEXT_DARK }}>{line}</span>
                </li>
              ))}
            </ol>

            <p className="font-serif italic mt-6 pt-6 border-t" style={{ borderColor: BORDER, fontSize: '0.95rem', color: 'rgba(42,24,16,0.6)' }}>
              Every case you complete unlocks credit back and member perks.{' '}
              <Link href="/club" className="underline underline-offset-2 transition-opacity hover:opacity-70" style={{ color: TEXT_DARK }}>
                See how membership works →
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────── */}
      <section className="px-6 py-10 md:py-12">
        <div className="max-w-lg mx-auto flex flex-col items-center">
          <p className="font-sans text-sm uppercase tracking-[0.28em] mb-6" style={{ color: 'rgba(42,24,16,0.65)' }}>
            Don&apos;t Miss The Next One
          </p>
          <Suspense fallback={null}>
            <DropSignupForm buttonText="JOIN THE CLUB" />
          </Suspense>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="px-6 pt-8 pb-10 text-center" style={{ borderTop: `1px solid ${BORDER}` }}>
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
            <Link href="/privacy" className="font-sans text-xs underline underline-offset-2 transition-opacity hover:opacity-70" style={{ color: 'rgba(42,24,16,0.38)' }}>
              Privacy Policy
            </Link>
            <Link href="/terms" className="font-sans text-xs underline underline-offset-2 transition-opacity hover:opacity-70" style={{ color: 'rgba(42,24,16,0.38)' }}>
              Terms &amp; Conditions
            </Link>
          </div>
        </div>
      </footer>

    </div>
  )
}
