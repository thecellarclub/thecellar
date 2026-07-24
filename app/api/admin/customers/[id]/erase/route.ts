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
    .select('id, phone, stripe_customer_id')
    .eq('id', id)
    .maybeSingle()

  if (!customer) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
  }

  const phone = customer.phone // fetched before overwriting, needed for side-table cleanup

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
      last_name: null,
      dob: null,
      default_address: null,
      stripe_customer_id: null,
      stripe_payment_method_id: null,
      backup_payment_method_id: null,
      billing_token: null,
      billing_token_expires_at: null,
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
      utm_term: null,
      utm_content: null,
      gclid: null,
      status: 'deactivated',
      gdpr_marketing_consent: false,
      unsubscribed_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    console.error('[erase] Supabase update error', error)
    return NextResponse.json({ error: 'Erasure failed' }, { status: 500 })
  }

  // Clean up side tables keyed by this customer or their (now-overwritten) phone.
  // orders/cellar/shipments/refunds/credit_ledger/milestone_awards are kept for
  // accounting integrity — only the shipping address on their shipments is nulled.
  const [
    { count: messagesDeleted },
    { count: parseLogDeleted },
    { count: codesDeleted },
    { count: notesDeleted },
    { count: shipmentsScrubbed },
  ] = await Promise.all([
    sb.from('concierge_messages').delete({ count: 'exact' }).eq('customer_id', id),
    sb.from('sms_parse_log').delete({ count: 'exact' }).or(`customer_id.eq.${id},inbound_phone.eq.${phone}`),
    phone ? sb.from('verification_codes').delete({ count: 'exact' }).eq('phone', phone) : Promise.resolve({ count: 0 }),
    sb.from('inbox_notes').delete({ count: 'exact' }).eq('customer_id', id),
    sb.from('shipments').update({ shipping_address: null }, { count: 'exact' }).eq('customer_id', id),
  ])

  console.log(
    `[erase] Customer ${id} erased at ${new Date().toISOString()} — ` +
    `messages:${messagesDeleted ?? 0} parseLog:${parseLogDeleted ?? 0} codes:${codesDeleted ?? 0} ` +
    `notes:${notesDeleted ?? 0} shipmentsScrubbed:${shipmentsScrubbed ?? 0}`
  )
  return NextResponse.json({
    ok: true,
    erasedAt: new Date().toISOString(),
    removed: {
      messages: messagesDeleted ?? 0,
      parseLog: parseLogDeleted ?? 0,
      codes: codesDeleted ?? 0,
      notes: notesDeleted ?? 0,
      shipmentsScrubbed: shipmentsScrubbed ?? 0,
    },
  })
}
