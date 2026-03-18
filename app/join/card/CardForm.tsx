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
      color: '#e7e5e4', // stone-200
      fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      fontSize: '16px',
      '::placeholder': {
        color: '#57534e', // stone-600
      },
      iconColor: '#a8a29e', // stone-400
    },
    invalid: {
      color: '#f87171', // red-400
      iconColor: '#f87171',
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

      router.push('/join/details')
    } catch {
      setError('Something went wrong. Please try again.')
      setStep('form')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-stone-900 rounded-2xl border border-stone-700 p-8">
      <div className="mb-6">
        <p className="text-xs font-medium tracking-widest text-stone-500 uppercase mb-1">
          Step 2 of 4
        </p>
        <h2 className="text-xl font-light text-stone-100">Email &amp; card details</h2>
        <p className="mt-1 text-sm text-stone-400">
          Your card is saved securely. You&apos;ll only be charged when you order a wine.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-sm text-stone-400 mb-1.5">
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
            className="w-full bg-stone-800 border border-stone-600 rounded-lg px-4 py-3 text-stone-100 placeholder-stone-600 focus:outline-none focus:border-stone-400 transition-colors disabled:opacity-60"
          />
        </div>

        {/* Card element */}
        <div>
          <label className="block text-sm text-stone-400 mb-1.5">
            Card details
          </label>
          <div className="bg-stone-800 border border-stone-600 rounded-lg px-4 py-3.5 focus-within:border-stone-400 transition-colors">
            <CardElement options={CARD_ELEMENT_OPTIONS} />
          </div>
          <p className="mt-1.5 text-xs text-stone-600">
            Secured by Stripe. We never see your full card number.
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-4 py-3">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !stripe || !email.trim()}
          className="w-full bg-stone-100 hover:bg-white text-stone-900 font-medium rounded-lg px-4 py-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
