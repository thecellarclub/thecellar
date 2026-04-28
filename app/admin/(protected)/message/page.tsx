import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase'
import SendMessageForm from '@/app/admin/_components/SendMessageForm'

export default async function SendMessagePage({
  searchParams,
}: {
  searchParams?: Promise<{ phone?: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/admin/login')

  const sb = createServiceClient()
  const { data: customers } = await sb
    .from('customers')
    .select('id, first_name, phone')
    .eq('active', true)
    .order('first_name')

  const params = await searchParams
  const initialPhone = params?.phone ?? ''

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Send message</h1>
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <SendMessageForm customers={customers ?? []} initialPhone={initialPhone} />
      </div>
    </div>
  )
}
