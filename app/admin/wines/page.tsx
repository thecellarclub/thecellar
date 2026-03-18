import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase'
import { penceToGbp } from '@/lib/format'
import ToggleWineActive from '../_components/ToggleWineActive'
import WineFormPanel from '../_components/WineFormPanel'
import Link from 'next/link'

export default async function WinesPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/admin/login')

  const sb = createServiceClient()
  const { data: wines } = await sb
    .from('wines')
    .select('id, name, producer, region, country, vintage, price_pence, stock_bottles, active')
    .order('created_at', { ascending: false })

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">
        Wine library <span className="text-gray-400 font-normal text-base">({wines?.length ?? 0})</span>
      </h1>

      {/* Add wine form */}
      <WineFormPanel />

      {/* Wine table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              {['Name', 'Region', 'Price', 'Stock', 'Status', ''].map((h) => (
                <th key={h} className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide border-b border-gray-200 px-4 py-2 bg-gray-50">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(wines ?? []).length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">No wines yet — add one above</td>
              </tr>
            ) : (
              (wines ?? []).map((w) => (
                <tr key={w.id} className={`hover:bg-gray-50 ${!w.active ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-2.5 border-b border-gray-100 font-medium">
                    {w.name}
                    {w.vintage && <span className="text-gray-400 text-xs ml-1">{w.vintage}</span>}
                  </td>
                  <td className="px-4 py-2.5 border-b border-gray-100 text-gray-600">
                    {[w.region, w.country].filter(Boolean).join(', ') || '—'}
                  </td>
                  <td className="px-4 py-2.5 border-b border-gray-100">{penceToGbp(w.price_pence)}</td>
                  <td className="px-4 py-2.5 border-b border-gray-100">
                    <span className={w.stock_bottles === 0 ? 'text-red-600 font-medium' : ''}>{w.stock_bottles}</span>
                  </td>
                  <td className="px-4 py-2.5 border-b border-gray-100">
                    <ToggleWineActive wineId={w.id} active={w.active} />
                  </td>
                  <td className="px-4 py-2.5 border-b border-gray-100">
                    <Link href={`/admin/wines/${w.id}`} className="text-xs text-gray-500 hover:text-gray-900 hover:underline">Edit</Link>
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
