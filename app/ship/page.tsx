import { createServiceClient } from '@/lib/supabase'
import { isShipTokenExpired } from '@/lib/tokens'
import ShipForm from './ShipForm'

/**
 * /ship?token=[token]
 *
 * Customer shipping address page. Validates the ship token, shows bottle count
 * and an address form. On submit, marks the shipment confirmed and all
 * associated cellar rows as shipped.
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
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Already confirmed</h1>
        <p className="text-sm text-gray-500">
          We already have your delivery address — your case is on its way soon!
        </p>
      </Shell>
    )
  }

  const customer = shipment.customers as unknown as { first_name: string | null } | null

  return (
    <Shell>
      <h1 className="text-xl font-semibold text-gray-900 mb-1">Confirm your delivery</h1>
      <p className="text-sm text-gray-500 mb-6">
        {customer?.first_name ? `Hi ${customer.first_name} — ` : ''}
        {shipment.bottle_count} bottle{shipment.bottle_count !== 1 ? 's' : ''} ready to ship.
        Free delivery on us.
      </p>
      <ShipForm token={token} />
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow p-8">{children}</div>
    </main>
  )
}

function ErrorPage({ message }: { message: string }) {
  return (
    <Shell>
      <p className="text-gray-700 text-sm text-center">{message}</p>
    </Shell>
  )
}
