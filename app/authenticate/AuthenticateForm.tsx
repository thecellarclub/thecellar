'use client'

import { useEffect, useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, useStripe } from '@stripe/react-stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface Props {
  clientSecret: string
  orderId: string
  quantity: number
  wineName: string
  amount: number
}

function Inner({ clientSecret, orderId, quantity, wineName }: Props) {
  const stripe = useStripe()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!stripe) return

    stripe.confirmCardPayment(clientSecret).then(async (result) => {
      if (result.error) {
        setErrorMsg(result.error.message ?? 'Payment failed.')
        setStatus('error')
      } else if (result.paymentIntent?.status === 'succeeded') {
        await fetch('/api/authenticate/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId }),
        })
        setStatus('success')
      }
    })
  }, [stripe, clientSecret, orderId])

  if (status === 'loading') {
    return (
      <div className="flex flex-col items-center gap-3 py-4">
        <svg
          className="animate-spin h-5 w-5 text-cream/40"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        <p className="font-sans text-sm text-cream/50 text-center">Verifying your payment…</p>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div>
        <h1 className="font-serif text-xl text-cream mb-2">Payment verified.</h1>
        <p className="font-sans text-sm text-cream/55">
          Your {quantity} bottle{quantity !== 1 ? 's' : ''} of {wineName} are in your cellar.
          We&apos;ll text you shortly with your cellar total.
        </p>
      </div>
    )
  }

  // error
  return (
    <div>
      <h1 className="font-serif text-xl text-cream mb-2">Payment failed</h1>
      <p className="font-sans text-sm text-cream/55 mb-4">{errorMsg}</p>
      <a href="/billing" className="font-sans text-sm text-rio underline underline-offset-2">
        Update your card
      </a>
      {' '}
      <span className="font-sans text-sm text-cream/40">and try again.</span>
    </div>
  )
}

export default function AuthenticateForm(props: Props) {
  return (
    <Elements stripe={stripePromise} options={{ clientSecret: props.clientSecret }}>
      <Inner {...props} />
    </Elements>
  )
}
