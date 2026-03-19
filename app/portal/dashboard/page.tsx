import { redirect } from 'next/navigation'
import { getPortalSession } from '@/lib/portal-auth'
import { createServiceClient } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'
import DashboardClient from './DashboardClient'

type CellarRow = {
  quantity: number
  wines: { name: string; price_pence: number } | null
}

export default async function PortalDashboardPage() {
  const session = await getPortalSession()
  if (!session) redirect('/portal')

  const sb = createServiceClient()

  const { data: customer } = await sb
    .from('customers')
    .select('id, first_name, phone, tier, tier_since, stripe_payment_method_id, backup_payment_method_id, default_address')
    .eq('id', session.customerId)
    .maybeSingle()

  if (!customer) redirect('/portal')

  // Cellar
  const { data: cellarRows } = await sb
    .from('cellar')
    .select('quantity, wines(name, price_pence)')
    .eq('customer_id', customer.id)
    .is('shipped_at', null) as { data: CellarRow[] | null }

  const bottles = (cellarRows ?? []).reduce((s, r) => s + r.quantity, 0)

  // Rolling 12-month spend (confirmed charges only)
  const twelveMonthsAgo = new Date()
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1)

  const { data: spendRows } = await sb
    .from('orders')
    .select('total_pence')
    .eq('customer_id', customer.id)
    .eq('stripe_charge_status', 'succeeded')
    .gte('created_at', twelveMonthsAgo.toISOString())

  const rollingSpendPence = (spendRows ?? []).reduce((s, r) => s + (r.total_pence ?? 0), 0)

  // Past payments
  const { data: paymentRows } = await sb
    .from('orders')
    .select('id, quantity, total_pence, stripe_charge_status, created_at, wines(name, vintage, region)')
    .eq('customer_id', customer.id)
    .order('created_at', { ascending: false })

  // Past shipments
  const { data: shipmentRows } = await sb
    .from('shipments')
    .select('id, status, tracking_number, tracking_provider, created_at, dispatched_at, delivered_at')
    .eq('customer_id', customer.id)
    .order('created_at', { ascending: false })

  // Cards from Stripe
  let primaryCard: { last4: string; brand: string; exp_month: number; exp_year: number } | null = null
  let backupCard: { last4: string; brand: string; exp_month: number; exp_year: number } | null = null

  if (customer.stripe_payment_method_id) {
    try {
      const pm = await stripe.paymentMethods.retrieve(customer.stripe_payment_method_id)
      if (pm.card) {
        primaryCard = { last4: pm.card.last4, brand: pm.card.brand, exp_month: pm.card.exp_month, exp_year: pm.card.exp_year }
      }
    } catch { /* non-fatal */ }
  }

  if (customer.backup_payment_method_id) {
    try {
      const pm = await stripe.paymentMethods.retrieve(customer.backup_payment_method_id)
      if (pm.card) {
        backupCard = { last4: pm.card.last4, brand: pm.card.brand, exp_month: pm.card.exp_month, exp_year: pm.card.exp_year }
      }
    } catch { /* non-fatal */ }
  }

  const addr = customer.default_address as Record<string, string> | null

  type PaymentWine = { name: string; vintage: number | null; region: string | null } | null

  return (
    <DashboardClient
      firstName={customer.first_name ?? ''}
      phone={customer.phone}
      tier={customer.tier ?? 'none'}
      tierSince={customer.tier_since ?? null}
      bottles={bottles}
      cellar={(cellarRows ?? []).map((r) => ({
        quantity: r.quantity,
        name: r.wines?.name ?? 'Unknown wine',
        pricePence: r.wines?.price_pence ?? 0,
      }))}
      rollingSpendPence={rollingSpendPence}
      primaryCard={primaryCard}
      backupCard={backupCard}
      defaultAddress={addr ? {
        line1: addr.line1 ?? '',
        line2: addr.line2 ?? undefined,
        city: addr.city ?? '',
        postcode: addr.postcode ?? '',
      } : null}
      payments={(paymentRows ?? []).map((p) => {
        const wine = p.wines as unknown as PaymentWine
        return {
          id: p.id,
          quantity: p.quantity,
          totalPence: p.total_pence,
          status: p.stripe_charge_status,
          createdAt: p.created_at,
          wineName: wine?.name ?? '—',
          wineVintage: wine?.vintage ?? null,
          wineRegion: wine?.region ?? null,
        }
      })}
      shipments={(shipmentRows ?? []).map((s) => ({
        id: s.id,
        status: s.status,
        trackingNumber: s.tracking_number ?? null,
        trackingProvider: s.tracking_provider ?? null,
        createdAt: s.created_at,
        dispatchedAt: s.dispatched_at ?? null,
        deliveredAt: s.delivered_at ?? null,
      }))}
    />
  )
}
