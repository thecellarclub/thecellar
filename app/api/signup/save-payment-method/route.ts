import { NextRequest, NextResponse } from 'next/server'
import { getSignupSession } from '@/lib/session'
import { createServiceClient } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'
import { sendSms } from '@/lib/twilio'

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

    // Persist card + email onto the existing customer row created at Step 1
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

    // Send welcome SMS — idempotent: skip if cron already welcomed this customer
    const { data: customer } = await supabase
      .from('customers')
      .select('welcome_sent_at, first_name')
      .eq('id', session.customerId)
      .single()

    if (customer && !customer.welcome_sent_at) {
      try {
        await sendSms(
          session.phone!,
          `Welcome, ${customer.first_name}! It's Daniel from The Cellar Club.\n\nI'll text you whenever I find something special. If you fancy it, reply how many bottles. I'll store them in the cellar until you fill a case of 12, then deliver free.\n\nGot a question or request? Text me anytime.`
        )
        await supabase
          .from('customers')
          .update({ welcome_sent_at: new Date().toISOString(), welcome_pending_at: null })
          .eq('id', session.customerId)
      } catch (err) {
        console.error('[save-payment-method] welcome SMS failed', err)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[save-payment-method]', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
