import ConversionFire from './ConversionFire'

export default function ConfirmedPage() {
  return (
    <div className="bg-maroon-dark border border-cream/12 p-10 text-center">
      <ConversionFire />
      <div className="mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 border border-cream/20 mb-6">
          <svg className="w-8 h-8 text-cream/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <h2 className="font-serif text-3xl text-cream tracking-wide">You&apos;re in.</h2>
        <p className="font-sans text-cream/55 leading-relaxed mt-4">
          Look out for your first text soon.
        </p>
        <p className="font-sans text-cream/35 text-sm mt-2">
          When a wine lands in your inbox, simply reply with how many bottles you&apos;d like.
          We&apos;ll hold them in your cellar until you hit 12 — then you get free case delivery.
        </p>
      </div>
    </div>
  )
}
