import type { Metadata } from 'next'
import { Cormorant_Garamond, Spectral } from 'next/font/google'
import Script from 'next/script'
import './globals.css'

const cormorant = Cormorant_Garamond({
  variable: '--font-cormorant',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  style: ['normal', 'italic'],
  display: 'swap',
})

const spectral = Spectral({
  variable: '--font-spectral',
  subsets: ['latin'],
  weight: ['400', '600'],
  style: ['normal', 'italic'],
  display: 'swap',
})

const DESCRIPTION =
  'Sommelier selected wines by text, at direct import prices. Free cellar storage. Free delivery. A direct line to the former sommelier at the 2 Michelin Star Raby Hunt.'

export const metadata: Metadata = {
  title: 'The Cellar Club - Text Your Personal Sommelier',
  description: DESCRIPTION,
  icons: {
    icon: [
      { url: '/favicon.png', sizes: '192x192', type: 'image/png' },
      { url: '/favicon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'The Cellar Club - Text Your Personal Sommelier',
    description: DESCRIPTION,
    url: 'https://thecellar.club',
    siteName: 'The Cellar Club',
    locale: 'en_GB',
    type: 'website',
    images: [
      {
        url: 'https://thecellar.club/og-image.png',
        width: 1200,
        height: 630,
        alt: 'The Cellar Club',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Cellar Club - Text Your Personal Sommelier',
    description: DESCRIPTION,
    images: ['https://thecellar.club/og-image.png'],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=AW-17764225252"
        strategy="afterInteractive"
      />
      <Script id="google-ads-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'AW-17764225252');
        `}
      </Script>
      <body className={`${cormorant.variable} ${spectral.variable} font-sans antialiased bg-maroon text-cream`}>
        {children}
      </body>
    </html>
  )
}
