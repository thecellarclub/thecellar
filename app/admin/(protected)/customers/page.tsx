import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase'
import CustomersClientView from '@/app/admin/_components/CustomersClientView'

export default async function CustomersPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/admin/login')

  const sb = createServiceClient()

  const { data: customers } = await sb
    .from('customers')
    .select('id, first_name, last_name, phone, email, active, subscribed_at, tier')
    .order('subscribed_at', { ascending: false })

  const { data: cellarTotals } = await sb
    .from('customer_cellar_totals')
    .select('customer_id, total_bottles')

  const totalsMap = new Map(
    (cellarTotals ?? []).map((r) => [r.customer_id, Number(r.total_bottles ?? 0)])
  )

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Customers</h1>
      <CustomersClientView
        customers={(customers ?? []) as {
          id: string
          first_name: string | null
          last_name: string | null
          phone: string
          email: string | null
          active: boolean
          subscribed_at: string
          tier: string | null
        }[]}
        totalsMap={totalsMap}
      />
    </div>
  )
}
