import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getCaseDaysByCustomer } from '@/lib/case-days'
import { Resend } from 'resend'

const FROM_EMAIL = 'The Cellar Club <cheers@thecellar.club>'
const SLOW_CELLAR_DAYS_THRESHOLD = 120
const SLOW_CELLAR_CAP = 10

function truncate(str: string, len: number): string {
  return str.length > len ? str.slice(0, len) + '…' : str
}

function formatPhone(phone: string | null): string {
  if (!phone) return 'unknown'
  return phone.slice(-7) // last 7 digits for brevity
}

function customerLabel(customer: { first_name: string | null; last_name: string | null; phone: string | null }): string {
  const nameStr = [customer.first_name, customer.last_name ? customer.last_name[0] + '.' : null]
    .filter(Boolean).join(' ') || formatPhone(customer.phone)
  const phoneStr = customer.phone ? `(+${customer.phone.replace(/^\+/, '').slice(0, 2)}…${customer.phone.slice(-4)})` : ''
  return `${nameStr} ${phoneStr}`.trim()
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey || resendKey.startsWith('re_placeholder')) {
    console.warn('[inbox-digest] RESEND_API_KEY not configured — skipping')
    return NextResponse.json({ ok: true, skipped: true })
  }

  const sb = createServiceClient()
  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

  // Fetch all admin users
  const { data: adminUsers } = await sb
    .from('admin_users')
    .select('id, name, email')

  if (!adminUsers || adminUsers.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 })
  }

  // Fetch all open/relevant threads from customers
  const { data: customers } = await sb
    .from('customers')
    .select(`
      id, first_name, last_name, phone,
      concierge_status,
      inbox_assigned_to,
      inbox_follow_up_date,
      inbox_follow_up_note
    `)
    .or('concierge_status.eq.open,inbox_follow_up_date.lte.' + today)

  // Get last message direction for each customer with a thread
  const customerIds = (customers ?? []).map((c: { id: string }) => c.id)
  const { data: lastMessages } = customerIds.length > 0
    ? await sb
        .from('concierge_messages')
        .select('customer_id, direction, message, created_at')
        .in('customer_id', customerIds)
        .order('created_at', { ascending: false })
    : { data: [] }

  // Build last-message map per customer
  const lastMsgMap = new Map<string, { direction: string; message: string; created_at: string }>()
  for (const msg of (lastMessages ?? []) as { customer_id: string; direction: string; message: string; created_at: string }[]) {
    if (!lastMsgMap.has(msg.customer_id)) {
      lastMsgMap.set(msg.customer_id, msg)
    }
  }

  // ── Slow-filling cellars — same list for every admin (not assigned to
  // anyone), so the team can push people along manually (e.g. a
  // free-at-6 grant) even though nothing else in the inbox needs them.
  const caseDaysMap = await getCaseDaysByCustomer(sb)
  const { data: activeCustomers } = await sb
    .from('customers')
    .select('id, first_name, last_name, phone')
    .eq('status', 'active')

  const slowCellars = (activeCustomers ?? [])
    .map((c) => ({ customer: c, info: caseDaysMap.get(c.id) }))
    .filter((x): x is { customer: typeof x.customer; info: { bottles: number; daysFilling: number } } =>
      !!x.info && x.info.bottles > 0 && x.info.daysFilling >= SLOW_CELLAR_DAYS_THRESHOLD
    )
    .sort((a, b) => b.info.daysFilling - a.info.daysFilling)

  const slowCellarLines = slowCellars.slice(0, SLOW_CELLAR_CAP).map(({ customer, info }) =>
    `- ${customerLabel(customer)}: ${info.bottles} bottle${info.bottles !== 1 ? 's' : ''}, ${info.daysFilling} days filling — consider a free-at-6 grant`
  )
  if (slowCellars.length > SLOW_CELLAR_CAP) {
    slowCellarLines.push(`…and ${slowCellars.length - SLOW_CELLAR_CAP} more`)
  }

  const resend = new Resend(resendKey)
  let sent = 0

  for (const admin of adminUsers as { id: string; name: string; email: string }[]) {
    const overdueFollowUps: string[] = []
    const todayFollowUps: string[] = []
    const awaitingReply: string[] = []
    const unassignedAwaiting: string[] = []

    for (const customer of (customers ?? []) as {
      id: string
      first_name: string | null
      last_name: string | null
      phone: string | null
      concierge_status: string | null
      inbox_assigned_to: string | null
      inbox_follow_up_date: string | null
      inbox_follow_up_note: string | null
    }[]) {
      const label = customerLabel(customer)

      // Follow-up items
      if (customer.inbox_follow_up_date && customer.inbox_assigned_to === admin.id) {
        const note = customer.inbox_follow_up_note
          ? `"${truncate(customer.inbox_follow_up_note, 60)}"`
          : `due ${customer.inbox_follow_up_date}`
        const line = `- ${label}: ${note}`
        if (customer.inbox_follow_up_date < today) {
          overdueFollowUps.push(line + ` — due ${customer.inbox_follow_up_date} (overdue)`)
        } else if (customer.inbox_follow_up_date === today) {
          todayFollowUps.push(line + ` — due today`)
        }
      }

      // Unanswered threads
      const lastMsg = lastMsgMap.get(customer.id)
      if (customer.concierge_status === 'open' && lastMsg?.direction === 'inbound') {
        const ago = lastMsg.created_at
          ? `${Math.round((Date.now() - new Date(lastMsg.created_at).getTime()) / 3600000)}h ago`
          : ''
        const preview = truncate(lastMsg.message, 60)
        const line = `- ${label}: last message ${ago} — "${preview}"`
        if (customer.inbox_assigned_to === admin.id) {
          awaitingReply.push(line)
        } else if (!customer.inbox_assigned_to) {
          unassignedAwaiting.push(line)
        }
      }
    }

    const totalItems = overdueFollowUps.length + todayFollowUps.length + awaitingReply.length
      + unassignedAwaiting.length + slowCellars.length
    if (totalItems === 0) continue

    const sections: string[] = [
      `Morning ${admin.name}! Here's what needs attention in the inbox today:\n`,
    ]

    if (overdueFollowUps.length > 0 || todayFollowUps.length > 0) {
      sections.push('DUE TODAY / OVERDUE')
      sections.push(...overdueFollowUps, ...todayFollowUps)
      sections.push('')
    }

    if (awaitingReply.length > 0) {
      sections.push('AWAITING REPLY (assigned to you)')
      sections.push(...awaitingReply)
      sections.push('')
    }

    if (unassignedAwaiting.length > 0) {
      sections.push('UNASSIGNED & AWAITING REPLY')
      sections.push(...unassignedAwaiting)
      sections.push('')
    }

    if (slowCellarLines.length > 0) {
      sections.push('SLOW-FILLING CELLARS')
      sections.push(...slowCellarLines)
      sections.push('')
    }

    sections.push('→ Open inbox: https://thecellar.club/admin/inbox')

    const emailText = sections.join('\n')

    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: admin.email,
        subject: `Inbox digest — ${totalItems} item${totalItems !== 1 ? 's' : ''} need attention`,
        text: emailText,
      })
      sent++
    } catch (err) {
      console.error(`[inbox-digest] failed to send to ${admin.email}:`, err)
    }
  }

  return NextResponse.json({ ok: true, sent })
}
