import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase'
import { formatDate } from '@/lib/format'
import Link from 'next/link'

export default async function CustomersPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/admin/login')

  const sb = createServiceClient()

  const { data: customers } = await sb
    .from('customers')
    .select('id, first_name, phone, email, active, subscribed_at')
    .order('subscribed_at', { ascending: false })

  const { data: cellarTotals } = await sb
    .from('customer_cellar_totals')
    .select('customer_id, total_bottles')

  const totalsMap = new Map(
    (cellarTotals ?? []).map((r) => [r.customer_id, Number(r.total_bottles ?? 0)])
  )

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">
        Customers <span className="text-gray-400 font-normal text-base">({customers?.length ?? 0})</span>
      </h1>

      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              {['Name', 'Phone', 'Email', 'Cellar', 'Joined', 'Status'].map((h) => (
                <th key={h} className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide border-b border-gray-200 px-4 py-2 bg-gray-50">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(customers ?? []).length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">No customers yet</td>
              </tr>
            ) : (
              (customers ?? []).map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 border-b border-gray-100">
                    <Link href={`/admin/customers/${c.id}`} className="font-medium text-gray-900 hover:underline">
                      {c.first_name ?? '—'}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 border-b border-gray-100 font-mono text-xs text-gray-600">{c.phone}</td>
                  <td className="px-4 py-2.5 border-b border-gray-100 text-gray-600">{c.email}</td>
                  <td className="px-4 py-2.5 border-b border-gray-100">
                    <span className="font-medium">{totalsMap.get(c.id) ?? 0}</span>
                    <span className="text-gray-400 text-xs ml-1">bottles</span>
                  </td>
                  <td className="px-4 py-2.5 border-b border-gray-100 text-gray-500 text-xs">{formatDate(c.subscribed_at)}</td>
                  <td className="px-4 py-2.5 border-b border-gray-100">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${c.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {c.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
