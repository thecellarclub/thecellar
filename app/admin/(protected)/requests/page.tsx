import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase'
import { formatDateTime } from '@/lib/format'
import ResolveButton from '@/app/admin/_components/ResolveButton'
import RequestsMobileCard from '@/app/admin/_components/RequestsMobileCard'

type SpecialRequest = {
  id: string
  message: string
  status: string
  created_at: string
  customers: {
    first_name: string | null
    phone: string | null
  } | null
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    new: 'bg-red-100 text-red-700',
    in_progress: 'bg-amber-100 text-amber-700',
    resolved: 'bg-green-100 text-green-700',
  }
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded font-medium ${styles[status] ?? 'bg-gray-100 text-gray-600'}`}
    >
      {status.replace('_', ' ')}
    </span>
  )
}

export default async function RequestsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/admin/login')

  const sb = createServiceClient()

  const { data: requests } = await sb
    .from('special_requests')
    .select('id, message, status, created_at, customers(first_name, phone)')
    .order('created_at', { ascending: false })

  const rows = (requests ?? []) as unknown as SpecialRequest[]
  const openCount = rows.filter((r) => r.status !== 'resolved').length

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            Special Requests{' '}
            <span className="text-gray-400 font-normal text-base">({rows.length})</span>
          </h1>
          {openCount > 0 && (
            <p className="text-sm text-gray-500 mt-0.5">
              <span className="text-amber-700 font-medium">{openCount} open</span>
            </p>
          )}
        </div>
      </div>

      {/* ── Mobile card list (hidden on md+) ── */}
      <div className="md:hidden space-y-3">
        {rows.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-400 text-sm">
            No special requests yet
          </div>
        ) : (
          rows.map((r) => (
            <RequestsMobileCard
              key={r.id}
              request={{
                id: r.id,
                message: r.message,
                status: r.status,
                created_at: r.created_at,
                customerName: r.customers?.first_name ?? null,
                customerPhone: r.customers?.phone ?? null,
              }}
            />
          ))
        )}
      </div>

      {/* ── Desktop table (hidden below md) ── */}
      <div className="hidden md:block bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              {['Customer', 'Phone', 'Message', 'Status', 'Date', 'Actions'].map((h) => (
                <th
                  key={h}
                  className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide border-b border-gray-200 px-4 py-2 bg-gray-50"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No special requests yet
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 align-top">
                  <td className="px-4 py-3 border-b border-gray-100 font-medium text-gray-900 whitespace-nowrap">
                    {r.customers?.first_name ?? '—'}
                  </td>
                  <td className="px-4 py-3 border-b border-gray-100 font-mono text-xs text-gray-600 whitespace-nowrap">
                    {r.customers?.phone ?? '—'}
                  </td>
                  <td className="px-4 py-3 border-b border-gray-100 text-gray-700 max-w-sm">
                    {r.message}
                  </td>
                  <td className="px-4 py-3 border-b border-gray-100 whitespace-nowrap">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3 border-b border-gray-100 text-xs text-gray-500 whitespace-nowrap">
                    {formatDateTime(r.created_at)}
                  </td>
                  <td className="px-4 py-3 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      {r.customers?.phone && (
                        <a
                          href={`/admin/message?phone=${encodeURIComponent(r.customers.phone)}`}
                          className="text-xs px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                        >
                          Reply
                        </a>
                      )}
                      <ResolveButton requestId={r.id} currentStatus={r.status} />
                    </div>
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
