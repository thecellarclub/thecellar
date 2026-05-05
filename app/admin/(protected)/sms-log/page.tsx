import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase'
import SmsLogClientView from './_components/SmsLogClientView'

export default async function SmsLogPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/admin/login')

  const sb = createServiceClient()
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [{ data: messages }, { count: count24h }] = await Promise.all([
    sb
      .from('sms_messages')
      .select('id, phone, direction, body, trigger, created_at, customer_id, customers(id, first_name, phone)')
      .gte('created_at', since7d)
      .order('created_at', { ascending: false })
      .limit(100),
    sb
      .from('sms_messages')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', since24h),
  ])

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <h1 className="text-xl font-semibold text-gray-900 mb-1">Message log</h1>
      <p className="text-sm text-gray-500 mb-6">{count24h ?? 0} messages in the last 24h · showing last 7 days</p>
      <SmsLogClientView messages={(messages ?? []) as unknown as SmsMessageRow[]} />
    </div>
  )
}

export type SmsMessageRow = {
  id: string
  phone: string
  direction: 'inbound' | 'outbound'
  body: string
  trigger: string | null
  created_at: string
  customer_id: string | null
  customers: { id: string; first_name: string | null; phone: string | null } | null
}
