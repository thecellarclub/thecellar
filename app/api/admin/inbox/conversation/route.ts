import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/adminAuth'
import { createServiceClient } from '@/lib/supabase'
import { twilioClient } from '@/lib/twilio'

const PAGE_SIZE = 20

type ConversationMessage = {
  sid: string
  direction: 'inbound' | 'outbound'
  body: string
  sentAt: string
  status: string
  errorCode: number | null
  segments: number
}

export async function GET(req: NextRequest) {
  const auth = await requireAdminSession()
  if (!auth.ok) return auth.response

  const customerId = req.nextUrl.searchParams.get('customerId')
  const pageToken = req.nextUrl.searchParams.get('pageToken')

  if (!customerId) {
    return NextResponse.json({ error: 'customerId is required' }, { status: 400 })
  }

  const sb = createServiceClient()
  const { data: customer } = await sb
    .from('customers')
    .select('phone')
    .eq('id', customerId)
    .maybeSingle()

  if (!customer) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
  }

  const ours = process.env.TWILIO_PHONE_NUMBER!
  const dateSentBefore = pageToken ? new Date(pageToken) : undefined

  let outbound: Awaited<ReturnType<typeof twilioClient.messages.list>>
  let inbound: Awaited<ReturnType<typeof twilioClient.messages.list>>
  try {
    [outbound, inbound] = await Promise.all([
      twilioClient.messages.list({
        to: customer.phone,
        from: ours,
        limit: PAGE_SIZE * 2,
        ...(dateSentBefore ? { dateSentBefore } : {}),
      }),
      twilioClient.messages.list({
        from: customer.phone,
        to: ours,
        limit: PAGE_SIZE * 2,
        ...(dateSentBefore ? { dateSentBefore } : {}),
      }),
    ])
  } catch (err) {
    console.error('[admin/inbox/conversation] Twilio fetch failed', err)
    return NextResponse.json({ error: 'twilio_unavailable' }, { status: 502 })
  }

  // De-dupe by sid, normalise direction
  const bySid = new Map<string, ConversationMessage>()
  for (const msg of [...outbound, ...inbound]) {
    if (bySid.has(msg.sid)) continue
    const sentAt = (msg.dateSent ?? msg.dateCreated).toISOString()
    bySid.set(msg.sid, {
      sid: msg.sid,
      direction: msg.direction.startsWith('outbound') ? 'outbound' : 'inbound',
      body: msg.body ?? '',
      sentAt,
      status: msg.status,
      errorCode: msg.errorCode ?? null,
      segments: Number(msg.numSegments ?? 1),
    })
  }

  // Sort newest first for cursoring
  const sortedDesc = Array.from(bySid.values()).sort((a, b) => b.sentAt.localeCompare(a.sentAt))

  const page = sortedDesc.slice(0, PAGE_SIZE)
  const hasMore = sortedDesc.length > PAGE_SIZE || outbound.length === PAGE_SIZE * 2 || inbound.length === PAGE_SIZE * 2
  const nextPageToken = page.length > 0 ? page[page.length - 1].sentAt : null

  // Return oldest -> newest
  const messages = [...page].reverse()

  return NextResponse.json({
    messages,
    hasMore,
    nextPageToken: hasMore ? nextPageToken : null,
  })
}
