import { NextRequest, NextResponse } from 'next/server'
import { sanitiseGsm7 } from '@/lib/twilio'
import { createServiceClient } from '@/lib/supabase'
import { requireAdminSession } from '@/lib/adminAuth'
import { sendBlastWave } from '@/lib/text-blast'

// POST /api/texts/send
// Admin endpoint — sends a text blast to all active customers for a given wine.
// This route lives under /api/texts/ (not /api/admin/) for historical reasons,
// but requires an admin session like every other admin-mutating route.
//
// tiers-v3 §5: Palatine members get first access. If any Palatine members are
// eligible, wave 1 (this request) goes to them only, and the text row is left
// with a pending broadcast_at — the admin sends the remainder later from the
// text detail page. If there are no Palatine members, this sends to everyone
// immediately, byte-identical to the old single-wave behaviour.

interface Customer {
  id: string
  phone: string
  texts_snoozed_until: string | null
  tier: string
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminSession()
  if (!auth.ok) return auth.response

  try {
    const { wineId, body: messageBody } = await req.json()

    if (!wineId) {
      return NextResponse.json({ error: 'wineId is required' }, { status: 400 })
    }
    if (!messageBody?.trim()) {
      return NextResponse.json({ error: 'Message body is required' }, { status: 400 })
    }

    const sb = createServiceClient()

    // Validate wine exists and is active
    const { data: wine, error: wineErr } = await sb
      .from('wines')
      .select('id, name, active')
      .eq('id', wineId)
      .maybeSingle()

    if (wineErr || !wine) {
      return NextResponse.json({ error: 'Wine not found' }, { status: 404 })
    }
    if (!wine.active) {
      return NextResponse.json({ error: 'Wine is not active' }, { status: 400 })
    }

    // Fetch active subscribers only — excludes dormant and deactivated
    const { data: customers, error: custErr } = await sb
      .from('customers')
      .select('id, phone, texts_snoozed_until, tier')
      .eq('status', 'active')

    if (custErr) throw custErr

    if (!customers || customers.length === 0) {
      return NextResponse.json({ error: 'No active customers to send to' }, { status: 400 })
    }

    const trimmedBody = sanitiseGsm7(messageBody.trim())
    const now = new Date()

    const eligible = (customers as Customer[]).filter(
      (c) => !(c.texts_snoozed_until && new Date(c.texts_snoozed_until) > now)
    )
    const palatine = eligible.filter((c) => c.tier === 'palatine')
    const rest = eligible.filter((c) => c.tier !== 'palatine')

    // Only split into two waves if there's an actual Palatine audience — with
    // none, this is identical to the old one-shot send.
    const splitWaves = palatine.length > 0
    const wave1 = splitWaves ? palatine : eligible

    // ── Atomically set this as the one active offer ───────────────────────
    await sb.from('texts').update({ is_active: false }).neq('is_active', false)

    const broadcastAt = new Date(now.getTime() + 2 * 60 * 60 * 1000)
    const { data: text, error: textErr } = await sb
      .from('texts')
      .insert({
        wine_id: wineId,
        body: trimmedBody,
        recipient_count: 0,
        is_active: true,
        broadcast_at: splitWaves ? broadcastAt.toISOString() : null,
        broadcast_sent_at: splitWaves ? null : now.toISOString(),
      })
      .select('id')
      .single()

    if (textErr || !text) {
      console.error('[texts/send] failed to insert text row', textErr)
      return NextResponse.json({ error: 'Failed to create text record' }, { status: 500 })
    }

    const { sent, failures } = await sendBlastWave(sb, wave1, trimmedBody)

    await sb.from('texts').update({ recipient_count: sent }).eq('id', text.id)

    console.log(`[texts/send] textId=${text.id} sent=${sent} failures=${failures.length} splitWaves=${splitWaves}`)

    return NextResponse.json({
      ok: true,
      textId: text.id,
      sent,
      failed: failures.length,
      splitWaves,
      remainingCount: splitWaves ? rest.length : 0,
      broadcastAt: splitWaves ? broadcastAt.toISOString() : null,
      ...(failures.length > 0 && { failedNumbers: failures }),
    })
  } catch (err) {
    console.error('[texts/send]', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
