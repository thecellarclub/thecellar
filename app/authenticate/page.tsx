import { createServiceClient } from '@/lib/supabase'
import { isAuthTokenExpired } from '@/lib/tokens'
import { stripe } from '@/lib/stripe'
import AuthenticateForm from './AuthenticateForm'

/**
 * /authenticate?token=[token]
 *
 * Server component — validates the auth token, retrieves the PaymentIntent
 * client_secret from Stripe, then hands off to AuthenticateForm (client)
 * which triggers the 3DS challenge immediately on mount.
 */
export default async function AuthenticatePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  if (!token) {
    return <ErrorPage message="Invalid link. Check your text message and try again." />
  }

  const sb = createServiceClient()

  const { data: order } = await sb
    .from('orders')
    .select('id, stripe_payment_intent_id, stripe_charge_status, wine_id, quantity, customer_id, created_at')
    .eq('auth_token', token)
    .maybeSingle()

  if (!order) {
    return <ErrorPage message="Invalid link. Check your text message and try again." />
  }

  if (isAuthTokenExpired(order.created_at)) {
    return (
      <ErrorPage message="This link has expired (15-minute limit). Reply with your quantity again to place a new order." />
    )
  }

  if (order.stripe_charge_status !== 'requires_action') {
    return <ErrorPage message="This payment has already been processed." />
  }

  // Retrieve the PaymentIntent to get the client_secret for Stripe Elements
  const pi = await stripe.paymentIntents.retrieve(order.stripe_payment_intent_id)

  if (pi.status === 'canceled') {
    return <ErrorPage message="This payment link has expired. Reply YES to your last message to get a new one." />
  }
  if (pi.status === 'succeeded') {
    return <ErrorPage message="This order has already been paid — you're all set." />
  }

  // Fetch wine name for confirmation message
  const { data: wine } = await sb
    .from('wines')
    .select('name')
    .eq('id', order.wine_id)
    .maybeSingle()

  return (
    <Shell>
      <AuthenticateForm
        clientSecret={pi.client_secret!}
        orderId={order.id}
        quantity={order.quantity}
        wineName={wine?.name ?? 'your wine'}
        amount={pi.amount}
      />
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-maroon flex flex-col items-center justify-center p-4">
      {/* Brand mark */}
      <div className="text-center mb-8">
        <div className="font-serif text-cream">
          <span className="block text-xs uppercase tracking-[0.3em] text-cream/60">the</span>
          <span className="block text-3xl uppercase tracking-[0.08em] leading-none">CELLAR</span>
          <span className="block text-xs uppercase tracking-[0.3em] text-cream/60">club</span>
        </div>
      </div>
      {/* Content card */}
      <div className="w-full max-w-md bg-maroon-dark border border-cream/12 p-8">
        {children}
      </div>
      {/* Footer */}
      <footer className="mt-8 text-center space-y-1">
        <p className="font-sans text-cream/25 text-xs">CD WINES LTD · Company No. 15796479</p>
        <p className="font-sans text-cream/25 text-xs">Licensed under the Licensing Act 2003 · Licence No. DCCC/PLA0856</p>
        <p className="font-sans text-cream/25 text-xs">We do not sell alcohol to anyone under 18. Please drink responsibly.</p>
        <div className="flex justify-center gap-4 mt-2">
          <a href="/privacy" className="font-sans text-cream/30 hover:text-cream/60 text-xs underline underline-offset-2">Privacy</a>
          <a href="/terms" className="font-sans text-cream/30 hover:text-cream/60 text-xs underline underline-offset-2">Terms</a>
        </div>
      </footer>
    </main>
  )
}

function ErrorPage({ message }: { message: string }) {
  return (
    <Shell>
      <p className="font-sans text-cream/60 text-sm text-center">{message}</p>
    </Shell>
  )
}
