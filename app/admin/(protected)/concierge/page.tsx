import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase'
import ConciergeClientView, { type ConciergeThread } from '@/app/admin/_components/ConciergeClientView'

type ConciergeMessage = {
  id: string
  customer_id: string
  message: string
  direction: 'inbound' | 'outbound'
  created_at: string
  customers: {
    first_name: string | null
    phone: string | null
  } | null
}

export default async function ConciergePage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/admin/login')

  const sb = createServiceClient()

  const { data: messages } = await sb
    .from('concierge_messages')
    .select('id, customer_id, message, direction, created_at, customers(first_name, phone)')
    .order('created_at', { ascending: true })

  const rows = (messages ?? []) as unknown as ConciergeMessage[]

  // Group by customer, preserving insertion order of first appearance
  const threadMap = new Map<string, ConciergeThread>()
  for (const msg of rows) {
    const cid = msg.customer_id
    if (!threadMap.has(cid)) {
      threadMap.set(cid, {
        customerId: cid,
        firstName: msg.customers?.first_name ?? null,
        phone: msg.customers?.phone ?? null,
        messages: [],
      })
    }
    threadMap.get(cid)!.messages.push({
      id: msg.id,
      customer_id: msg.customer_id,
      message: msg.message,
      direction: msg.direction,
      created_at: msg.created_at,
    })
  }

  // Sort threads newest-first by most recent message
  const threads = Array.from(threadMap.values()).sort((a, b) => {
    const aLast = a.messages[a.messages.length - 1]?.created_at ?? ''
    const bLast = b.messages[b.messages.length - 1]?.created_at ?? ''
    return bLast.localeCompare(aLast)
  })

  const unansweredCount = threads.filter(
    (t) => t.messages[t.messages.length - 1]?.direction === 'inbound'
  ).length

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-semibold text-gray-900 mb-1">
        Concierge{' '}
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

      <ConciergeClientView threads={threads} />
    </div>
  )
}
