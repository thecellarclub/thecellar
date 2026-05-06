'use client'
import { useEffect } from 'react'

declare global {
  interface Window {
    dataLayer?: IArguments[]
    gtag?: (...args: unknown[]) => void
  }
}

export default function ConversionFire() {
  useEffect(() => {
    // If gtag hasn't initialised yet, create a queue shim so the event is
    // processed once the script loads (gtag itself uses the same push pattern)
    window.dataLayer = window.dataLayer || []
    window.gtag = window.gtag || function gtag() { window.dataLayer!.push(arguments as unknown as IArguments) }
    window.gtag('event', 'conversion', {
      send_to: 'AW-18128381564/zX3cCPfJj6gcEPzMpMRD',
    })
  }, [])
  return null
}
