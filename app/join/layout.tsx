import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Join The Cellar Club',
  description: 'Sign up to receive hand-picked wines by text.',
}

export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-maroon flex flex-col">
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
          {/* Brand mark */}
          <div className="text-center mb-10">
            <div className="font-serif text-cream">
              <span className="block text-xs uppercase tracking-[0.3em] text-cream/70">the</span>
              <span className="block text-4xl uppercase tracking-[0.08em] leading-none">CELLAR</span>
              <span className="block text-xs uppercase tracking-[0.3em] text-cream/70">club</span>
            </div>
            <div className="w-8 h-px bg-gold/50 mx-auto mt-3" />
          </div>
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-cream/10 py-6 px-4">
        <div className="max-w-md mx-auto space-y-1 text-center">
          <p className="font-sans text-cream/30 text-xs">We do not sell alcohol to anyone under 18. Please drink responsibly.</p>
          <p className="font-sans text-cream/30 text-xs">Premises Licence No: DCCC/PLA0856</p>
          <div className="flex justify-center gap-4 mt-2">
            <Link href="/privacy" className="font-sans text-cream/35 hover:text-cream/60 text-xs underline underline-offset-2">Privacy Policy</Link>
            <Link href="/terms" className="font-sans text-cream/35 hover:text-cream/60 text-xs underline underline-offset-2">Terms &amp; Conditions</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
