'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

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
  primaryCard: Card | null
  backupCard: Card | null
  defaultAddress: Address | null
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

function CardPill({ card, label }: { card: Card; label: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-cream/10 last:border-0">
      <div>
        <p className="font-sans text-xs text-cream/40 uppercase tracking-wide mb-0.5">{label}</p>
        <p className="font-sans text-sm text-cream capitalize">
          {card.brand} ···· {card.last4}
        </p>
        <p className="font-sans text-xs text-cream/40">
          Expires {card.exp_month.toString().padStart(2, '0')}/{card.exp_year}
        </p>
      </div>
    </div>
  )
}

export default function DashboardClient({
  firstName,
  phone,
  tier,
  tierSince,
  bottles,
  cellar,
  primaryCard,
  backupCard,
  defaultAddress,
}: Props) {
  const router = useRouter()
  const [section, setSection] = useState<'overview' | 'address' | 'card'>('overview')

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
    if (res.ok) {
      router.refresh()
    }
  }

  const tierLabel = TIER_LABELS[tier] ?? 'Bailey'
  const tierColor = TIER_COLORS[tier] ?? '#9B1B30'
  const threshold = tier === 'palatine' ? 6 : 12

  return (
    <main className="min-h-screen bg-maroon">
      {/* Header */}
      <div className="bg-maroon-dark border-b border-cream/10 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="font-serif text-cream">
            <span className="text-xs uppercase tracking-[0.2em] text-cream/50">The Cellar Club</span>
          </div>
          <button
            onClick={handleLogout}
            className="font-sans text-xs text-cream/40 hover:text-cream/70 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {/* Welcome */}
        <div>
          <p className="font-sans text-xs text-cream/40 uppercase tracking-wide mb-1">My account</p>
          <h1 className="font-serif text-2xl text-cream">
            {firstName ? `Welcome back, ${firstName}.` : 'Welcome back.'}
          </h1>
          <p className="font-sans text-xs text-cream/40 mt-1">{phone}</p>
        </div>

        {/* Tier + cellar summary */}
        <div
          className="p-5 border"
          style={{
            background: '#1E0B10',
            borderColor: 'rgba(240,230,220,0.12)',
            borderTop: `3px solid ${tierColor}`,
          }}
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="font-sans text-xs text-cream/40 uppercase tracking-wide mb-1">Membership</p>
              <p className="font-serif text-xl text-cream">{tierLabel}</p>
              {tierSince && (
                <p className="font-sans text-xs text-cream/35 mt-0.5">
                  Since {new Date(tierSince).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="font-sans text-xs text-cream/40 uppercase tracking-wide mb-1">Cellar</p>
              <p className="font-serif text-xl text-cream">{bottles}</p>
              <p className="font-sans text-xs text-cream/35">
                bottle{bottles !== 1 ? 's' : ''} · free ship at {threshold}
              </p>
            </div>
          </div>

          {/* Cellar list */}
          {cellar.length > 0 && (
            <ul className="space-y-1.5 pt-3 border-t border-cream/10">
              {cellar.map((item, i) => (
                <li key={i} className="flex items-baseline justify-between gap-2">
                  <span className="font-sans text-sm text-cream/75">{item.quantity}× {item.name}</span>
                  <span className="font-sans text-xs text-cream/35 shrink-0">
                    £{(item.pricePence / 100).toFixed(0)}/bottle
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Nav tabs */}
        <div className="flex gap-3">
          {(['overview', 'address', 'card'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSection(s)}
              className={`font-sans text-xs uppercase tracking-wide px-4 py-2 border transition-colors ${
                section === s
                  ? 'bg-rio border-rio text-cream'
                  : 'border-cream/20 text-cream/50 hover:text-cream/80 hover:border-cream/40'
              }`}
            >
              {s === 'overview' ? 'Overview' : s === 'address' ? 'Address' : 'Payment'}
            </button>
          ))}
        </div>

        {/* Overview section */}
        {section === 'overview' && (
          <div className="space-y-4">
            <div className="bg-maroon-dark border border-cream/12 p-5">
              <p className="font-sans text-xs text-cream/40 uppercase tracking-wide mb-3">Delivery address</p>
              {defaultAddress ? (
                <div className="font-sans text-sm text-cream/75 space-y-0.5">
                  <p>{defaultAddress.line1}</p>
                  {defaultAddress.line2 && <p>{defaultAddress.line2}</p>}
                  <p>{defaultAddress.city}</p>
                  <p>{defaultAddress.postcode}</p>
                </div>
              ) : (
                <p className="font-sans text-sm text-cream/40">No address saved yet.</p>
              )}
              <button
                onClick={() => setSection('address')}
                className="mt-3 font-sans text-xs text-cream/50 hover:text-cream/80 transition-colors underline underline-offset-2"
              >
                {defaultAddress ? 'Update address' : 'Add address'}
              </button>
            </div>

            <div className="bg-maroon-dark border border-cream/12 p-5">
              <p className="font-sans text-xs text-cream/40 uppercase tracking-wide mb-3">Payment cards</p>
              {primaryCard ? (
                <CardPill card={primaryCard} label="Primary" />
              ) : (
                <p className="font-sans text-sm text-cream/40">No card on file.</p>
              )}
              {backupCard && <CardPill card={backupCard} label="Backup" />}
              <button
                onClick={() => setSection('card')}
                className="mt-3 font-sans text-xs text-cream/50 hover:text-cream/80 transition-colors underline underline-offset-2"
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
                <label htmlFor={id} className="block font-sans text-xs text-cream/55 mb-1.5 uppercase tracking-wide">
                  {label}
                </label>
                <input
                  id={id}
                  type="text"
                  value={value}
                  onChange={(e) => setter(e.target.value)}
                  required={required}
                  placeholder={placeholder}
                  className="w-full bg-maroon border border-cream/20 px-4 py-3 text-cream placeholder-cream/30 focus:outline-none focus:border-cream/50 transition-colors font-sans text-sm"
                />
              </div>
            ))}

            {addrMsg && (
              <p className={`font-sans text-sm px-4 py-3 border ${addrMsg === 'Address saved.' ? 'text-green-400 bg-green-950/30 border-green-900/40' : 'text-red-400 bg-red-950/30 border-red-900/40'}`}>
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
            <div className="bg-maroon-dark border border-cream/12 p-5">
              <p className="font-sans text-xs text-cream/40 uppercase tracking-wide mb-3">Your cards</p>
              {primaryCard ? (
                <CardPill card={primaryCard} label="Primary" />
              ) : (
                <p className="font-sans text-sm text-cream/40">No card on file. Contact us to update.</p>
              )}
              {backupCard && (
                <>
                  <CardPill card={backupCard} label="Backup" />
                  <button
                    onClick={handleSwapCards}
                    className="mt-3 font-sans text-xs text-cream/50 hover:text-cream/80 transition-colors underline underline-offset-2"
                  >
                    Make backup card primary
                  </button>
                </>
              )}
            </div>
            <p className="font-sans text-xs text-cream/35 text-center">
              To add or update a card, text us and we&apos;ll send you a secure update link.
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
