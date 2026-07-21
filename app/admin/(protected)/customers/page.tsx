import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase'
import { getCaseDaysByCustomer } from '@/lib/case-days'
import CustomersClientView from '@/app/admin/_components/CustomersClientView'

export default async function CustomersPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/admin/login')

  const sb = createServiceClient()

  const { data: customers } = await sb
    .from('customers')
    .select('id, first_name, last_name, phone, email, status, subscribed_at, tier')
    .order('subscribed_at', { ascending: false })

  const caseDaysMap = await getCaseDaysByCustomer(sb)

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
          status: string
          subscribed_at: string
          tier: string | null
        }[]}
        caseDaysMap={caseDaysMap}
      />
    </div>
  )
}
