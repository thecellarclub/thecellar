import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireAdminSession } from '@/lib/adminAuth'

export async function GET() {
  const auth = await requireAdminSession()
  if (!auth.ok) return auth.response

  const sb = createServiceClient()
  const { data, error } = await sb
    .from('wines')
    .select('id, name, producer, region, country, vintage, description, price_pence, stock_bottles, active, created_at')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: 'Failed to fetch wines' }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminSession()
  if (!auth.ok) return auth.response

  const body = await req.json()
  const { name, producer, region, country, vintage, description, price_pounds, stock_bottles } = body

  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  if (!price_pounds || isNaN(parseFloat(price_pounds))) {
    return NextResponse.json({ error: 'Valid price is required' }, { status: 400 })
  }
  if (stock_bottles === undefined || isNaN(parseInt(stock_bottles))) {
    return NextResponse.json({ error: 'Valid stock quantity is required' }, { status: 400 })
  }

  const price_pence = Math.round(parseFloat(price_pounds) * 100)

  const sb = createServiceClient()
  const { data, error } = await sb
    .from('wines')
    .insert({
      name: name.trim(),
      producer: producer?.trim() || null,
      region: region?.trim() || null,
      country: country?.trim() || null,
      vintage: vintage ? parseInt(vintage) : null,
      description: description?.trim() || null,
      price_pence,
      stock_bottles: parseInt(stock_bottles),
      active: true,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[admin/wines] POST error', error)
    return NextResponse.json({ error: 'Failed to create wine' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: data.id }, { status: 201 })
}
