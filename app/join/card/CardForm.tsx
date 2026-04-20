'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      color: '#1C0E09',
      fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
      fontSize: '16px',
      '::placeholder': { color: 'rgba(42,24,16,0.35)' },
      iconColor: '#1C0E09',
    },
    invalid: {
      color: '#b91c1c',
      iconColor: '#b91c1c',
    },
  },
}

function CardFormInner() {
  const stripe = useStripe()
  const elements = useElements()
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'form' | 'processing'>('form')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return

    setError('')
    setLoading(true)
    setStep('processing')

    try {
      // 1. Create Stripe customer + SetupIntent on the server
      const intentRes = await fetch('/api/signup/create-setup-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const intentData = await intentRes.json()

      if (!intentRes.ok) {
        setError(intentData.error || 'Something went wrong. Please try again.')
        setStep('form')
        return
      }

      const { clientSecret } = intentData

      // 2. Confirm the SetupIntent with the card element
      const cardElement = elements.getElement(CardElement)
      if (!cardElement) {
        setError('Card field not found. Please refresh and try again.')
        setStep('form')
        return
      }

      const { error: stripeError, setupIntent } = await stripe.confirmCardSetup(
        clientSecret,
        {
          payment_method: {
            card: cardElement,
            billing_details: { email },
          },
        }
      )

      if (stripeError) {
        setError(stripeError.message || 'Card setup failed. Please try again.')
        setStep('form')
        return
      }

      if (!setupIntent || setupIntent.status !== 'succeeded') {
        setError('Card setup was not completed. Please try again.')
        setStep('form')
        return
      }

      // 3. Save the payment method ID to session
      const paymentMethodId =
        typeof setupIntent.payment_method === 'string'
          ? setupIntent.payment_method
          : setupIntent.payment_method?.id

      if (paymentMethodId) {
        await fetch('/api/signup/save-payment-method', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentMethodId }),
        })
      }

      router.push('/join/address')
    } catch {
      setError('Something went wrong. Please try again.')
      setStep('form')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-[#F5EFE6] border p-8" style={{ borderColor: 'rgba(42,24,16,0.12)' }}>
      <div className="mb-6">
        <p className="font-serif text-xs uppercase tracking-[0.3em] mb-1" style={{ color: '#9B1B30' }}>
          Step 3 of 4
        </p>
        <h2 className="font-serif text-2xl" style={{ color: '#1C0E09' }}>Email &amp; card details</h2>
        <p className="font-sans text-sm mt-1" style={{ color: 'rgba(42,24,16,0.55)' }}>
          The Cellar Club is free to join. You&apos;ll only be charged when you order wine.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Email */}
        <div>
          <label htmlFor="email" className="block font-sans text-xs mb-1.5 uppercase tracking-wide" style={{ color: 'rgba(42,24,16,0.55)' }}>
            Email address
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="jane@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            className="w-full bg-[#EDE8DF] border px-4 py-3 focus:outline-none transition-colors font-sans text-base disabled:opacity-60"
            style={{ borderColor: 'rgba(42,24,16,0.18)', color: '#1C0E09' }}
          />
        </div>

        {/* Card element */}
        <div>
          <label className="block font-sans text-xs mb-1.5 uppercase tracking-wide" style={{ color: 'rgba(42,24,16,0.55)' }}>
            Card details
          </label>
          <div className="bg-[#EDE8DF] border px-4 py-3.5 transition-colors" style={{ borderColor: 'rgba(42,24,16,0.18)' }}>
            <CardElement options={CARD_ELEMENT_OPTIONS} />
          </div>
          <p className="mt-1.5 font-sans text-xs" style={{ color: 'rgba(42,24,16,0.40)' }}>
            Secured by Stripe. We never see your full card number.
          </p>
        </div>

        {error && (
          <p className="font-sans text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !stripe || !email.trim()}
          className="w-full bg-rio text-cream font-sans font-medium px-4 py-3 transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {step === 'processing' ? 'Setting up your account…' : 'Save card & continue'}
        </button>
      </form>
    </div>
  )
}

export default function CardForm() {
  return (
    <Elements stripe={stripePromise}>
      <CardFormInner />
    </Elements>
  )
}
