import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'
import { requireAdminSession } from '@/lib/adminAuth'

// DELETE /api/admin/customers/[id]/erase
// GDPR right to erasure — deletes Stripe customer and anonymises Supabase data.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession()
  if (!auth.ok) return auth.response

  const { id } = await params
  const sb = createServiceClient()

  const { data: customer } = await sb
    .from('customers')
    .select('id, stripe_customer_id')
    .eq('id', id)
    .maybeSingle()

  if (!customer) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
  }

  // Delete from Stripe
  if (customer.stripe_customer_id) {
    try {
      await stripe.customers.del(customer.stripe_customer_id)
    } catch (err) {
      console.error('[erase] Stripe delete error', err)
      // Continue — don't abort if Stripe customer already deleted
    }
  }

  // Anonymise the Supabase customer row (retain for accounting integrity)
  const { error } = await sb
    .from('customers')
    .update({
      phone: `ERASED-${id}`,
      email: `erased-${id}@deleted.invalid`,
      first_name: 'Erased',
      stripe_customer_id: null,
      stripe_payment_method_id: null,
      active: false,
      gdpr_marketing_consent: false,
      unsubscribed_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    console.error('[erase] Supabase update error', error)
    return NextResponse.json({ error: 'Erasure failed' }, { status: 500 })
  }

  console.log(`[erase] Customer ${id} erased at ${new Date().toISOString()}`)
  return NextResponse.json({ ok: true, erasedAt: new Date().toISOString() })
}
