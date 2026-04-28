import { Metadata } from 'next'
import PortalVerifyForm from './PortalVerifyForm'

export const metadata: Metadata = {
  title: 'Verify — The Cellar Club',
}

export default function PortalVerifyPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4" style={{ background: '#F5EFE6' }}>
      {/* Brand mark */}
      <div className="text-center mb-8">
        <div className="font-serif" style={{ color: '#1C0E09' }}>
          <span className="block text-xs uppercase tracking-[0.3em]" style={{ color: 'rgba(42,24,16,0.45)' }}>the</span>
          <span className="block text-3xl uppercase tracking-[0.08em] leading-none">CELLAR</span>
          <span className="block text-xs uppercase tracking-[0.3em]" style={{ color: 'rgba(42,24,16,0.45)' }}>club</span>
        </div>
      </div>

      <div className="w-full max-w-md border p-8" style={{ background: '#EDE8DF', borderColor: 'rgba(42,24,16,0.12)' }}>
        <div className="mb-6">
          <h2 className="font-serif text-2xl mb-1" style={{ color: '#1C0E09' }}>Enter your code</h2>
          <p className="font-sans text-sm" style={{ color: 'rgba(42,24,16,0.55)' }}>
            We&apos;ve sent a 6-digit code to your phone. It expires in 10 minutes.
          </p>
        </div>
        <PortalVerifyForm />
      </div>

      <footer className="mt-8 text-center">
        <p className="font-sans text-xs" style={{ color: 'rgba(42,24,16,0.30)' }}>CD WINES LTD · Company No. 15796479</p>
      </footer>
    </main>
  )
}
