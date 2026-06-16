import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/adminAuth'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const auth = await requireAdminSession()
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, producer, vintage, pricePence } = body as {
    name: string
    producer?: string
    vintage?: number
    pricePence: number
  }

  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }
  if (!Number.isInteger(pricePence) || pricePence < 0) {
    return NextResponse.json({ error: 'pricePence must be a non-negative integer' }, { status: 400 })
  }

  const sb = createServiceClient()
  const { data, error } = await sb
    .from('wines')
    .insert({
      name: name.trim(),
      producer: producer?.trim() || null,
      vintage: vintage ?? null,
      price_pence: pricePence,
      active: false,
    })
    .select('id, name, producer, vintage, price_pence')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
