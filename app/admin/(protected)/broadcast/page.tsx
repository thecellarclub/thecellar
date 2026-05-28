import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase'
import BroadcastForm from '@/app/admin/_components/BroadcastForm'

const DEFAULT_MESSAGE =
  "It's Daniel. First wines are landing next week - exciting times. " +
  "When I text you, just reply with how many bottles you'd like. " +
  "Reply STOP to unsubscribe."

export default async function BroadcastPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/admin/login')

  const sb = createServiceClient()

  const { data: customers } = await sb
    .from('customers')
    .select('status, stripe_payment_method_id')
    .in('status', ['active', 'dormant'])

  const all = customers ?? []
  const activeWithCard = all.filter((c) => c.status === 'active' && c.stripe_payment_method_id).length
  const activeWithoutCard = all.filter((c) => c.status === 'active' && !c.stripe_payment_method_id).length
  const dormantWithCard = all.filter((c) => c.status === 'dormant' && c.stripe_payment_method_id).length
  const dormantWithoutCard = all.filter((c) => c.status === 'dormant' && !c.stripe_payment_method_id).length

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold text-gray-900 mb-1">Broadcast message</h1>
      <p className="text-sm text-gray-500 mb-6">
        Send a one-off message to active or dormant members. Members without a card get a personalised link to add one.
      </p>
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <BroadcastForm
          activeWithCard={activeWithCard}
          activeWithoutCard={activeWithoutCard}
          dormantWithCard={dormantWithCard}
          dormantWithoutCard={dormantWithoutCard}
          defaultMessage={DEFAULT_MESSAGE}
        />
      </div>
    </div>
  )
}
