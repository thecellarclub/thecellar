'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

type Card = { last4: string; brand: string; exp_month: number; exp_year: number }
type Address = { line1: string; line2?: string; city: string; postcode: string }
type CellarItem = { quantity: number; name: string; pricePence: number }

interface Props {
  firstName: string
  phone: string
  tier: string
  tierSince: string | null
  bottles: number
  cellar: CellarItem[]
  rollingSpendPence: number
  primaryCard: Card | null
  backupCard: Card | null
  defaultAddress: Address | null
  payments: Array<{
    id: string
    quantity: number
    totalPence: number
    status: string
    createdAt: string
    wineName: string
    wineVintage: number | null
    wineRegion: string | null
  }>
  shipments: Array<{
    id: string
    status: string
    trackingNumber: string | null
    trackingProvider: string | null
    createdAt: string
    dispatchedAt: string | null
    deliveredAt: string | null
  }>
}

const TIER_LABELS: Record<string, string> = {
  none: 'Bailey',
  bailey: 'Bailey',
  elvet: 'Elvet',
  palatine: 'Palatine',
}

const TIER_COLORS: Record<string, string> = {
  none: '#9B1B30',
  bailey: '#9B1B30',
  elvet: '#C9851D',
  palatine: '#C9851D',
}

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      color: '#1C0E09',
      fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
      fontSize: '16px',
      '::placeholder': { color: 'rgba(42,24,16,0.35)' },
      iconColor: '#1C0E09',
    },
    invalid: { color: '#b91c1c', iconColor: '#b91c1c' },
  },
}

function CardPill({ card, label }: { card: Card; label: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0" style={{ borderColor: 'rgba(42,24,16,0.10)' }}>
      <div>
        <p className="font-sans text-xs uppercase tracking-wide mb-0.5" style={{ color: 'rgba(42,24,16,0.45)' }}>{label}</p>
        <p className="font-sans text-sm capitalize" style={{ color: '#1C0E09' }}>
          {card.brand} ···· {card.last4}
        </p>
        <p className="font-sans text-xs" style={{ color: 'rgba(42,24,16,0.40)' }}>
          Expires {card.exp_month.toString().padStart(2, '0')}/{card.exp_year}
        </p>
      </div>
    </div>
  )
}

function TierProgress({ tier, spendPence }: { tier: string; spendPence: number }) {
  const spend = spendPence / 100
  type TierConfig = { label: string; nextLabel: string | null; current: number; target: number | null; color: string }
  const config: TierConfig = (() => {
    if (tier === 'palatine') return { label: 'Palatine', nextLabel: null, current: spend, target: null, color: '#C9851D' }
    if (tier === 'elvet') return { label: 'Elvet', nextLabel: 'Palatine', current: Math.max(0, spend - 500), target: 500, color: '#C9851D' }
    return { label: 'Bailey', nextLabel: 'Elvet', current: spend, target: 500, color: '#9B1B30' }
  })()

  const pct = config.target ? Math.min(100, Math.round((config.current / config.target) * 100)) : 100
  const formatGBP = (n: number) => n >= 1000 ? `£${(n / 1000).toFixed(1)}k` : `£${Math.round(n)}`

  return (
    <div className="mb-6">
      <div className="flex items-baseline justify-between mb-2">
        <span className="font-sans text-xs uppercase tracking-[0.2em]" style={{ color: config.color }}>
          {config.label}
        </span>
        {config.nextLabel ? (
          <span className="font-sans text-xs" style={{ color: 'rgba(42,24,16,0.40)' }}>
            {formatGBP(config.current + (tier === 'elvet' ? 500 : 0))} / {tier === 'elvet' ? '£1,000' : '£500'} towards {config.nextLabel}
          </span>
        ) : (
          <span className="font-sans text-xs" style={{ color: 'rgba(42,24,16,0.40)' }}>{formatGBP(spend)} this year</span>
        )}
      </div>
      <div className="relative h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(42,24,16,0.10)' }}>
        <div className="absolute left-0 top-0 h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: config.color }} />
      </div>
      {config.nextLabel && (
        <p className="font-sans text-xs mt-1.5" style={{ color: 'rgba(42,24,16,0.35)' }}>
          {formatGBP(Math.max(0, (config.target ?? 0) - config.current))} to go
        </p>
      )}
    </div>
  )
}

function PaymentStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    succeeded: { label: 'Paid', color: '#2d6a4f' },
    failed: { label: 'Failed', color: '#9B1B30' },
    refunded: { label: 'Refunded', color: '#555' },
    pending: { label: 'Pending', color: '#7a6000' },
  }
  const { label, color } = map[status] ?? { label: status, color: '#555' }
  return (
    <span className="font-sans text-xs px-1.5 py-0.5 rounded" style={{ color, background: `${color}22` }}>
      {label}
    </span>
  )
}

