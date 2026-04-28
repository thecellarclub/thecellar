import { NextRequest, NextResponse } from 'next/server'
import { twilioClient, sanitiseGsm7 } from '@/lib/twilio'
import { createServiceClient } from '@/lib/supabase'

// POST /api/texts/send
// Admin endpoint — sends a text blast to all active customers for a given wine.
// Auth is enforced by middleware.ts for all /api/admin/* routes.
// This route lives under /api/texts/ (not /api/admin/) so admin UI calls it
// directly; the admin session check will be added when the admin UI is wired up.

interface Customer {
  id: string
  phone: string
  texts_snoozed_until: string | null
}

export async function POST(req: NextRequest) {
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

    // Fetch all active subscribers (including snooze field)
    const { data: customers, error: custErr } = await sb
      .from('customers')
      .select('id, phone, texts_snoozed_until')
      .eq('active', true)

    if (custErr) throw custErr

    if (!customers || customers.length === 0) {
      return NextResponse.json({ error: 'No active customers to send to' }, { status: 400 })
    }

    const trimmedBody = sanitiseGsm7(messageBody.trim())

    // ── Atomically set this as the one active offer ───────────────────────
    // 1. Deactivate all existing texts
    await sb.from('texts').update({ is_active: false }).neq('is_active', false)

    // 2. Insert new text row as the active offer (recipient_count updated after send)
    const { data: text, error: textErr } = await sb
      .from('texts')
      .insert({
        wine_id: wineId,
        body: trimmedBody,
        recipient_count: 0,
        is_active: true,
      })
      .select('id')
      .single()

    if (textErr || !text) {
      console.error('[texts/send] failed to insert text row', textErr)
      return NextResponse.json({ error: 'Failed to create text record' }, { status: 500 })
    }

    // ── Send to each customer — skip snoozed, log failures but don't abort ──
    let sent = 0
    const failures: string[] = []
    const recipientIds: string[] = []

    for (const customer of customers as Customer[]) {
      // Skip snoozed customers
      if (customer.texts_snoozed_until && new Date(customer.texts_snoozed_until) > new Date()) {
        continue
      }

      try {
        await twilioClient.messages.create({
          to: customer.phone,
          from: process.env.TWILIO_PHONE_NUMBER!,
          body: trimmedBody,
        })
        sent++
        recipientIds.push(customer.id)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`[texts/send] failed for ${customer.phone}:`, msg)
        failures.push(customer.phone)
      }
    }

    // Update recipient_count with the actual number sent
    await sb
      .from('texts')
      .update({ recipient_count: sent })
      .eq('id', text.id)

    // Set sms_awaiting = 'offer' on all successfully-reached customers
    if (recipientIds.length > 0) {
      await sb
        .from('customers')
        .update({ sms_awaiting: 'offer' })
        .in('id', recipientIds)

      // Increment offers_received for each customer reached
      await Promise.all(
        recipientIds.map((cid) =>
          sb.rpc('increment_offers_received', { customer_id: cid })
        )
      )
    }

    console.log(`[texts/send] textId=${text.id} sent=${sent} failures=${failures.length}`)

    return NextResponse.json({
      ok: true,
      textId: text.id,
      sent,
      failed: failures.length,
      ...(failures.length > 0 && { failedNumbers: failures }),
    })
  } catch (err) {
    console.error('[texts/send]', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
