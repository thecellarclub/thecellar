import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase'
import WineForm from '../../_components/WineForm'
import Link from 'next/link'

export default async function WineEditPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/admin/login')

  const { id } = await params
  const sb = createServiceClient()

  const { data: wine } = await sb
    .from('wines')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!wine) notFound()

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Link href="/admin/wines" className="text-xs text-gray-400 hover:text-gray-600 mb-4 block">← Wine library</Link>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Edit: {wine.name}</h1>
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <WineForm
          mode="edit"
          wineId={wine.id}
          initial={{
            name: wine.name,
            producer: wine.producer ?? '',
            region: wine.region ?? '',
            country: wine.country ?? '',
            vintage: wine.vintage?.toString() ?? '',
            description: wine.description ?? '',
            price_pounds: (wine.price_pence / 100).toFixed(2),
            stock_bottles: wine.stock_bottles.toString(),
          }}
        />
      </div>
    </div>
  )
}