function PortalCardFormInner({ onSuccess }: { onSuccess: () => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/portal/create-setup-intent', { method: 'POST' })
      const { clientSecret, error: apiErr } = await res.json()
      if (!res.ok) { setError(apiErr || 'Something went wrong.'); return }

      const cardElement = elements.getElement(CardElement)
      if (!cardElement) { setError('Card field not found.'); return }

      const { error: stripeErr, setupIntent } = await stripe.confirmCardSetup(clientSecret, {
        payment_method: { card: cardElement },
      })

      if (stripeErr) { setError(stripeErr.message || 'Card setup failed.'); return }
      if (!setupIntent || setupIntent.status !== 'succeeded') { setError('Card setup was not completed.'); return }

      const saveRes = await fetch('/api/portal/update-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setupIntentId: setupIntent.id }),
      })

      if (!saveRes.ok) { setError('Failed to save card.'); return }

      onSuccess()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block font-sans text-xs mb-1.5 uppercase tracking-wide" style={{ color: 'rgba(42,24,16,0.55)' }}>
          Card details
        </label>
        <div className="bg-[#EDE8DF] border px-4 py-3.5" style={{ borderColor: 'rgba(42,24,16,0.18)' }}>
          <CardElement options={CARD_ELEMENT_OPTIONS} />
        </div>
        <p className="mt-1.5 font-sans text-xs" style={{ color: 'rgba(42,24,16,0.40)' }}>
          Secured by Stripe. We never see your full card number.
        </p>
      </div>
      {error && (
        <p className="font-sans text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">{error}</p>
      )}
      <button
        type="submit"
        disabled={loading || !stripe}
        className="w-full bg-rio text-cream font-sans font-medium px-4 py-3 transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading ? 'Saving card…' : 'Save card →'}
      </button>
    </form>
  )
}

function PortalCardForm({ onSuccess }: { onSuccess: () => void }) {
  return (
    <Elements stripe={stripePromise}>
      <PortalCardFormInner onSuccess={onSuccess} />
    </Elements>
  )
}

