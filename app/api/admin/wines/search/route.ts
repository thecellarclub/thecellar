import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/adminAuth'
import { createServiceClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const auth = await requireAdminSession()
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = req.nextUrl.searchParams.get('q') ?? ''
  if (q.length < 2) return NextResponse.json([])

  const sb = createServiceClient()
  const { data, error } = await sb
    .from('wines')
    .select('id, name, producer, vintage, price_pence, active')
    .or(`name.ilike.%${q}%,producer.ilike.%${q}%,vintage::text.ilike.%${q}%`)
    .order('name')
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
