import { createServiceClient } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'
import BillingForm from './BillingForm'

/**
 * /billing?token=[token]
 *
 * Customer card update page. Sent via SMS when a payment fails.
 * Validates the billing token (1-hour TTL), creates a fresh SetupIntent,
 * and renders the card update form.
 */
export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  if (!token) {
    return <ErrorPage message="Invalid link. Please check your text message." />
  }

  const sb = createServiceClient()

  const { data: customer } = await sb
    .from('customers')
    .select('id, stripe_customer_id, billing_token_expires_at')
    .eq('billing_token', token)
    .not('billing_token', 'is', null)
    .maybeSingle()

  if (!customer) {
    return <ErrorPage message="Invalid or expired link." />
  }

  if (new Date(customer.billing_token_expires_at) < new Date()) {
    return (
      <ErrorPage message="This link has expired. Reply to your last text and we'll send a fresh one." />
    )
  }

  const setupIntent = await stripe.setupIntents.create({
    customer: customer.stripe_customer_id,
    usage: 'off_session',
  })

  return (
    <Shell>
      <h1 className="font-serif text-xl text-cream mb-1">Add your card</h1>
      <p className="font-sans text-sm text-cream/50 mb-6">
        Saved securely via Stripe. You&apos;ll only ever be charged when you reply to one of Daniel&apos;s texts.
      </p>
      <BillingForm
        clientSecret={setupIntent.client_secret!}
        customerId={customer.id}
        billingToken={token}
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
