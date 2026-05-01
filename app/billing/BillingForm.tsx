'use client'

import { useState, FormEvent } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      color: '#F0E6DC',
      fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
      fontSize: '16px',
      '::placeholder': { color: 'rgba(240,230,220,0.3)' },
      iconColor: '#F0E6DC',
    },
    invalid: { color: '#f87171', iconColor: '#f87171' },
  },
}

interface BillingFormProps {
  clientSecret: string
  customerId: string
  billingToken: string
}

function BillingFormInner({ clientSecret, customerId, billingToken }: BillingFormProps) {
  const stripe = useStripe()
  const elements = useElements()

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return

    setError('')
    setLoading(true)

    try {
      const cardElement = elements.getElement(CardElement)
      if (!cardElement) {
        setError('Card field not found. Please refresh and try again.')
        return
      }

      const { error: stripeError, setupIntent } = await stripe.confirmCardSetup(clientSecret, {
        payment_method: { card: cardElement },
      })

      if (stripeError) {
        setError(stripeError.message || 'Card setup failed. Please try again.')
        return
      }

      if (!setupIntent || setupIntent.status !== 'succeeded') {
        setError('Card setup was not completed. Please try again.')
        return
      }

      const paymentMethodId =
        typeof setupIntent.payment_method === 'string'
          ? setupIntent.payment_method
          : setupIntent.payment_method?.id

      if (!paymentMethodId) {
        setError('Something went wrong. Please try again.')
        return
      }

      const res = await fetch('/api/billing/update-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billingToken, paymentMethodId }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Something went wrong. Please try again.')
        return
      }

      setDone(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <p className="font-sans text-cream/70 text-sm text-center">
        All done — your card&apos;s saved. You&apos;re all set for when Daniel texts you next.
      </p>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block font-sans text-xs text-cream/55 mb-1 uppercase tracking-wide">Card details</label>
        <div className="bg-maroon border border-cream/20 px-4 py-3.5 focus-within:border-cream/50 transition-colors">
          <CardElement options={CARD_ELEMENT_OPTIONS} />
        </div>
        <p className="mt-1.5 font-sans text-xs text-cream/30">
          Secured by Stripe. We never see your full card number.
        </p>
      </div>

      {error && (
        <p className="font-sans text-sm text-red-400">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || !stripe}
        className="w-full bg-rio text-cream font-sans font-medium py-2.5 text-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
      >
        {loading ? 'Updating your card…' : 'Update card'}
      </button>
    </form>
  )
}

export default function BillingForm(props: BillingFormProps) {
  return (
    <Elements stripe={stripePromise}>
      <BillingFormInner {...props} />
    </Elements>
  )
}
