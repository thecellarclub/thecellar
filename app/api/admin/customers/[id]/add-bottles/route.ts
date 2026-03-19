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
  const { wineId, quantity } = body as { wineId: string; quantity: number }

  // Validate inputs
  if (!wineId || typeof wineId !== 'string' || wineId.trim() === '') {
    return NextResponse.json({ error: 'wineId is required' }, { status: 400 })
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
    return NextResponse.json({ error: 'quantity must be a positive integer' }, { status: 400 })
  }

  const sb = createServiceClient()

  // Fetch wine to confirm it exists and check stock
  const { data: wine } = await sb
    .from('wines')
    .select('id, name, stock_bottles')
    .eq('id', wineId)
    .maybeSingle()

  if (!wine) {
    return NextResponse.json({ error: 'Wine not found' }, { status: 404 })
  }

  if (wine.stock_bottles < quantity) {
    return NextResponse.json(
      { error: `Insufficient stock — only ${wine.stock_bottles} bottle${wine.stock_bottles === 1 ? '' : 's'} available` },
      { status: 400 }
    )
  }

  // Insert into cellar — no order_id (manual add, no charge)
  const { error } = await sb.from('cellar').insert({
    customer_id: id,
    wine_id: wineId,
    quantity,
    order_id: null,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Decrement stock
  await sb
    .from('wines')
    .update({ stock_bottles: wine.stock_bottles - quantity })
    .eq('id', wineId)

  return NextResponse.json({ ok: true })
}
