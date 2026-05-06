import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase'
import { penceToGbp } from '@/lib/format'
import OrdersClientView from '@/app/admin/_components/OrdersClientView'

export default async function OrdersPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/admin/login')

  const sb = createServiceClient()

  const { data: orders } = await sb
    .from('orders')
    .select('id, quantity, price_pence, total_pence, stripe_charge_status, order_status, created_at, wine_id, customer_id, wines(name), customers(first_name, phone)')
    .order('created_at', { ascending: false })
    .limit(200)

  const rows = (orders ?? []) as unknown as {
    id: string
    quantity: number
    price_pence: number
    total_pence: number
    stripe_charge_status: string
    order_status: string
    created_at: string
    wine_id: string
    customer_id: string
    wines: { name: string } | null
    customers: { first_name: string; phone: string } | null
  }[]

  const total = rows.length
  const revenue = rows
    .filter((o) => o.stripe_charge_status === 'succeeded')
    .reduce((s, o) => s + o.total_pence, 0)

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Orders</h1>

      {/* Stat strip */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-700 uppercase tracking-wide font-medium">Orders loaded</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{total}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-700 uppercase tracking-wide font-medium">Total revenue</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{penceToGbp(revenue)}</p>
        </div>
      </div>

      <OrdersClientView orders={rows} />
    </div>
  )
}
