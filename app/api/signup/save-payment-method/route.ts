import { NextRequest, NextResponse } from 'next/server'
import { getSignupSession } from '@/lib/session'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { paymentMethodId } = await req.json()

    if (!paymentMethodId || typeof paymentMethodId !== 'string') {
      return NextResponse.json({ error: 'Missing payment method ID' }, { status: 400 })
    }

    const session = await getSignupSession()

    if (!session.stripeCustomerId) {
      return NextResponse.json({ error: 'Session expired. Please start again.' }, { status: 400 })
    }

    session.paymentMethodId = paymentMethodId
    await session.save()

    // Persist card_complete step
    const supabase = createServiceClient()
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
