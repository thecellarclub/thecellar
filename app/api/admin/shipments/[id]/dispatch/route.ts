import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireAdminSession } from '@/lib/adminAuth'
import { twilioClient, sanitiseGsm7 } from '@/lib/twilio'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? ''

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession()
  if (!auth.ok) return auth.response

  const { id } = await params
  const body = await req.json() as {
    action: 'dispatch' | 'update_tracking'
    tracking_provider?: string
    tracking_number?: string
  }

  const sb = createServiceClient()

  if (body.action === 'update_tracking') {
    const updates: Record<string, unknown> = {}
    if (body.tracking_provider !== undefined) updates.tracking_provider = body.tracking_provider
    if (body.tracking_number !== undefined) updates.tracking_number = body.tracking_number

    const { error } = await sb.from('shipments').update(updates).eq('id', id)
    if (error) {
      console.error('[admin/shipments/dispatch] update_tracking error', error)
      return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  }

  if (body.action === 'dispatch') {
    const updates: Record<string, unknown> = {
      status: 'dispatched',
      dispatched_at: new Date().toISOString(),
    }
    if (body.tracking_provider) updates.tracking_provider = body.tracking_provider
    if (body.tracking_number) updates.tracking_number = body.tracking_number

    const { error } = await sb.from('shipments').update(updates).eq('id', id)
    if (error) {
      console.error('[admin/shipments/dispatch] dispatch error', error)
      return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    }

    // Send SMS to customer if tracking number provided
    if (body.tracking_number) {
      const { data: shipment } = await sb
        .from('shipments')
        .select('customers(phone, first_name)')
        .eq('id', id)
        .maybeSingle()

      const customer = shipment?.customers as unknown as { phone: string; first_name: string | null } | null
      if (customer?.phone) {
        const carrierPart = body.tracking_provider ? ` via ${body.tracking_provider}` : ''
        const smsBody = sanitiseGsm7(`Your Cellar Club bottles are on their way${carrierPart}! Tracking number: ${body.tracking_number}. Visit ${APP_URL}/portal if you have any questions.`)
        await twilioClient.messages.create({
          to: customer.phone,
          from: process.env.TWILIO_PHONE_NUMBER!,
          body: smsBody,
        }).catch((err: unknown) => {
          console.error('[admin/shipments/dispatch] SMS send failed', err)
        })
      }
    }

    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
