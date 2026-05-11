'use client'
import { useEffect } from 'react'

declare global {
  interface Window {
    dataLayer?: IArguments[]
    gtag?: (...args: unknown[]) => void
    rdt?: (...args: unknown[]) => void
    twq?: (...args: unknown[]) => void
  }
}

export default function ConversionFire() {
  useEffect(() => {
    window.dataLayer = window.dataLayer || []
    window.gtag = window.gtag || function gtag() { window.dataLayer!.push(arguments as unknown as IArguments) }
    window.gtag('event', 'conversion', {
      send_to: 'AW-18128381564/zX3cCPfJj6gcEPzMpMRD',
    })
    window.rdt?.('track', 'SignUp')
    window.twq?.('event', 'tw-qrnta-rcd33', {})
  }, [])
  return null
}
