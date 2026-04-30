import ConversionFire from './ConversionFire'

export default async function ConfirmedPage() {
  return (
    <div className="bg-[#F5EFE6] border p-10 text-center" style={{ borderColor: 'rgba(42,24,16,0.12)' }}>
      <ConversionFire />
      <div className="mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 mb-6" style={{ border: '1px solid rgba(42,24,16,0.20)' }}>
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: 'rgba(42,24,16,0.50)' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <h2 className="font-serif text-3xl tracking-wide" style={{ color: '#1C0E09' }}>You&apos;re in.</h2>
        <p className="font-sans leading-relaxed mt-4" style={{ color: 'rgba(42,24,16,0.55)' }}>
          When your first case is ready to ship, we&apos;ll ask for your delivery address. Until then, just reply with a number when Daniel texts to grab a wine.
        </p>
      </div>
    </div>
  )
}
