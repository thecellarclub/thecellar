import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase'
import { formatDateTime } from '@/lib/format'
import Link from 'next/link'
import MilestoneRowActions from '@/app/admin/_components/MilestoneRowActions'

type MilestoneRow = {
  id: string
  customer_id: string
  milestone: number
  reward_choice: string | null
  chosen_at: string | null
  fulfilled_at: string | null
  fulfilled_by: string | null
  created_at: string
  customers: { first_name: string | null; last_name: string | null; phone: string } | null
}

const REWARD_LABELS: Record<string, string> = {
  free_ship_at_6: 'Free shipping at 6 (auto)',
  riedel_glasses: '6 Riedel glasses',
  tasting_tickets: '2 tasting tickets',
  free_bottle: "Free bottle (Daniel's pick)",
  coravin: 'Coravin (auto)',
}

const MILESTONE_OPTIONS: Record<number, string[]> = {
  3: ['free_bottle', 'tasting_tickets'],
  5: ['riedel_glasses', 'tasting_tickets'],
}

export default async function MilestonesPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/admin/login')

  const sb = createServiceClient()

  const [{ data: unfulfilledRaw }, { data: fulfilledRaw }] = await Promise.all([
    sb
      .from('milestone_awards')
      .select('id, customer_id, milestone, reward_choice, chosen_at, fulfilled_at, fulfilled_by, created_at, customers(first_name, last_name, phone)')
      .is('fulfilled_at', null)
      .order('created_at', { ascending: true }),
    sb
      .from('milestone_awards')
      .select('id, customer_id, milestone, reward_choice, chosen_at, fulfilled_at, fulfilled_by, created_at, customers(first_name, last_name, phone)')
      .not('fulfilled_at', 'is', null)
      .order('fulfilled_at', { ascending: false })
      .limit(20),
  ])

  const unfulfilled = (unfulfilledRaw ?? []) as unknown as MilestoneRow[]
  const fulfilled = (fulfilledRaw ?? []) as unknown as MilestoneRow[]

  function customerName(row: MilestoneRow): string {
    const c = row.customers
    return [c?.first_name, c?.last_name].filter(Boolean).join(' ') || c?.phone || 'Unknown'
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Milestone fulfilment</h1>
        <p className="text-sm text-gray-500 mt-0.5">Lifetime rewards earned at cases 1, 3, 5 and 6. Milestone 1 and 6 are self-fulfilling — 3 and 5 need a reward choice recorded and a fulfilment date.</p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">Needs fulfilment ({unfulfilled.length})</h2>
        </div>
        {unfulfilled.length === 0 ? (
          <p className="px-4 py-6 text-center text-gray-500 text-sm">Nothing outstanding</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {unfulfilled.map((row) => (
              <div key={row.id} className="px-4 py-4 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    <Link href={`/admin/customers/${row.customer_id}`} className="hover:underline">{customerName(row)}</Link>
                    {' '}— case {row.milestone}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {row.reward_choice
                      ? REWARD_LABELS[row.reward_choice] ?? row.reward_choice
                      : `Not yet chosen — options: ${(MILESTONE_OPTIONS[row.milestone] ?? []).map((o) => REWARD_LABELS[o] ?? o).join(' or ')}`}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">Earned {formatDateTime(row.created_at)}</p>
                </div>
                <MilestoneRowActions
                  id={row.id}
                  currentChoice={row.reward_choice}
                  options={MILESTONE_OPTIONS[row.milestone] ?? []}
                  rewardLabels={REWARD_LABELS}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">Recently fulfilled</h2>
        </div>
        {fulfilled.length === 0 ? (
          <p className="px-4 py-6 text-center text-gray-500 text-sm">None yet</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {fulfilled.map((row) => (
              <div key={row.id} className="px-4 py-3 flex items-center justify-between gap-4 flex-wrap text-sm">
                <div>
                  <Link href={`/admin/customers/${row.customer_id}`} className="font-medium text-gray-900 hover:underline">{customerName(row)}</Link>
                  <span className="text-gray-500"> — case {row.milestone} — {row.reward_choice ? (REWARD_LABELS[row.reward_choice] ?? row.reward_choice) : '—'}</span>
                </div>
                <span className="text-xs text-gray-400">{row.fulfilled_at ? formatDateTime(row.fulfilled_at) : ''}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
