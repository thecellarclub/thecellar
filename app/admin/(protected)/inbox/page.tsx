import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase'
import InboxClientView, { type InboxThread, type SmsContextMsg, type InboxNote, type ActivityEntry, type AdminUser } from '@/app/admin/_components/InboxClientView'

type ConciergeMessage = {
  id: string
  customer_id: string
  message: string
  direction: 'inbound' | 'outbound'
  created_at: string
  category: string | null
  context: string | null
  customers: {
    first_name: string | null
    phone: string | null
    concierge_status: string | null
    inbox_assigned_to: string | null
    inbox_assigned_at: string | null
    inbox_follow_up_date: string | null
    inbox_follow_up_note: string | null
    inbox_follow_up_set_by: string | null
  } | null
}

type SpecialRequest = {
  id: string
  customer_id: string
  message: string
  status: string
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ customer?: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/admin/login')

  const { customer: initialCustomerId } = await searchParams

  const sb = createServiceClient()

  const [
    { data: messages },
    { data: openRequests },
    { data: customers },
    { data: adminUsersData },
  ] = await Promise.all([
    sb
      .from('concierge_messages')
      .select(`
        id, customer_id, message, direction, created_at, category, context,
        customers(
          first_name, phone, concierge_status,
          inbox_assigned_to, inbox_assigned_at,
          inbox_follow_up_date, inbox_follow_up_note, inbox_follow_up_set_by
        )
      `)
      .order('created_at', { ascending: true }),
    sb
      .from('special_requests')
      .select('id, customer_id, message, status')
      .neq('status', 'resolved'),
    sb
      .from('customers')
      .select('id, first_name, phone')
      .eq('status', 'active')
      .order('first_name'),
    sb
      .from('admin_users')
      .select('id, name, email')
      .order('name'),
  ])

  const rows = (messages ?? []) as unknown as ConciergeMessage[]
  const requests = (openRequests ?? []) as SpecialRequest[]
  const adminUsers: AdminUser[] = (adminUsersData ?? []) as AdminUser[]

  // Index non-resolved requests by customer_id (most recent per customer)
  const requestByCustomer = new Map<string, { id: string; message: string; status: string }>()
  for (const req of requests) {
    if (!requestByCustomer.has(req.customer_id)) {
      requestByCustomer.set(req.customer_id, {
        id: req.id,
        message: req.message,
        status: req.status,
      })
    }
  }

  // Group messages by customer into threads
  const threadMap = new Map<string, InboxThread>()
  for (const msg of rows) {
    const cid = msg.customer_id
    const cust = msg.customers
    if (!threadMap.has(cid)) {
      threadMap.set(cid, {
        customerId: cid,
        firstName: cust?.first_name ?? null,
        phone: cust?.phone ?? null,
        status: (cust?.concierge_status ?? 'open') as 'open' | 'closed',
        assignedTo: cust?.inbox_assigned_to ?? null,
        assignedAt: cust?.inbox_assigned_at ?? null,
        followUpDate: cust?.inbox_follow_up_date ?? null,
        followUpNote: cust?.inbox_follow_up_note ?? null,
        messages: [],
        openRequest: requestByCustomer.get(cid) ?? null,
        smsContext: [],
        notes: [],
        activity: [],
      })
    }
    threadMap.get(cid)!.messages.push({
      id: msg.id,
      customer_id: msg.customer_id,
      message: msg.message,
      direction: msg.direction,
      created_at: msg.created_at,
      category: msg.category ?? undefined,
      context: msg.context ?? undefined,
    })
  }

  const customerIds = Array.from(threadMap.keys())

  // Parallel: SMS context + notes + activity
  if (customerIds.length > 0) {
    const [{ data: smsRows }, { data: notesRows }, { data: activityRows }] = await Promise.all([
      sb
        .from('sms_messages')
        .select('id, customer_id, direction, body, created_at')
        .in('customer_id', customerIds)
        .order('created_at', { ascending: false })
        .limit(600),
      sb
        .from('inbox_notes')
        .select('id, customer_id, author_id, body, created_at, admin_users(name)')
        .in('customer_id', customerIds)
        .order('created_at', { ascending: true }),
      sb
        .from('inbox_activity')
        .select('id, customer_id, actor_id, action, detail, created_at, admin_users(name)')
        .in('customer_id', customerIds)
        .order('created_at', { ascending: false })
        .limit(500),
    ])

    // SMS context
    const contextAcc = new Map<string, SmsContextMsg[]>()
    for (const row of (smsRows ?? []) as { id: string; customer_id: string; direction: string; body: string; created_at: string }[]) {
      const thread = threadMap.get(row.customer_id)
      if (!thread) continue
      const firstAt = thread.messages[0]?.created_at
      if (!firstAt || row.created_at >= firstAt) continue
      const existing = contextAcc.get(row.customer_id) ?? []
      if (existing.length < 3) {
        contextAcc.set(row.customer_id, [...existing, {
          id: row.id,
          direction: row.direction as 'inbound' | 'outbound',
          body: row.body,
          created_at: row.created_at,
        }])
      }
    }
    for (const [cid, msgs] of contextAcc) {
      threadMap.get(cid)!.smsContext = [...msgs].reverse()
    }

    // Notes
    for (const row of (notesRows ?? []) as unknown as {
      id: string
      customer_id: string
      author_id: string
      body: string
      created_at: string
      admin_users: { name: string } | null
    }[]) {
      threadMap.get(row.customer_id)?.notes.push({
        id: row.id,
        customer_id: row.customer_id,
        author_id: row.author_id,
        author_name: row.admin_users?.name ?? 'Unknown',
        body: row.body,
        created_at: row.created_at,
      })
    }

    // Activity
    for (const row of (activityRows ?? []) as unknown as {
      id: string
      customer_id: string
      actor_id: string
      action: string
      detail: string | null
      created_at: string
      admin_users: { name: string } | null
    }[]) {
      threadMap.get(row.customer_id)?.activity.push({
        id: row.id,
        customer_id: row.customer_id,
        actor_id: row.actor_id,
        actor_name: row.admin_users?.name ?? 'Unknown',
        action: row.action,
        detail: row.detail ?? null,
        created_at: row.created_at,
      })
    }
  }

  const today = new Date().toISOString().slice(0, 10)

  // Sort: overdue follow-ups → today follow-ups → unanswered open → answered open → closed
  const threads = Array.from(threadMap.values()).sort((a, b) => {
    const aLast = a.messages[a.messages.length - 1]
    const bLast = b.messages[b.messages.length - 1]
    const aClosed = a.status === 'closed'
    const bClosed = b.status === 'closed'
    const aUnanswered = !aClosed && aLast?.direction === 'inbound'
    const bUnanswered = !bClosed && bLast?.direction === 'inbound'

    // Follow-up priority
    const aOverdue = a.followUpDate && a.followUpDate <= today
    const bOverdue = b.followUpDate && b.followUpDate <= today
    const aToday = a.followUpDate === today && !aOverdue
    const bToday = b.followUpDate === today && !bOverdue

    if (aOverdue !== bOverdue) return aOverdue ? -1 : 1
    if (aToday !== bToday) return aToday ? -1 : 1
    if (aUnanswered !== bUnanswered) return aUnanswered ? -1 : 1
    if (aClosed !== bClosed) return aClosed ? 1 : -1
    return (bLast?.created_at ?? '').localeCompare(aLast?.created_at ?? '')
  })

  const unansweredCount = threads.filter(
    (t) => t.status === 'open' && t.messages[t.messages.length - 1]?.direction === 'inbound'
  ).length

  const currentUser = {
    id: session.user?.id ?? 'admin',
    name: session.user?.name ?? 'Admin',
    email: session.user?.email ?? '',
  }

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-xl font-semibold text-gray-900 mb-1">
        Inbox{' '}
        <span className="text-gray-500 font-normal text-base">
          ({threads.length} conversation{threads.length !== 1 ? 's' : ''})
        </span>
      </h1>
      {unansweredCount > 0 && (
        <p className="text-sm text-red-700 font-medium mb-4">
          {unansweredCount} unanswered
        </p>
      )}
      {unansweredCount === 0 && <div className="mb-4" />}

      <InboxClientView
        threads={threads}
        customers={customers ?? []}
        adminUsers={adminUsers}
        currentUser={currentUser}
        initialCustomerId={initialCustomerId}
      />
    </div>
  )
}
