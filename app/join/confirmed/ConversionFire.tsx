'use client'
import { useEffect } from 'react'

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
  }
}

export default function ConversionFire() {
  useEffect(() => {
    window.gtag?.('event', 'conversion', {
      send_to: 'AW-18128381564/zX3cCPfJj6gcEPzMpMRD',
    })
  }, [])
  return null
}
