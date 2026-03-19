import { createServiceClient } from '@/lib/supabase'
import { isShipTokenExpired } from '@/lib/tokens'
import ShipForm from './ShipForm'

type SavedAddress = {
  line1: string
  line2?: string | null
  city: string
  postcode: string
}

type BottleEntry = {
  name: string
  quantity: number
  price_pence: number
}

/**
 * /ship?token=[token]
 *
 * Customer shipping address page. Validates the ship token, shows bottle list
 * and an address form (pre-filled from previous shipment if available).
 * On submit, marks the shipment confirmed and all associated cellar rows as shipped.
 */
export default async function ShipPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  if (!token) {
    return <ErrorPage message="Invalid link. Please check your text message and try again." />
  }

  const sb = createServiceClient()

  const { data: shipment } = await sb
    .from('shipments')
    .select('id, customer_id, bottle_count, status, created_at, customers(first_name)')
    .eq('token', token)
    .maybeSingle()

  if (!shipment) {
    return <ErrorPage message="Invalid link. Please check your text message and try again." />
  }

  if (isShipTokenExpired(shipment.created_at)) {
    return (
      <ErrorPage message="This link has expired. Reply SHIP to your last text to get a fresh one." />
    )
  }

  if (['confirmed', 'dispatched', 'delivered'].includes(shipment.status ?? '')) {
    return (
      <Shell>
        <h1 className="font-serif text-xl text-cream mb-1">Already confirmed</h1>
        <p className="font-sans text-sm text-cream/50">
          We already have your delivery address — your case is on its way soon!
        </p>
      </Shell>
    )
  }

  const customer = shipment.customers as unknown as { first_name: string | null } | null

  // Look up previous completed shipment address for this customer
  let savedAddress: SavedAddress | null = null
  const { data: prevShipment } = await sb
    .from('shipments')
    .select('shipping_address')
    .eq('customer_id', shipment.customer_id)
    .neq('id', shipment.id)
    .neq('status', 'pending')
    .not('shipping_address', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (prevShipment?.shipping_address) {
    const addr = prevShipment.shipping_address as Record<string, string>
    if (addr.line1 && addr.city && addr.postcode) {
      savedAddress = {
        line1: addr.line1,
        line2: addr.line2 ?? null,
        city: addr.city,
        postcode: addr.postcode,
      }
    }
  }

  // Fetch bottles in this shipment (cellar rows linked to shipment_id, joined with wines)
  const bottles: BottleEntry[] = []
  const { data: cellarRows } = await sb
    .from('cellar')
    .select('quantity, wines(name, price_pence)')
    .eq('shipment_id', shipment.id)

  if (cellarRows && cellarRows.length > 0) {
    const map = new Map<string, { quantity: number; price_pence: number }>()
    for (const row of cellarRows) {
      const wine = row.wines as unknown as { name: string; price_pence: number } | null
      if (!wine) continue
      const existing = map.get(wine.name)
      if (existing) {
        existing.quantity += row.quantity
      } else {
        map.set(wine.name, { quantity: row.quantity, price_pence: wine.price_pence })
      }
    }
    for (const [name, { quantity, price_pence }] of map) {
      bottles.push({ name, quantity, price_pence })
    }
  }

  return (
    <Shell>
      <h1 className="font-serif text-xl text-cream mb-1">Confirm your delivery</h1>
      <p className="font-sans text-sm text-cream/50 mb-6">
        {customer?.first_name ? `Hi ${customer.first_name} — ` : ''}
        {shipment.bottle_count} bottle{shipment.bottle_count !== 1 ? 's' : ''} ready to ship.
        Free delivery on us.
      </p>
      <ShipForm token={token} savedAddress={savedAddress} bottles={bottles} />
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-maroon flex flex-col items-center justify-center p-4">
      {/* Brand mark */}
      <div className="text-center mb-8">
        <div className="font-serif text-cream">
          <span className="block text-xs uppercase tracking-[0.3em] text-cream/60">the</span>
          <span className="block text-3xl uppercase tracking-[0.08em] leading-none">CELLAR</span>
          <span className="block text-xs uppercase tracking-[0.3em] text-cream/60">club</span>
        </div>
      </div>
      {/* Content card */}
      <div className="w-full max-w-md bg-maroon-dark border border-cream/12 p-8">
        {children}
      </div>
      {/* Footer */}
      <footer className="mt-8 text-center space-y-1">
        <p className="font-sans text-cream/25 text-xs">CD WINES LTD · Company No. 15796479</p>
        <p className="font-sans text-cream/25 text-xs">Licensed under the Licensing Act 2003 · Licence No. DCCC/PLA0856</p>
        <p className="font-sans text-cream/25 text-xs">We do not sell alcohol to anyone under 18. Please drink responsibly.</p>
        <div className="flex justify-center gap-4 mt-2">
          <a href="/privacy" className="font-sans text-cream/30 hover:text-cream/60 text-xs underline underline-offset-2">Privacy</a>
          <a href="/terms" className="font-sans text-cream/30 hover:text-cream/60 text-xs underline underline-offset-2">Terms</a>
        </div>
      </footer>
    </main>
  )
}

function ErrorPage({ message }: { message: string }) {
  return (
    <Shell>
      <p className="font-sans text-cream/60 text-sm text-center">{message}</p>
    </Shell>
  )
}
