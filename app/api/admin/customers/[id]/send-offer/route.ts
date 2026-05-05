import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/adminAuth'
import { createServiceClient } from '@/lib/supabase'
import { sendSms } from '@/lib/twilio'
import { generateShortToken } from '@/lib/token'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? ''

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession()
  if (!auth.ok) return auth.response

  const { id } = await params
  const body = await req.json()
  const { wineId, quantity } = body

  if (!wineId || typeof wineId !== 'string') {
    return NextResponse.json({ error: 'wineId is required' }, { status: 400 })
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
    return NextResponse.json({ error: 'quantity must be a positive integer' }, { status: 400 })
  }

  const sb = createServiceClient()

  const { data: customer } = await sb
    .from('customers')
    .select('id, phone, stripe_payment_method_id, active')
    .eq('id', id)
    .maybeSingle()

  if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
  if (!customer.active) return NextResponse.json({ error: 'Customer is not active' }, { status: 400 })

  // Guard: one pending order at a time
  const { data: existing } = await sb
    .from('orders')
    .select('id')
    .eq('customer_id', id)
    .eq('order_status', 'awaiting_confirmation')
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: 'Customer already has a pending order. Wait for them to confirm or let it expire.' },
      { status: 409 }
    )
  }

  const { data: wine } = await sb
    .from('wines')
    .select('id, name, price_pence, stock_bottles, active')
    .eq('id', wineId)
    .maybeSingle()

  if (!wine) return NextResponse.json({ error: 'Wine not found' }, { status: 404 })
  if (!wine.active) return NextResponse.json({ error: 'Wine is not active' }, { status: 400 })

  if (wine.stock_bottles < quantity) {
    return NextResponse.json(
      { error: `Insufficient stock. Only ${wine.stock_bottles} bottle${wine.stock_bottles === 1 ? '' : 's'} available.` },
      { status: 400 }
    )
  }

  const totalPence = quantity * wine.price_pence

  // Reserve stock
  await sb
    .from('wines')
    .update({ stock_bottles: wine.stock_bottles - quantity })
    .eq('id', wine.id)

  const hasCard = !!customer.stripe_payment_method_id
  const expiresAt = hasCard
    ? new Date(Date.now() + 10 * 60 * 1000).toISOString()
    : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  const { data: order, error: orderErr } = await sb
    .from('orders')
    .insert({
      customer_id: id,
      wine_id: wine.id,
      text_id: null,
      quantity,
      price_pence: wine.price_pence,
      total_pence: totalPence,
      stripe_payment_intent_id: '',
      stripe_charge_status: 'pending',
      order_status: 'awaiting_confirmation',
      confirmation_expires_at: expiresAt,
    })
    .select('id')
    .single()

  if (orderErr || !order) {
    // Rollback stock reservation
    await sb.from('wines').update({ stock_bottles: wine.stock_bottles }).eq('id', wine.id)
    console.error('[send-offer] order insert error', orderErr)
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }

  const totalStr = `£${(totalPence / 100).toFixed(2)}`
  let smsBody: string

  if (hasCard) {
    smsBody = `Daniel here - I've set aside ${quantity} x ${wine.name} for you (${totalStr}). Reply YES to confirm.`
  } else {
    const billingToken = generateShortToken()
    await sb.from('customers').update({
      billing_token: billingToken,
      billing_token_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }).eq('id', id)
    smsBody = `Daniel here - I've set aside ${quantity} x ${wine.name} for you (${totalStr}). Add your card at ${APP_URL}/billing?token=${billingToken} then reply YES to confirm.`
  }

  await sendSms(customer.phone, smsBody, { trigger: 'admin_manual_offer', customerId: customer.id })

  return NextResponse.json({ ok: true, orderId: order.id })
}
