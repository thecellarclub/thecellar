import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getPortalSession } from '@/lib/portal-auth'
import { stripe } from '@/lib/stripe'

export async function GET(req: NextRequest) {
  const session = await getPortalSession(req)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const sb = createServiceClient()

  const { data: customer } = await sb
    .from('customers')
    .select('id, first_name, phone, tier, tier_since, stripe_payment_method_id, backup_payment_method_id, default_address')
    .eq('id', session.customerId)
    .maybeSingle()

  if (!customer) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
  }

  // Fetch unshipped bottle count
  const { count: bottleCount } = await sb
    .from('cellar')
    .select('*', { count: 'exact', head: true })
    .eq('customer_id', customer.id)
    .is('shipped_at', null)

  // Fetch cellar detail
  const { data: cellarRows } = await sb
    .from('cellar')
    .select('quantity, wines(name, price_pence)')
    .eq('customer_id', customer.id)
    .is('shipped_at', null)

  // Fetch primary card last4 from Stripe
  let primaryCard: { last4: string; brand: string; exp_month: number; exp_year: number } | null = null
  let backupCard: { last4: string; brand: string; exp_month: number; exp_year: number } | null = null

  if (customer.stripe_payment_method_id) {
    try {
      const pm = await stripe.paymentMethods.retrieve(customer.stripe_payment_method_id)
      if (pm.card) {
        primaryCard = {
          last4: pm.card.last4,
          brand: pm.card.brand,
          exp_month: pm.card.exp_month,
          exp_year: pm.card.exp_year,
        }
      }
    } catch {
      // Non-fatal — card info is cosmetic
    }
  }

  if (customer.backup_payment_method_id) {
    try {
      const pm = await stripe.paymentMethods.retrieve(customer.backup_payment_method_id)
      if (pm.card) {
        backupCard = {
          last4: pm.card.last4,
          brand: pm.card.brand,
          exp_month: pm.card.exp_month,
          exp_year: pm.card.exp_year,
        }
      }
    } catch {
      // Non-fatal
    }
  }

  return NextResponse.json({
    customer: {
      id: customer.id,
      firstName: customer.first_name,
      phone: customer.phone,
      tier: customer.tier ?? 'none',
      tierSince: customer.tier_since,
      defaultAddress: customer.default_address,
    },
    bottles: bottleCount ?? 0,
    cellar: (cellarRows ?? []).map((r) => ({
      quantity: r.quantity,
      wine: r.wines as unknown as { name: string; price_pence: number } | null,
    })),
    primaryCard,
    backupCard,
  })
}
