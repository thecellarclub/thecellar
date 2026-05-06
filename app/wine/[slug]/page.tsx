import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase'

const PAGE_BG    = '#EDE8DF'
const CARD_BG    = '#F5EFE6'
const TEXT_DARK  = '#1C0E09'
const TEXT_FAINT = 'rgba(42,24,16,0.40)'
const BORDER     = 'rgba(42,24,16,0.18)'
const ACCENT     = '#9B1B30'

function formatPrice(pence: number): string {
  const pounds = pence / 100
  return pounds % 1 === 0 ? `£${pounds}` : `£${pounds.toFixed(2)}`
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const sb = createServiceClient()
  const { data: wine } = await sb
    .from('wines')
    .select('name, vintage, website_description, image_url')
    .eq('slug', slug)
    .eq('active', true)
    .maybeSingle()

  if (!wine) return {}

  const title = `${wine.name}${wine.vintage ? ` ${wine.vintage}` : ''} — The Cellar Club`
  const description = wine.website_description?.slice(0, 155)
    ?? `${wine.name} — sommelier selected, direct import price.`

  return {
    title,
    description,
    openGraph: {
      title: `${wine.name}${wine.vintage ? ` ${wine.vintage}` : ''}`,
      description: wine.website_description?.slice(0, 155),
      images: wine.image_url ? [{ url: wine.image_url }] : [],
    },
  }
}

export default async function WinePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const sb = createServiceClient()

  const { data: wine } = await sb
    .from('wines')
    .select('name, producer, region, country, vintage, price_pence, retail_price_pence, image_url, website_description')
    .eq('slug', slug)
    .eq('active', true)
    .maybeSingle()

  if (!wine) notFound()

  const details = [
    { label: 'Producer', value: wine.producer },
    { label: 'Region',   value: wine.region },
    { label: 'Country',  value: wine.country },
  ].filter((d) => d.value)

  return (
    <div style={{ background: PAGE_BG, color: TEXT_DARK, minHeight: '100vh' }}>

      {/* Logo */}
      <div className="flex justify-center pt-5 pb-4 px-6">
        <Link href="/">
          <Image
            src="/logo.png"
            alt="The Cellar Club"
            width={880}
            height={720}
            priority
            className="h-auto w-[155px] md:w-[192px]"
            style={{ mixBlendMode: 'multiply' }}
          />
        </Link>
      </div>

      {/* Main content */}
      <main className="px-6 pb-16 max-w-5xl mx-auto">
        <div className="md:grid md:grid-cols-2 md:gap-12 md:items-start">

          {/* Bottle image */}
          <div
            className="mb-8 md:mb-0"
            style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}
          >
            {wine.image_url ? (
              <div className="p-6 md:p-8 flex items-center justify-center" style={{ minHeight: 300 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={wine.image_url}
                  alt={wine.name}
                  style={{ objectFit: 'contain', maxHeight: 500, width: '100%' }}
                />
              </div>
            ) : (
              <div
                className="p-6 md:p-8 flex items-center justify-center"
                style={{ minHeight: 300, color: TEXT_FAINT }}
              >
                <Image
                  src="/logo.png"
                  alt="The Cellar Club"
                  width={880}
                  height={720}
                  className="h-auto w-[120px] opacity-20"
                  style={{ mixBlendMode: 'multiply' }}
                />
              </div>
            )}
          </div>

          {/* Details column */}
          <div className="space-y-6">

            {/* Wine name + vintage */}
            <div>
              <h1
                className="font-serif uppercase leading-tight"
                style={{ fontSize: 'clamp(1.8rem, 4vw, 2.4rem)', fontWeight: 400, letterSpacing: '0.06em', color: TEXT_DARK }}
              >
                {wine.name}
              </h1>
              {wine.vintage && (
                <p className="font-serif mt-1" style={{ fontSize: '1.1rem', color: TEXT_FAINT }}>
                  {wine.vintage}
                </p>
              )}
            </div>

            {/* Producer / Region / Country */}
            {details.length > 0 && (
              <div className="space-y-1.5">
                {details.map(({ label, value }) => (
                  <div key={label} className="flex gap-3 items-baseline">
                    <span
                      className="font-sans uppercase text-xs tracking-widest shrink-0 w-20"
                      style={{ color: TEXT_FAINT }}
                    >
                      {label}
                    </span>
                    <span className="font-serif" style={{ color: TEXT_DARK, fontSize: '0.95rem' }}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Price card */}
            <div style={{ background: CARD_BG, border: `1px solid ${BORDER}` }} className="p-4">
              <div className="flex justify-between items-center">
                <span className="font-sans text-xs uppercase tracking-widest" style={{ color: TEXT_FAINT }}>
                  The Cellar Club
                </span>
                <span className="font-serif font-semibold text-xl" style={{ color: ACCENT }}>
                  {formatPrice(wine.price_pence)}
                </span>
              </div>
              {wine.retail_price_pence && (
                <div className="flex justify-between items-center mt-2">
                  <span className="font-sans text-xs uppercase tracking-widest" style={{ color: TEXT_FAINT }}>
                    Retail price
                  </span>
                  <span
                    className="font-serif text-base"
                    style={{ color: TEXT_FAINT }}
                  >
                    {formatPrice(wine.retail_price_pence)}
                  </span>
                </div>
              )}
            </div>

            {/* Website description */}
            {wine.website_description && (
              <div
                className="font-serif leading-[1.75] whitespace-pre-wrap"
                style={{ fontSize: 'clamp(1rem, 1.8vw, 1.08rem)', color: TEXT_DARK }}
              >
                {wine.website_description}
              </div>
            )}

            {/* CTA */}
            <div className="pt-2 space-y-2">
              <p className="font-serif italic" style={{ fontSize: '0.95rem', color: TEXT_FAINT }}>
                Reply to Daniel&apos;s text to order this wine.
              </p>
              <p className="font-serif text-sm" style={{ color: TEXT_FAINT }}>
                Not a member yet?{' '}
                <Link
                  href="/join"
                  className="underline underline-offset-2 transition-opacity hover:opacity-70"
                  style={{ color: 'rgba(42,24,16,0.52)' }}
                >
                  Join here →
                </Link>
              </p>
            </div>

          </div>
        </div>
      </main>

      {/* Footer */}
      <footer
        className="px-6 pt-8 pb-10 text-center"
        style={{ borderTop: `1px solid ${BORDER}` }}
      >
        <div className="max-w-2xl mx-auto space-y-2">
          <p className="font-sans text-xs" style={{ color: 'rgba(42,24,16,0.32)' }}>
            CD WINES LTD &middot; Company No. 15796479
          </p>
          <p className="font-sans text-xs" style={{ color: 'rgba(42,24,16,0.32)' }}>
            We do not sell alcohol to anyone under 18. Please drink responsibly.
          </p>
        </div>
      </footer>

    </div>
  )
}
