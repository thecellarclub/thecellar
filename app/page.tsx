import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-stone-950 flex flex-col">
      <main className="flex-1 flex items-center justify-center px-4 py-24">
        <div className="max-w-lg text-center">
          <h1 className="text-4xl font-light tracking-widest text-stone-100 uppercase mb-4">
            Cellar Text
          </h1>
          <p className="text-stone-400 text-lg leading-relaxed mb-3">
            Hand-picked wines, delivered to your phone.
          </p>
          <p className="text-stone-500 text-sm leading-relaxed mb-10">
            Reply with a number to order. We hold your bottles in your cellar.
            Hit 12 and we ship your case for free.
          </p>
          <Link
            href="/join"
            className="inline-block bg-stone-100 hover:bg-white text-stone-900 font-medium rounded-lg px-8 py-3.5 transition-colors"
          >
            Sign up
          </Link>
        </div>
      </main>

      <footer className="border-t border-stone-800 py-6 px-4">
        <div className="max-w-lg mx-auto space-y-1 text-center text-xs text-stone-500">
          <p>We do not sell alcohol to anyone under 18.</p>
          <p>Please drink responsibly. Alcohol should not be consumed by anyone under 18.</p>
          <p>Premises Licence No: [LICENCE NUMBER]</p>
        </div>
      </footer>
    </div>
  )
}
