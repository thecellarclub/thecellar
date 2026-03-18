import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase'
import SendBlastForm from '@/app/admin/_components/SendBlastForm'

export default async function SendPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/admin/login')

  const sb = createServiceClient()

  const [{ data: wines }, { count: subscriberCount }] = await Promise.all([
    sb
      .from('wines')
      .select('id, name, region, country, description, price_pence')
      .eq('active', true)
      .order('name'),
    sb.from('customers').select('*', { count: 'exact', head: true }).eq('active', true),
  ])

  const activeWines = wines ?? []

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Send text blast</h1>

      {activeWines.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          No active wines found. Add an active wine in the{' '}
          <a href="/admin/wines" className="underline font-medium">Wine library</a>{' '}
          before sending a blast.
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <SendBlastForm wines={activeWines} subscriberCount={subscriberCount ?? 0} />
        </div>
      )}
    </div>
  )
}