export default function DashboardClient({
  firstName,
  phone,
  tier,
  tierSince,
  bottles,
  cellar,
  rollingSpendPence,
  primaryCard,
  backupCard,
  defaultAddress,
  payments,
  shipments,
}: Props) {
  const router = useRouter()
  const [section, setSection] = useState<'overview' | 'address' | 'card'>('overview')
  const [cellarTab, setCellarTab] = useState<'cellar' | 'payments' | 'shipments'>('cellar')
  const [cardSaved, setCardSaved] = useState(false)

  // Address form state
  const [line1, setLine1] = useState(defaultAddress?.line1 ?? '')
  const [line2, setLine2] = useState(defaultAddress?.line2 ?? '')
  const [city, setCity] = useState(defaultAddress?.city ?? '')
  const [postcode, setPostcode] = useState(defaultAddress?.postcode ?? '')
  const [addrLoading, setAddrLoading] = useState(false)
  const [addrMsg, setAddrMsg] = useState('')

  async function handleLogout() {
    await fetch('/api/portal/logout', { method: 'POST' })
    router.push('/portal')
  }

  async function handleAddressSubmit(e: FormEvent) {
    e.preventDefault()
    setAddrMsg('')
    setAddrLoading(true)
    try {
      const res = await fetch('/api/portal/update-address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ line1, line2: line2 || undefined, city, postcode }),
      })
      if (res.ok) {
        setAddrMsg('Address saved.')
        router.refresh()
      } else {
        const d = await res.json()
        setAddrMsg(d.error ?? 'Something went wrong.')
      }
    } catch {
      setAddrMsg('Something went wrong.')
    } finally {
      setAddrLoading(false)
    }
  }

  async function handleSwapCards() {
    const res = await fetch('/api/portal/swap-cards', { method: 'POST' })
    if (res.ok) router.refresh()
  }

  const tierLabel = TIER_LABELS[tier] ?? 'Bailey'
  const tierColor = TIER_COLORS[tier] ?? '#9B1B30'
  const threshold = tier === 'palatine' ? 6 : 12

  const hasCard = !!primaryCard || cardSaved
  const hasAddress = !!defaultAddress
  const setupIncomplete = !hasCard || !hasAddress

  const inputClass = 'w-full bg-[#EDE8DF] border px-4 py-3 focus:outline-none transition-colors font-sans text-sm'
  const inputStyle = { borderColor: 'rgba(42,24,16,0.18)', color: '#1C0E09' }

  return (
    <main className="min-h-screen" style={{ background: '#F5EFE6' }}>
      {/* Header */}
      <div className="border-b px-6 py-4" style={{ background: '#F5EFE6', borderColor: 'rgba(42,24,16,0.12)' }}>
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <span className="font-serif text-xs uppercase tracking-[0.2em]" style={{ color: 'rgba(42,24,16,0.50)' }}>
            The Cellar Club
          </span>
          <button
            onClick={handleLogout}
            className="font-sans text-xs transition-colors"
            style={{ color: 'rgba(42,24,16,0.40)' }}
          >
            Sign out
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">

        {/* ── Setup prompts ─────────────────────────────────────────────── */}
        {setupIncomplete && (
          <div className="border-l-4 p-5" style={{ borderLeftColor: '#9B1B30', background: '#EDE8DF', borderTop: '1px solid rgba(42,24,16,0.12)', borderRight: '1px solid rgba(42,24,16,0.12)', borderBottom: '1px solid rgba(42,24,16,0.12)' }}>
            <p className="font-serif text-lg mb-1" style={{ color: '#1C0E09' }}>
              Finish setting up your account
            </p>
            <p className="font-sans text-sm mb-4" style={{ color: 'rgba(42,24,16,0.60)' }}>
              You need these to order wine by text.
            </p>
            <div className="space-y-3">
              {!hasCard && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0" style={{ borderColor: '#9B1B30' }}>
                      <div className="w-2 h-2 rounded-full" style={{ background: '#9B1B30' }} />
                    </div>
                    <span className="font-sans text-sm" style={{ color: '#1C0E09' }}>Add a payment card</span>
                  </div>
                  <button
                    onClick={() => setSection('card')}
                    className="font-sans text-xs font-medium px-3 py-1.5 bg-rio text-cream transition-opacity hover:opacity-90"
                  >
                    Add card →
                  </button>
                </div>
              )}
              {!hasAddress && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0" style={{ borderColor: '#9B1B30' }}>
                      <div className="w-2 h-2 rounded-full" style={{ background: '#9B1B30' }} />
                    </div>
                    <span className="font-sans text-sm" style={{ color: '#1C0E09' }}>Add a delivery address</span>
                  </div>
                  <button
                    onClick={() => setSection('address')}
                    className="font-sans text-xs font-medium px-3 py-1.5 bg-rio text-cream transition-opacity hover:opacity-90"
                  >
                    Add address →
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Welcome */}
        <div>
          <p className="font-sans text-xs uppercase tracking-wide mb-1" style={{ color: 'rgba(42,24,16,0.45)' }}>My account</p>
          <h1 className="font-serif text-2xl" style={{ color: '#1C0E09' }}>
            {firstName ? `Welcome back, ${firstName}.` : 'Welcome back.'}
          </h1>
          <p className="font-sans text-xs mt-1" style={{ color: 'rgba(42,24,16,0.40)' }}>{phone}</p>
        </div>

        {/* Tier + cellar summary */}
        <div className="p-5 border" style={{ background: '#EDE8DF', borderColor: 'rgba(42,24,16,0.12)', borderTop: `3px solid ${tierColor}` }}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="font-sans text-xs uppercase tracking-wide mb-1" style={{ color: 'rgba(42,24,16,0.45)' }}>Membership</p>
              <p className="font-serif text-xl" style={{ color: '#1C0E09' }}>{tierLabel}</p>
              {tierSince && (
                <p className="font-sans text-xs mt-0.5" style={{ color: 'rgba(42,24,16,0.35)' }}>
                  Since {new Date(tierSince).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="font-sans text-xs uppercase tracking-wide mb-1" style={{ color: 'rgba(42,24,16,0.45)' }}>Cellar</p>
              <p className="font-serif text-xl" style={{ color: '#1C0E09' }}>{bottles}</p>
              <p className="font-sans text-xs" style={{ color: 'rgba(42,24,16,0.35)' }}>
                bottle{bottles !== 1 ? 's' : ''} · free ship at {threshold}
              </p>
            </div>
          </div>

          <TierProgress tier={tier} spendPence={rollingSpendPence} />

          {/* Inner tab bar */}
          <div className="flex gap-4 border-b mb-4 pt-3" style={{ borderColor: 'rgba(42,24,16,0.12)' }}>
            {(['cellar', 'payments', 'shipments'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setCellarTab(t)}
                className="pb-2 font-sans text-xs uppercase tracking-wide border-b-2 -mb-px transition-colors"
                style={cellarTab === t
                  ? { borderColor: '#9B1B30', color: '#1C0E09' }
                  : { borderColor: 'transparent', color: 'rgba(42,24,16,0.40)' }
                }
              >
                {t === 'cellar' ? 'Cellar' : t === 'payments' ? 'Payments' : 'Shipments'}
              </button>
            ))}
          </div>

          {cellarTab === 'cellar' && (
            cellar.length > 0 ? (
              <ul className="space-y-1.5">
                {cellar.map((item, i) => (
                  <li key={i} className="flex items-baseline justify-between gap-2">
                    <span className="font-sans text-sm" style={{ color: 'rgba(42,24,16,0.75)' }}>{item.quantity}× {item.name}</span>
                    <span className="font-sans text-xs shrink-0" style={{ color: 'rgba(42,24,16,0.40)' }}>
                      £{(item.pricePence / 100).toFixed(0)}/bottle
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="font-sans text-sm" style={{ color: 'rgba(42,24,16,0.35)' }}>Nothing in your cellar yet.</p>
            )
          )}

          {cellarTab === 'payments' && (
            <div className="space-y-2">
              {payments.length === 0 ? (
                <p className="font-sans text-sm" style={{ color: 'rgba(42,24,16,0.35)' }}>No payments yet.</p>
              ) : payments.map((p) => (
                <div key={p.id} className="flex items-start justify-between gap-2 py-2 border-b last:border-0" style={{ borderColor: 'rgba(42,24,16,0.10)' }}>
                  <div className="min-w-0">
                    <p className="font-sans text-sm truncate" style={{ color: 'rgba(42,24,16,0.80)' }}>{p.wineName}</p>
                    {(p.wineVintage || p.wineRegion) && (
                      <p className="font-sans text-xs" style={{ color: 'rgba(42,24,16,0.40)' }}>
                        {[p.wineVintage, p.wineRegion].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    <p className="font-sans text-xs mt-0.5" style={{ color: 'rgba(42,24,16,0.35)' }}>
                      {new Date(p.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-sans text-sm" style={{ color: 'rgba(42,24,16,0.80)' }}>£{(p.totalPence / 100).toFixed(2)}</p>
                    <PaymentStatusBadge status={p.status} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {cellarTab === 'shipments' && (
            <div className="space-y-2">
              {shipments.length === 0 ? (
                <p className="font-sans text-sm" style={{ color: 'rgba(42,24,16,0.35)' }}>No shipments yet.</p>
              ) : shipments.map((s) => (
                <div key={s.id} className="py-2 border-b last:border-0" style={{ borderColor: 'rgba(42,24,16,0.10)' }}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-sans text-sm capitalize" style={{ color: 'rgba(42,24,16,0.80)' }}>{s.status}</p>
                      <p className="font-sans text-xs mt-0.5" style={{ color: 'rgba(42,24,16,0.35)' }}>
                        {new Date(s.dispatchedAt ?? s.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <div className="text-right">
                      {s.trackingNumber ? (
                        <p className="font-sans text-xs font-mono" style={{ color: 'rgba(42,24,16,0.50)' }}>
                          {s.trackingProvider ? `${s.trackingProvider} ` : ''}{s.trackingNumber}
                        </p>
                      ) : (
                        <p className="font-sans text-xs" style={{ color: 'rgba(42,24,16,0.30)' }}>No tracking</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Nav tabs */}
        <div className="flex gap-3">
          {(['overview', 'address', 'card'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSection(s)}
              className="font-sans text-xs uppercase tracking-wide px-4 py-2 border transition-colors"
              style={section === s
                ? { background: '#9B1B30', borderColor: '#9B1B30', color: '#F5EFE6' }
                : { background: 'transparent', borderColor: 'rgba(42,24,16,0.20)', color: 'rgba(42,24,16,0.55)' }
              }
            >
              {s === 'overview' ? 'Overview' : s === 'address' ? 'Address' : 'Payment'}
            </button>
          ))}
        </div>

        {/* Overview section */}
        {section === 'overview' && (
          <div className="space-y-4">
            <div className="border p-5" style={{ background: '#EDE8DF', borderColor: 'rgba(42,24,16,0.12)' }}>
              <p className="font-sans text-xs uppercase tracking-wide mb-3" style={{ color: 'rgba(42,24,16,0.45)' }}>Delivery address</p>
              {defaultAddress ? (
                <div className="font-sans text-sm space-y-0.5" style={{ color: 'rgba(42,24,16,0.75)' }}>
                  <p>{defaultAddress.line1}</p>
                  {defaultAddress.line2 && <p>{defaultAddress.line2}</p>}
                  <p>{defaultAddress.city}</p>
                  <p>{defaultAddress.postcode}</p>
                </div>
              ) : (
                <p className="font-sans text-sm" style={{ color: 'rgba(42,24,16,0.40)' }}>No address saved yet.</p>
              )}
              <button
                onClick={() => setSection('address')}
                className="mt-3 font-sans text-xs underline underline-offset-2 transition-colors"
                style={{ color: 'rgba(42,24,16,0.50)' }}
              >
                {defaultAddress ? 'Update address' : 'Add address'}
              </button>
            </div>

            <div className="border p-5" style={{ background: '#EDE8DF', borderColor: 'rgba(42,24,16,0.12)' }}>
              <p className="font-sans text-xs uppercase tracking-wide mb-3" style={{ color: 'rgba(42,24,16,0.45)' }}>Payment cards</p>
              {primaryCard ? (
                <CardPill card={primaryCard} label="Primary" />
              ) : (
                <p className="font-sans text-sm" style={{ color: 'rgba(42,24,16,0.40)' }}>No card on file.</p>
              )}
              {backupCard && <CardPill card={backupCard} label="Backup" />}
              <button
                onClick={() => setSection('card')}
                className="mt-3 font-sans text-xs underline underline-offset-2 transition-colors"
                style={{ color: 'rgba(42,24,16,0.50)' }}
              >
                Manage cards
              </button>
            </div>
          </div>
        )}

        {/* Address section */}
        {section === 'address' && (
          <form onSubmit={handleAddressSubmit} className="space-y-4">
            {[
              { id: 'line1', label: 'Address line 1', value: line1, setter: setLine1, required: true, placeholder: 'House number and street' },
              { id: 'line2', label: 'Address line 2 (optional)', value: line2, setter: setLine2, required: false, placeholder: 'Flat, apartment, etc.' },
              { id: 'city', label: 'City', value: city, setter: setCity, required: true, placeholder: '' },
              { id: 'postcode', label: 'Postcode', value: postcode, setter: setPostcode, required: true, placeholder: 'e.g. DH1 3AA' },
            ].map(({ id, label, value, setter, required, placeholder }) => (
              <div key={id}>
                <label htmlFor={id} className="block font-sans text-xs mb-1.5 uppercase tracking-wide" style={{ color: 'rgba(42,24,16,0.55)' }}>
                  {label}
                </label>
                <input
                  id={id}
                  type="text"
                  value={value}
                  onChange={(e) => setter(e.target.value)}
                  required={required}
                  placeholder={placeholder}
                  className={inputClass}
                  style={inputStyle}
                />
              </div>
            ))}

            {addrMsg && (
              <p className={`font-sans text-sm px-4 py-3 border ${addrMsg === 'Address saved.' ? 'text-green-700 bg-green-50 border-green-200' : 'text-red-700 bg-red-50 border-red-200'}`}>
                {addrMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={addrLoading}
              className="w-full bg-rio text-cream font-sans font-medium px-4 py-3 transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {addrLoading ? 'Saving…' : 'Save address →'}
            </button>
          </form>
        )}

        {/* Card section */}
        {section === 'card' && (
          <div className="space-y-4">
            {(primaryCard || cardSaved) ? (
              <div className="border p-5" style={{ background: '#EDE8DF', borderColor: 'rgba(42,24,16,0.12)' }}>
                <p className="font-sans text-xs uppercase tracking-wide mb-3" style={{ color: 'rgba(42,24,16,0.45)' }}>Your cards</p>
                {primaryCard && <CardPill card={primaryCard} label="Primary" />}
                {backupCard && (
                  <>
                    <CardPill card={backupCard} label="Backup" />
                    <button
                      onClick={handleSwapCards}
                      className="mt-3 font-sans text-xs underline underline-offset-2 transition-colors"
                      style={{ color: 'rgba(42,24,16,0.50)' }}
                    >
                      Make backup card primary
                    </button>
                  </>
                )}
                {cardSaved && !primaryCard && (
                  <p className="font-sans text-sm" style={{ color: '#2d6a4f' }}>Card saved — reload to see details.</p>
                )}
              </div>
            ) : (
              <div className="border p-5" style={{ background: '#EDE8DF', borderColor: 'rgba(42,24,16,0.12)' }}>
                <p className="font-sans text-xs uppercase tracking-wide mb-4" style={{ color: 'rgba(42,24,16,0.45)' }}>Add a payment card</p>
                <PortalCardForm onSuccess={() => { setCardSaved(true); router.refresh() }} />
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
