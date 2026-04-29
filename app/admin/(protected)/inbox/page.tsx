import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase'
import InboxClientView, { type InboxThread } from '@/app/admin/_components/InboxClientView'

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
  } | null
}

type SpecialRequest = {
  id: string
  customer_id: string
  message: string
  status: string
}

export default async function InboxPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/admin/login')

  const sb = createServiceClient()

  const [{ data: messages }, { data: openRequests }, { data: customers }] = await Promise.all([
    sb
      .from('concierge_messages')
      .select('id, customer_id, message, direction, created_at, category, context, customers(first_name, phone, concierge_status)')
      .order('created_at', { ascending: true }),
    sb
      .from('special_requests')
      .select('id, customer_id, message, status')
      .neq('status', 'resolved'),
    sb
      .from('customers')
      .select('id, first_name, phone')
      .eq('active', true)
      .order('first_name'),
  ])

  const rows = (messages ?? []) as unknown as ConciergeMessage[]
  const requests = (openRequests ?? []) as SpecialRequest[]

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
    if (!threadMap.has(cid)) {
      threadMap.set(cid, {
        customerId: cid,
        firstName: msg.customers?.first_name ?? null,
        phone: msg.customers?.phone ?? null,
        status: (msg.customers?.concierge_status ?? 'open') as 'open' | 'closed',
        messages: [],
        openRequest: requestByCustomer.get(cid) ?? null,
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

  // Sort: unreplied open first, then replied open, then closed (newest first within groups)
  const threads = Array.from(threadMap.values()).sort((a, b) => {
    const aLast = a.messages[a.messages.length - 1]
    const bLast = b.messages[b.messages.length - 1]
    const aClosed = a.status === 'closed'
    const bClosed = b.status === 'closed'
    const aUnanswered = !aClosed && aLast?.direction === 'inbound'
    const bUnanswered = !bClosed && bLast?.direction === 'inbound'
    if (aUnanswered !== bUnanswered) return aUnanswered ? -1 : 1
    if (aClosed !== bClosed) return aClosed ? 1 : -1
    return (bLast?.created_at ?? '').localeCompare(aLast?.created_at ?? '')
  })

  const unansweredCount = threads.filter(
    (t) => t.status === 'open' && t.messages[t.messages.length - 1]?.direction === 'inbound'
  ).length

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-semibold text-gray-900 mb-1">
        Inbox{' '}
        <span className="text-gray-400 font-normal text-base">
          ({threads.length} conversation{threads.length !== 1 ? 's' : ''})
        </span>
      </h1>
      {unansweredCount > 0 && (
        <p className="text-sm text-red-700 font-medium mb-4">
          {unansweredCount} unanswered
        </p>
      )}
      {unansweredCount === 0 && <div className="mb-4" />}

      <InboxClientView threads={threads} customers={customers ?? []} />
    </div>
  )
}
