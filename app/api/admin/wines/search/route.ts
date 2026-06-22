import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/adminAuth'
import { createServiceClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const auth = await requireAdminSession()
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const raw = req.nextUrl.searchParams.get('q') ?? ''
  if (raw.length < 2) return NextResponse.json([])

  // Strip characters that would break PostgREST's or() filter syntax (commas, parens, periods)
  const q = raw.replace(/[,().]/g, ' ').trim()
  if (q.length < 2) return NextResponse.json([])

  const sb = createServiceClient()
  const orFilters = [`name.ilike.%${q}%`, `producer.ilike.%${q}%`]
  if (/^\d+$/.test(q)) orFilters.push(`vintage.eq.${q}`)

  const { data, error } = await sb
    .from('wines')
    .select('id, name, producer, vintage, price_pence, active')
    .or(orFilters.join(','))
    .order('name')
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
