import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { twilioClient, sanitiseGsm7 } from '@/lib/twilio'

/**
 * One-off endpoint — creates pending orders for customers who replied with
 * natural-language quantity messages before the new parser was deployed.
 * DELETE THIS FILE after use.
 *
 * Auth: Authorization: Bearer CRON_SECRET
 */

const ORDERS = [
  { phone: '+447850392799', name: 'Tim',   qty: 2 },
  { phone: '+447810556364', name: 'Susan', qty: 1 },
]

const WINE_ID  = 'c3024e00-39b0-43a6-be88-ec73a4c4379d'
const TEXT_ID  = '491512fd-b590-47f8-82ec-04f031d234d4'
const WINE_NAME = 'Silverhand Blanc de Blancs 2018'
const PRICE_PENCE = 2900
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? ''

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb = createServiceClient()
  const results: Record<string, string> = {}

  for (const { phone, name, qty } of ORDERS) {
    try {
      // Look up customer
      const { data: customer } = await sb
        .from('customers')
        .select('id, stripe_payment_method_id, stripe_customer_id')
        .eq('phone', phone)
        .maybeSingle()

      if (!customer) { results[phone] = 'customer not found'; continue }

      // Skip if order already exists for this text
      const { data: existing } = await sb
        .from('orders')
        .select('id, order_status')
        .eq('customer_id', customer.id)
        .eq('text_id', TEXT_ID)
        .maybeSingle()

      if (existing) { results[phone] = `skipped — already has ${existing.order_status} order`; continue }

      const totalPence = qty * PRICE_PENCE
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

      // Create pending order
      const { error: orderErr } = await sb.from('orders').insert({
        customer_id: customer.id,
        wine_id: WINE_ID,
        text_id: TEXT_ID,
        quantity: qty,
        price_pence: PRICE_PENCE,
        total_pence: totalPence,
        stripe_payment_intent_id: '',
        stripe_charge_status: 'pending',
        order_status: 'awaiting_confirmation',
        confirmation_expires_at: expiresAt,
      })

      if (orderErr) { results[phone] = `order insert failed: ${orderErr.message}`; continue }

      // Reserve stock
      const { data: wine } = await sb.from('wines').select('stock_bottles').eq('id', WINE_ID).maybeSingle()
      if (wine) {
        await sb.from('wines').update({ stock_bottles: wine.stock_bottles - qty }).eq('id', WINE_ID)
      }

      const total = (totalPence / 100).toFixed(2)

      if (!customer.stripe_payment_method_id) {
        // No card — this shouldn't apply to Tim/Susan but handle gracefully
        results[phone] = 'no card on file — skipped SMS'
        continue
      }

      // Send YES confirmation SMS
      await twilioClient.messages.create({
        body: sanitiseGsm7(
          `Hi ${name}, got it — ${qty} bottle${qty !== 1 ? 's' : ''} of ${WINE_NAME} (£${total}). Reply YES to confirm your order.`
        ),
        from: process.env.TWILIO_PHONE_NUMBER!,
        to: phone,
      })

      results[phone] = `order created + SMS sent (${qty} x £${total})`
    } catch (err) {
      results[phone] = `error: ${String(err)}`
    }
  }

  return NextResponse.json({ ok: true, results })
}
