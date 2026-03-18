import { NextRequest, NextResponse } from 'next/server'
import { getSignupSession } from '@/lib/session'

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

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[save-payment-method]', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
