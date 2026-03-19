import type { Metadata } from 'next'
import { Cormorant_Garamond, Spectral } from 'next/font/google'
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

export const metadata: Metadata = {
  title: 'The Cellar Club',
  description:
    'Hand-picked wines by text message. Reply to order. Free case delivery at 12 bottles.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${cormorant.variable} ${spectral.variable} font-sans antialiased bg-maroon text-cream`}>
        {children}
      </body>
    </html>
  )
}
