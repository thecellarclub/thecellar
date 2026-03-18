import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Join Cellar Text',
  description: 'Sign up to receive hand-picked wines by text.',
}

export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-stone-950 flex flex-col">
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
          {/* Logo / Brand */}
          <div className="text-center mb-10">
            <h1 className="text-3xl font-light tracking-widest text-stone-100 uppercase">
              Cellar Text
            </h1>
            <p className="mt-2 text-sm text-stone-400 tracking-wide">
              Fine wine by text message
            </p>
          </div>
          {children}
        </div>
      </main>

      {/* Compliance footer */}
      <footer className="border-t border-stone-800 py-6 px-4">
        <div className="max-w-md mx-auto space-y-1 text-center text-xs text-stone-500">
          <p>We do not sell alcohol to anyone under 18.</p>
          <p>Please drink responsibly. Alcohol should not be consumed by anyone under 18.</p>
          <p>Premises Licence No: [LICENCE NUMBER]</p>
        </div>
      </footer>
    </div>
  )
}
