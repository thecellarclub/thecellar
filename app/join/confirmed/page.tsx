export default function ConfirmedPage() {
  return (
    <div className="bg-stone-900 rounded-2xl border border-stone-700 p-8 text-center">
      <div className="mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-900/40 border border-emerald-700 mb-4">
          <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <h2 className="text-2xl font-light text-stone-100 tracking-wide">You&apos;re in.</h2>
        <p className="mt-3 text-stone-400 leading-relaxed">
          Look out for your first text soon.
        </p>
        <p className="mt-2 text-sm text-stone-500">
          When a wine lands in your inbox, simply reply with how many bottles you&apos;d like.
          We&apos;ll hold them in your cellar until you hit 12 — then you get free case delivery.
        </p>
      </div>
    </div>
  )
}
