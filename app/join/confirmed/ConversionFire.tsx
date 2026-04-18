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
      send_to: 'AW-17764225252/SoKhCIivrZ4cEOSh0pZC',
    })
  }, [])
  return null
}
