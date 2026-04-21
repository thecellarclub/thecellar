import { NextRequest, NextResponse } from 'next/server'
import { getSignupSession } from '@/lib/session'
import { createServiceClient } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  try {
    const { paymentMethodId } = await req.json()

    if (!paymentMethodId || typeof paymentMethodId !== 'string') {
      return NextResponse.json({ error: 'Missing payment method ID' }, { status: 400 })
    }

    const session = await getSignupSession()

    if (!session.stripeCustomerId || !session.customerId || !session.email) {
      return NextResponse.json({ error: 'Session expired. Please start again.' }, { status: 400 })
    }

    session.paymentMethodId = paymentMethodId
    await session.save()

    const supabase = createServiceClient()

    // Persist card + email onto the existing customer row created at Step 2
    const { error: updateError } = await supabase
      .from('customers')
      .update({
        stripe_payment_method_id: paymentMethodId,
        email: session.email,
      })
      .eq('id', session.customerId)
    if (updateError) console.error('[save-payment-method] customer update failed:', updateError.message)

    // Set as default on the Stripe customer
    await stripe.customers.update(session.stripeCustomerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    })

    // Persist card_complete step
    const { error: progressError } = await supabase
      .from('signup_progress')
      .upsert(
        {
          phone: session.phone,
          stripe_payment_method_id: paymentMethodId,
          last_step: 'card_complete',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'phone' }
      )
    if (progressError) console.error('[signup_progress] upsert failed:', progressError.message)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[save-payment-method]', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
