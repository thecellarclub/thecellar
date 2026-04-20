import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Join The Cellar Club',
  description: 'Sign up to receive hand-picked wines by text.',
}

export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#EDE8DF' }}>
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
          {/* Brand mark */}
          <div className="text-center mb-10">
            <div className="font-serif" style={{ color: '#1C0E09' }}>
              <span className="block text-xs uppercase tracking-[0.3em]" style={{ color: 'rgba(42,24,16,0.50)' }}>the</span>
              <span className="block text-4xl uppercase tracking-[0.08em] leading-none">CELLAR</span>
              <span className="block text-xs uppercase tracking-[0.3em]" style={{ color: 'rgba(42,24,16,0.50)' }}>club</span>
            </div>
            <div className="w-8 h-px mx-auto mt-3" style={{ backgroundColor: 'rgba(42,24,16,0.20)' }} />
          </div>
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 px-4" style={{ borderTop: '1px solid rgba(42,24,16,0.12)' }}>
        <div className="max-w-md mx-auto space-y-1 text-center">
          <p className="font-sans text-xs" style={{ color: 'rgba(42,24,16,0.35)' }}>We do not sell alcohol to anyone under 18. Please drink responsibly.</p>
          <p className="font-sans text-xs" style={{ color: 'rgba(42,24,16,0.35)' }}>Premises Licence No: DCCC/PLA0856</p>
          <div className="flex justify-center gap-4 mt-2">
            <Link href="/privacy" className="font-sans text-xs underline underline-offset-2" style={{ color: 'rgba(42,24,16,0.45)' }}>Privacy Policy</Link>
            <Link href="/terms" className="font-sans text-xs underline underline-offset-2" style={{ color: 'rgba(42,24,16,0.45)' }}>Terms &amp; Conditions</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
