import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { twilioClient, sanitiseGsm7 } from '@/lib/twilio'
import { notifyAdmin } from '@/lib/resend'
import { generateShortToken } from '@/lib/token'
import { paymentFailedNudge, paymentFailedCancelled } from '@/lib/sms-templates'

/**
 * GET /api/cron/payment-retry
 *
 * Runs daily at 11:00 UTC via Vercel cron. Secured by Authorization: Bearer CRON_SECRET.
 *
 * For each order with order_status = 'payment_failed':
 *   - attempts = 1 (T+~24h):  send nudge SMS with a fresh link, set attempts = 2
 *   - attempts >= 2 (T+~48h): cancel the order, release stock, SMS customer, notifyAdmin
 *
 * The customer must reply YES after saving a new card — the save-card endpoint handles
 * the YES gate. This cron never auto-charges.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb = createServiceClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  const { data: failedOrders } = await sb
    .from('orders')
    .select('id, customer_id, wine_id, quantity, total_pence, payment_failed_attempts, customers(id, phone, first_name), wines(name, stock_bottles)')
    .eq('order_status', 'payment_failed')
    .order('payment_failed_at', { ascending: true }) as {
      data: {
        id: string
        customer_id: string
        wine_id: string
        quantity: number
        total_pence: number
        payment_failed_attempts: number
        customers: { id: string; phone: string; first_name: string | null } | null
        wines: { name: string; stock_bottles: number } | null
      }[] | null
    }

  let nudged = 0
  let cancelled = 0

  for (const order of failedOrders ?? []) {
    const customer = order.customers
    const wine = order.wines
    if (!customer?.phone) continue

    try {
      if (order.payment_failed_attempts >= 2) {
        // Cancel and release stock
        await sb
          .from('orders')
          .update({ order_status: 'cancelled', stripe_charge_status: 'failed' })
          .eq('id', order.id)

        if (wine) {
          await sb
            .from('wines')
            .update({ stock_bottles: wine.stock_bottles + order.quantity })
            .eq('id', order.wine_id)
        }

        await twilioClient.messages.create({
          body: sanitiseGsm7(paymentFailedCancelled()),
          from: process.env.TWILIO_PHONE_NUMBER!,
          to: customer.phone,
        })

        void notifyAdmin(
          `Order cancelled — payment never succeeded`,
          `Customer: ${customer.first_name ?? ''} ${customer.phone}\nOrder: ${order.id}\nWine: ${wine?.name ?? ''}\nQty: ${order.quantity}\nTotal: £${(order.total_pence / 100).toFixed(2)}`,
          'members@thecellar.club'
        )

        cancelled++
      } else {
        // Nudge — send fresh billing link
        const billingToken = generateShortToken()
        const now = new Date().toISOString()

        await sb
          .from('customers')
          .update({
            billing_token: billingToken,
            billing_token_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          })
          .eq('id', customer.id)

        await sb
          .from('orders')
          .update({
            payment_failed_attempts: order.payment_failed_attempts + 1,
            payment_failed_last_message_at: now,
          })
          .eq('id', order.id)

        await twilioClient.messages.create({
          body: sanitiseGsm7(paymentFailedNudge(order.quantity, appUrl, billingToken)),
          from: process.env.TWILIO_PHONE_NUMBER!,
          to: customer.phone,
        })

        nudged++
      }
    } catch (err) {
      console.error('[cron/payment-retry] failed for order', order.id, err)
    }
  }

  return NextResponse.json({ ok: true, nudged, cancelled, total: (failedOrders ?? []).length })
}
