import { Metadata } from 'next'
import PortalLoginForm from './PortalLoginForm'

export const metadata: Metadata = {
  title: 'My Account — The Cellar Club',
}

export default function PortalPage() {
  return (
    <main className="min-h-screen bg-maroon flex flex-col items-center justify-center p-4">
      {/* Brand mark */}
      <div className="text-center mb-8">
        <div className="font-serif text-cream">
          <span className="block text-xs uppercase tracking-[0.3em] text-cream/60">the</span>
          <span className="block text-3xl uppercase tracking-[0.08em] leading-none">CELLAR</span>
          <span className="block text-xs uppercase tracking-[0.3em] text-cream/60">club</span>
        </div>
      </div>

      <div className="w-full max-w-md bg-maroon-dark border border-cream/12 p-8">
        <div className="mb-6">
          <h2 className="font-serif text-2xl text-cream mb-1">My account</h2>
          <p className="font-sans text-sm text-cream/55">
            Enter your phone number and we&apos;ll send you a login code.
          </p>
        </div>
        <PortalLoginForm />
      </div>

      <footer className="mt-8 text-center">
        <p className="font-sans text-cream/25 text-xs">CD WINES LTD · Company No. 15796479</p>
      </footer>
    </main>
  )
}
