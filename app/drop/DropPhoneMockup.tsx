// Static (non-animated) phone mockup showing a real drop text — the actual
// SMS body sent to 149 members on 22 Jul 2026 for a wine that sold out
// (verbatim from `texts.body`, tracking link trimmed for display). No
// fabricated "sold out in N minutes" claim — that timing isn't tracked
// anywhere, so the stamp says only what's true: it sold out.

const BORDER = 'rgba(42,24,16,0.18)'
const ACCENT = '#9B1B30'

const DROP_MESSAGE =
  "Orange wine from Alicante. Traditional Brisat method. White made like a red, left in contact with skins, gives freshness and acidity that blends with orange, mandarin and a soft floral aftertaste. Tiny parcel. First good orange wine I've had in a while. £25. Reply how many bottles."

export function DropPhoneMockup() {
  return (
    <div className="relative mx-auto w-full" style={{ maxWidth: 300 }}>
      {/* SOLD OUT stamp */}
      <div
        className="absolute z-10 font-sans font-semibold select-none"
        style={{
          top: -10,
          right: -8,
          background: ACCENT,
          color: '#F5EFE6',
          fontSize: 11,
          letterSpacing: '0.14em',
          padding: '6px 10px',
          transform: 'rotate(6deg)',
          boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
        }}
      >
        SOLD OUT
      </div>

      <div
        style={{
          background: '#F2EAE0',
          border: `1px solid ${BORDER}`,
          borderRadius: 28,
          padding: '18px 14px 22px',
        }}
      >
        {/* Minimal status bar */}
        <div className="flex justify-between items-center mb-3 px-1">
          <span style={{ fontSize: 11, color: 'rgba(42,24,16,0.38)', fontWeight: 600 }}>9:41</span>
          <span style={{ fontSize: 11, color: 'rgba(42,24,16,0.5)', letterSpacing: '0.04em' }}>Daniel</span>
          <span style={{ fontSize: 10, color: 'rgba(42,24,16,0.3)', letterSpacing: '0.06em' }}>● ● ●</span>
        </div>

        <div className="space-y-2">
          {/* Incoming: the real drop text */}
          <div className="flex justify-start">
            <div
              style={{
                background: 'rgba(42,24,16,0.09)',
                borderRadius: '16px 16px 16px 4px',
                padding: '9px 12px',
                maxWidth: '88%',
                fontSize: 13,
                color: '#1C0E09',
                lineHeight: 1.45,
              }}
            >
              {DROP_MESSAGE}
            </div>
          </div>

          {/* Outgoing: illustrative reply (generic — not a real customer's message) */}
          <div className="flex justify-end">
            <div
              style={{
                background: ACCENT,
                color: '#F0E6DC',
                borderRadius: '16px 16px 4px 16px',
                padding: '9px 12px',
                maxWidth: '76%',
                fontSize: 13,
                lineHeight: 1.45,
              }}
            >
              2
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
