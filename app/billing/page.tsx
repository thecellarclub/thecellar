import Image from 'next/image'
import { createServiceClient } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'
import BillingForm from './BillingForm'

/**
 * /billing?token=[token]
 *
 * Customer card-add page, reached via the /b/[token] short URL in SMS.
 * Validates the billing token, creates a fresh SetupIntent, renders the form.
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
      <div className="mb-6">
        <h1 className="font-serif text-2xl" style={{ color: '#1C0E09' }}>Add your card</h1>
        <p className="font-sans text-sm mt-1" style={{ color: 'rgba(42,24,16,0.55)' }}>
          Saved securely via Stripe. You&apos;ll only ever be charged when you reply to one of Daniel&apos;s texts.
        </p>
      </div>
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
    <main className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: '#EDE8DF' }}>
      {/* Logo */}
      <div className="mb-8">
        <Image
          src="/logo.png"
          alt="The Cellar Club"
          width={880}
          height={720}
          priority
          className="h-auto w-[140px]"
          style={{ mixBlendMode: 'multiply' }}
        />
      </div>

      {/* Card */}
      <div
        className="w-full max-w-md p-8"
        style={{ background: '#F5EFE6', border: '1px solid rgba(42,24,16,0.12)' }}
      >
        {children}
      </div>

      {/* Footer */}
      <footer className="mt-8 text-center space-y-1">
        <p className="font-sans text-xs" style={{ color: 'rgba(42,24,16,0.32)' }}>CD WINES LTD · Company No. 15796479</p>
        <p className="font-sans text-xs" style={{ color: 'rgba(42,24,16,0.32)' }}>Licensed under the Licensing Act 2003 · Licence No. DCCC/PLA0856</p>
        <p className="font-sans text-xs" style={{ color: 'rgba(42,24,16,0.32)' }}>We do not sell alcohol to anyone under 18. Please drink responsibly.</p>
        <div className="flex justify-center gap-4 mt-2">
          <a href="/privacy" className="font-sans text-xs underline underline-offset-2 transition-opacity hover:opacity-70" style={{ color: 'rgba(42,24,16,0.38)' }}>Privacy</a>
          <a href="/terms" className="font-sans text-xs underline underline-offset-2 transition-opacity hover:opacity-70" style={{ color: 'rgba(42,24,16,0.38)' }}>Terms</a>
        </div>
      </footer>
    </main>
  )
}

function ErrorPage({ message }: { message: string }) {
  return (
    <Shell>
      <p className="font-sans text-sm text-center" style={{ color: 'rgba(42,24,16,0.55)' }}>{message}</p>
    </Shell>
  )
}
