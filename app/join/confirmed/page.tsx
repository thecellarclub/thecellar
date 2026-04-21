import ConversionFire from './ConversionFire'

interface Props {
  searchParams: Promise<{ skipped?: string }>
}

export default async function ConfirmedPage({ searchParams }: Props) {
  const { skipped } = await searchParams
  const didSkip = skipped === '1'

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
        {didSkip ? (
          <p className="font-sans leading-relaxed mt-4" style={{ color: 'rgba(42,24,16,0.55)' }}>
            When your first text lands, reply with how many bottles — we&apos;ll ask for your card and address then if we don&apos;t have them yet.
          </p>
        ) : (
          <>
            <p className="font-sans leading-relaxed mt-4" style={{ color: 'rgba(42,24,16,0.55)' }}>
              Look out for your first text soon.
            </p>
            <p className="font-sans text-sm mt-2" style={{ color: 'rgba(42,24,16,0.35)' }}>
              When a wine lands in your inbox, simply reply with how many bottles you&apos;d like.
              We&apos;ll hold them in your cellar until you hit 12 — then you get free case delivery.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
