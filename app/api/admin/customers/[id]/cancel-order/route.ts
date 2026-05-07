import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { orderId } = body

  if (!orderId || typeof orderId !== 'string') {
    return NextResponse.json({ error: 'Missing orderId' }, { status: 400 })
  }

  const sb = createServiceClient()

  const { data: order } = await sb
    .from('orders')
    .select('id, order_status, wine_id, quantity, customer_id')
    .eq('id', orderId)
    .eq('customer_id', id)
    .maybeSingle()

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  if (order.order_status !== 'awaiting_confirmation') {
    return NextResponse.json({ error: 'Order is not pending' }, { status: 400 })
  }

  const { data: wine } = await sb
    .from('wines')
    .select('stock_bottles')
    .eq('id', order.wine_id)
    .maybeSingle()

  await sb.from('orders').update({ order_status: 'cancelled' }).eq('id', orderId)

  await sb
    .from('wines')
    .update({ stock_bottles: (wine?.stock_bottles ?? 0) + order.quantity })
    .eq('id', order.wine_id)

  await sb
    .from('customers')
    .update({ sms_awaiting: null })
    .eq('id', id)
    .eq('sms_awaiting', 'offer')

  return NextResponse.json({ ok: true })
}
