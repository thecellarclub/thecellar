'use client'

import { useState } from 'react'
import type { LadderNode } from './ladder'

const ACCENT = '#9B1B30'
const ACCENT_FADE = 'rgba(155,27,48,0.45)'
const INK = '#1C0E09'
const FADE = 'rgba(42,24,16,0.35)'

interface Props {
  casesThisCycle: number
  bottlesThisCycle: number
  creditBalancePence: number
  ladderNodes: LadderNode[]
  topOfLadder: boolean
  renewalDate: string | null
  twilioPhoneNumber: string
}

function BottleGlyph({ filled, delayMs }: { filled: boolean; delayMs: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      className={filled ? 'club-bottle club-bottle-filled' : 'club-bottle'}
      style={{ animationDelay: `${delayMs}ms` }}
      aria-hidden="true"
    >
      <path
        d="M9.5 1.5h5v3.2l1.8 2.6c.4.6.7 1.3.7 2v11.2c0 1.1-.9 2-2 2H9c-1.1 0-2-.9-2-2V9.3c0-.7.2-1.4.7-2l1.8-2.6V1.5z"
        fill={filled ? ACCENT : 'none'}
        stroke={filled ? ACCENT : FADE}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="10"
      height="10"
      className="shrink-0 transition-transform duration-200"
      style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
      aria-hidden="true"
    >
      <path d="M5 2.5l6 5.5-6 5.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function LadderNodeRow({ node, twilioPhoneNumber }: { node: LadderNode; twilioPhoneNumber: string }) {
  // The tier rung a member is climbing toward starts open — no click needed
  // to see what it's worth. Every other tier row starts collapsed.
  const [expanded, setExpanded] = useState(node.isTier && node.status === 'here')
  const smsHref = twilioPhoneNumber ? `sms:${twilioPhoneNumber}` : null

  const dot = (() => {
    switch (node.status) {
      case 'held':
      case 'done':
      case 'toBeRevealed':
        return (
          <span
            className="flex items-center justify-center rounded-full shrink-0"
            style={{ width: '1.5rem', height: '1.5rem', background: ACCENT }}
          >
            {node.status !== 'toBeRevealed' && (
              <span className="font-sans text-xs" style={{ color: '#F5EFE6' }}>✓</span>
            )}
          </span>
        )
      case 'choose':
        return (
          <span
            className="club-pulse flex items-center justify-center rounded-full shrink-0"
            style={{ width: '1.5rem', height: '1.5rem', background: ACCENT, boxShadow: `0 0 0 3px rgba(155,27,48,0.25)` }}
          >
            <span className="font-sans text-xs" style={{ color: '#F5EFE6' }}>?</span>
          </span>
        )
      case 'onItsWay':
        return (
          <span
            className="flex items-center justify-center rounded-full shrink-0 border-2"
            style={{ width: '1.5rem', height: '1.5rem', borderColor: ACCENT, background: 'transparent' }}
          >
            <span className="font-sans text-xs" style={{ color: ACCENT }}>✓</span>
          </span>
        )
      case 'here':
        return (
          <span
            className="flex items-center justify-center rounded-full shrink-0 border-2"
            style={{ width: '1.5rem', height: '1.5rem', borderColor: ACCENT, background: '#F5EFE6' }}
          >
            <span style={{ color: ACCENT, fontSize: '0.7rem' }}>●</span>
          </span>
        )
      default:
        return (
          <span
            className="rounded-full shrink-0 border"
            style={{ width: '1.5rem', height: '1.5rem', borderColor: 'rgba(42,24,16,0.20)' }}
          />
        )
    }
  })()

  const faded = node.status === 'ahead'

  return (
    <div className="flex gap-3 pb-5 last:pb-0">
      <div className="flex flex-col items-center">
        {dot}
        {node.rung < 7 && <div className="w-px flex-1 mt-1" style={{ background: 'rgba(42,24,16,0.14)' }} />}
      </div>
      <div className="min-w-0 pt-0.5 w-full">
        <p className="font-sans text-xs uppercase tracking-wide" style={{ color: faded ? FADE : 'rgba(42,24,16,0.45)' }}>
          Case {node.rung}
        </p>

        {node.isTier ? (
          <div>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1.5 -ml-0.5 py-0.5 px-0.5 rounded transition-colors hover:bg-black/[0.03]"
              aria-expanded={expanded}
            >
              <span
                className="font-sans font-semibold tracking-[0.16em] uppercase"
                style={{ fontSize: '0.85rem', color: faded ? ACCENT_FADE : ACCENT }}
              >
                {node.label}
              </span>
              <span style={{ color: faded ? ACCENT_FADE : ACCENT }}>
                <Chevron open={expanded} />
              </span>
            </button>
            {expanded && node.perks && (
              <div className="club-expand mt-2 mb-1 pl-0.5 space-y-1.5">
                {node.perks.map((p) => (
                  <div key={p.label} className="flex items-baseline justify-between gap-3">
                    <span className="font-sans text-xs" style={{ color: 'rgba(42,24,16,0.55)' }}>{p.label}</span>
                    <span className="font-serif text-right" style={{ fontSize: '0.85rem', color: INK }}>{p.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="font-serif" style={{ fontSize: '0.95rem', color: faded ? FADE : INK }}>
            {node.label}
          </p>
        )}

        {node.copy && (
          smsHref && node.smsLink ? (
            <a href={smsHref} className="font-sans text-xs underline underline-offset-2" style={{ color: ACCENT }}>
              {node.copy}
            </a>
          ) : (
            <p className="font-sans text-xs mt-0.5" style={{ color: ACCENT }}>{node.copy}</p>
          )
        )}
      </div>
    </div>
  )
}

export default function ClubProgress({
  casesThisCycle,
  bottlesThisCycle,
  creditBalancePence,
  ladderNodes,
  topOfLadder,
  renewalDate,
  twilioPhoneNumber,
}: Props) {
  const bottlesIntoCurrentCase = bottlesThisCycle % 12
  const nextCaseNumber = casesThisCycle + 1

  return (
    <div>
      <style>{`
        @keyframes club-bottle-fill { from { opacity: 0; transform: scale(0.6); } to { opacity: 1; transform: scale(1); } }
        @keyframes club-pulse-ring { 0%, 100% { box-shadow: 0 0 0 3px rgba(155,27,48,0.25); } 50% { box-shadow: 0 0 0 6px rgba(155,27,48,0.12); } }
        @keyframes club-expand-in { from { opacity: 0; transform: translateY(-3px); } to { opacity: 1; transform: translateY(0); } }
        @media (prefers-reduced-motion: no-preference) {
          .club-bottle-filled { animation: club-bottle-fill 0.4s ease-out backwards; }
          .club-pulse { animation: club-pulse-ring 2.2s ease-in-out infinite; }
          .club-expand { animation: club-expand-in 0.18s ease-out; }
        }
      `}</style>

      {/* 3a. Header stats */}
      <div className="flex flex-wrap gap-x-6 gap-y-3 mb-5">
        <div>
          <p className="font-sans text-xs uppercase tracking-wide mb-0.5" style={{ color: 'rgba(42,24,16,0.45)' }}>This case</p>
          <p className="font-serif text-lg" style={{ color: INK }}>{bottlesIntoCurrentCase} of 12 bottles</p>
        </div>
        <div>
          <p className="font-sans text-xs uppercase tracking-wide mb-0.5" style={{ color: 'rgba(42,24,16,0.45)' }}>This year</p>
          <p className="font-serif text-lg" style={{ color: INK }}>{casesThisCycle} case{casesThisCycle === 1 ? '' : 's'}</p>
        </div>
        {creditBalancePence > 0 && (
          <div>
            <p className="font-sans text-xs uppercase tracking-wide mb-0.5" style={{ color: 'rgba(42,24,16,0.45)' }}>Credit</p>
            <p className="font-serif text-lg" style={{ color: INK }}>£{(creditBalancePence / 100).toFixed(2)}</p>
          </div>
        )}
      </div>

      {/* 3b. Bottle counter */}
      <div className="mb-6">
        <div className="flex gap-1.5 flex-wrap">
          {Array.from({ length: 12 }, (_, i) => (
            <BottleGlyph key={i} filled={i < bottlesIntoCurrentCase} delayMs={i * 35} />
          ))}
        </div>
        <p className="font-sans text-xs mt-2" style={{ color: 'rgba(42,24,16,0.45)' }}>
          {bottlesThisCycle === 0
            ? 'Your first case of the year starts with your next order.'
            : `${12 - bottlesIntoCurrentCase} more bottle${12 - bottlesIntoCurrentCase === 1 ? '' : 's'} complete case ${nextCaseNumber}.`}
        </p>
      </div>

      {/* 3c. Ladder */}
      <div className="mb-2">
        {ladderNodes.map((node) => (
          <LadderNodeRow key={node.rung} node={node} twilioPhoneNumber={twilioPhoneNumber} />
        ))}
      </div>
      {topOfLadder && (
        <p className="font-serif italic text-sm mb-4" style={{ color: 'rgba(42,24,16,0.55)' }}>
          Top of the ladder. We&rsquo;ll have to build a taller one.
        </p>
      )}

      {/* 3d. Membership year footer */}
      {renewalDate && (
        <p className="font-sans text-xs pt-3 border-t" style={{ color: 'rgba(42,24,16,0.40)', borderColor: 'rgba(42,24,16,0.10)' }}>
          Your membership year renews on{' '}
          {new Date(renewalDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.{' '}
          <a href="/club" className="underline underline-offset-2" style={{ color: 'rgba(42,24,16,0.55)' }}>
            How the year works →
          </a>
        </p>
      )}
    </div>
  )
}
