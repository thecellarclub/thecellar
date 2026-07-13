import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireAdminSession } from '@/lib/adminAuth'
import { sendBlastWave } from '@/lib/text-blast'

/**
 * POST /api/admin/texts/[id]/send-remainder
 *
 * tiers-v3 §5: sends wave 2 of a Palatine-early-access blast (everyone who
 * isn't Palatine) once the admin decides it's time. Manual v1 — no cron, the
 * admin clicks this from the text detail page.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession()
  if (!auth.ok) return auth.response

  const { id } = await params
  const sb = createServiceClient()

  const { data: text } = await sb
    .from('texts')
    .select('id, wine_id, body, recipient_count, broadcast_at, broadcast_sent_at')
    .eq('id', id)
    .maybeSingle()

  if (!text) {
    return NextResponse.json({ error: 'Text not found' }, { status: 404 })
  }
  if (!text.broadcast_at) {
    return NextResponse.json({ error: 'This send has no pending second wave' }, { status: 400 })
  }
  if (text.broadcast_sent_at) {
    return NextResponse.json({ error: 'Second wave already sent' }, { status: 409 })
  }

  const { data: customers } = await sb
    .from('customers')
    .select('id, phone, texts_snoozed_until, tier')
    .eq('status', 'active')
    .neq('tier', 'palatine')

  const now = new Date()
  const eligible = (customers ?? []).filter(
    (c) => !(c.texts_snoozed_until && new Date(c.texts_snoozed_until) > now)
  )

  const { sent, failures } = await sendBlastWave(sb, eligible, text.body)

  await sb
    .from('texts')
    .update({
      recipient_count: (text.recipient_count ?? 0) + sent,
      broadcast_sent_at: now.toISOString(),
    })
    .eq('id', id)

  return NextResponse.json({
    ok: true,
    sent,
    failed: failures.length,
    ...(failures.length > 0 && { failedNumbers: failures }),
  })
}
