import { redirect } from 'next/navigation'
import { getSignupSession } from '@/lib/session'
import CardForm from './CardForm'

export default async function CardPage() {
  const session = await getSignupSession()

  // Guard: must have verified phone to reach this step
  if (!session.phone || !session.phoneVerified) {
    redirect('/join')
  }

  return <CardForm />
}
