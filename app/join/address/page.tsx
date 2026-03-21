import { redirect } from 'next/navigation'
import { getSignupSession } from '@/lib/session'
import AddressForm from './AddressForm'

export default async function AddressPage() {
  const session = await getSignupSession()

  if (!session.phone || !session.phoneVerified || !session.paymentMethodId || !session.firstName) {
    redirect('/join')
  }

  return <AddressForm />
}
