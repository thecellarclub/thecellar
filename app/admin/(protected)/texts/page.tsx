import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase'
import { formatDateTime } from '@/lib/format'
import Link from 'next/link'

export default async function TextsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/admin/login')

  const sb = createServiceClient()

  const { data: texts } = await sb
    .from('texts')
    .select('id, body, sent_at, recipient_count, is_active, wines(name)')
    .order('sent_at', { ascending: false })

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Offer history</h1>
        <Link
          href="/admin/send"
          className="bg-gray-900 text-white text-sm px-4 py-2 rounded hover:bg-gray-700"
        >
          Send new offer
        </Link>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                {['Wine', 'Message', 'Recipients', 'Status', 'Sent'].map((h) => (
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
              {(texts ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                    No texts sent yet
                  </td>
                </tr>
              ) : (
                (texts ?? []).map((t) => {
                  const wine = t.wines as unknown as { name: string } | null
                  return (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 border-b border-gray-100 font-medium">
                        <Link href={`/admin/texts/${t.id}`} className="hover:underline">
                          {wine?.name ?? '—'}
                        </Link>
                      </td>
                      <td className="px-4 py-3 border-b border-gray-100 max-w-sm">
                        <p className="truncate text-gray-600">{t.body}</p>
                      </td>
                      <td className="px-4 py-3 border-b border-gray-100 text-center">
                        {t.recipient_count ?? 0}
                      </td>
                      <td className="px-4 py-3 border-b border-gray-100">
                        {t.is_active ? (
                          <span className="text-xs px-2 py-0.5 rounded font-medium bg-green-100 text-green-700">
                            Active offer
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded font-medium bg-gray-100 text-gray-500">
                            Closed
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 border-b border-gray-100 text-gray-500 text-xs whitespace-nowrap">
                        {formatDateTime(t.sent_at)}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
