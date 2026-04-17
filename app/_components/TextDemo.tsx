'use client'

import { useState, useEffect } from 'react'

const BORDER = 'rgba(42,24,16,0.18)'

// Step machine:
//  0 — empty
//  1 — incoming typing (before msg 1)
//  2 — msg 1 visible (incoming)
//  3 — msg 2 visible ("2" outgoing)
//  4 — incoming typing (before msg 3)
//  5 — msg 3 visible (incoming)
//  6 — outgoing typing (before msg 4)
//  7 — msg 4 visible (outgoing long)
//  8 — incoming typing (final hold)
//  → reset to 0

// Timing rules from brief:
//  - Typing indicator for incoming: ~1.3–1.5s
//  - Hold msg on screen: ~60ms/char, min 3s, max 6s
//  - Outgoing "2": appears quickly, holds ~1.5s
//  - Outgoing typing (msg 4): ~0.8s then bubble, hold ~4s
//  - Total loop: ~22–24s

const TIMINGS = [
  { step: 1, delay: 600 },    // incoming typing 1 starts
  { step: 2, delay: 2000 },   // msg 1 in (typing 1.4s); hold 6s (143 chars ×60ms = 8.6s → cap 6s)
  { step: 3, delay: 8000 },   // msg 2 "2" out; hold 1.5s
  { step: 4, delay: 9500 },   // incoming typing 2 starts
  { step: 5, delay: 10900 },  // msg 3 in (typing 1.4s); hold 5s (82 chars ×60ms = 4.9s)
  { step: 6, delay: 15900 },  // outgoing typing for msg 4; 0.8s
  { step: 7, delay: 16700 },  // msg 4 out; hold 4s
  { step: 8, delay: 20700 },  // incoming typing 3 (final hold ~2.5s before reset)
  { step: 0, delay: 23200 },  // reset / loop
]

export function TextDemo() {
  const [step, setStep] = useState(0)
  const [loop, setLoop] = useState(0)
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setReduced(true)
      setStep(8)
      return
    }

    const timers = TIMINGS.map(({ step: s, delay }) =>
      setTimeout(() => {
        if (s === 0) setLoop(l => l + 1)
        else setStep(s)
      }, delay)
    )
    return () => timers.forEach(clearTimeout)
  }, [loop])

  const showTyping1       = step === 1
  const showMsg1          = step >= 2
  const showMsg2          = step >= 3
  const showTyping2       = step === 4
  const showMsg3          = step >= 5
  const showOutTyping     = step === 6
  const showMsg4          = step >= 7
  const showTyping3       = step >= 8

  return (
    <div
      className="relative mx-auto w-full"
      style={{
        maxWidth: 300,
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

        {/* Msg 1 incoming — typing indicator swaps to text */}
        {(showTyping1 || showMsg1) && (
          <IncomingBubble
            typing={showTyping1 && !showMsg1}
            text="Just found a killer skin-contact white from Slovenia — Movia Rebula, wild ferment, tastes like orchard fruit and sea air. Only 24 bottles."
            animateIn={!reduced}
          />
        )}

        {/* Msg 2 outgoing "2" */}
        {showMsg2 && <Bubble side="outgoing" text="2" animateIn={!reduced} />}

        {/* Msg 3 incoming — typing indicator swaps to text */}
        {(showTyping2 || showMsg3) && (
          <IncomingBubble
            typing={showTyping2 && !showMsg3}
            text="Done — 2 bottles of the Movia put aside for you. You're 7 away from a free case."
            animateIn={!reduced}
          />
        )}

        {/* Msg 4 outgoing — typing indicator then bubble */}
        {showOutTyping && !showMsg4 && (
          <div className="flex justify-end">
            <div
              style={{
                background: 'rgba(155,27,48,0.14)',
                borderRadius: '16px 16px 4px 16px',
                padding: '9px 14px',
              }}
            >
              <TypingDots color="rgba(155,27,48,0.55)" />
            </div>
          </div>
        )}
        {showMsg4 && (
          <Bubble
            side="outgoing"
            text="Can you help me with a special 60th birthday present for someone who loves Barolo?"
            animateIn={!reduced}
          />
        )}

        {/* Final incoming typing */}
        {showTyping3 && (
          <IncomingBubble typing text="" animateIn={false} />
        )}

      </div>
    </div>
  )
}

function IncomingBubble({
  typing,
  text,
  animateIn,
}: {
  typing: boolean
  text: string
  animateIn: boolean
}) {
  const [entered, setEntered] = useState(!animateIn)

  useEffect(() => {
    if (!animateIn) return
    const t = setTimeout(() => setEntered(true), 40)
    return () => clearTimeout(t)
  }, [animateIn])

  return (
    <div
      className="flex justify-start"
      style={{
        opacity: entered ? 1 : 0,
        transform: entered ? 'translateY(0)' : 'translateY(6px)',
        transition: 'opacity 300ms ease-out, transform 300ms ease-out',
      }}
    >
      <div
        style={{
          background: 'rgba(42,24,16,0.09)',
          borderRadius: '16px 16px 16px 4px',
          padding: typing ? '9px 14px' : '9px 12px',
          maxWidth: '84%',
          fontSize: 13,
          color: '#1C0E09',
          lineHeight: 1.45,
          transition: 'padding 150ms ease-out',
        }}
      >
        {typing ? <TypingDots color="rgba(42,24,16,0.5)" /> : text}
      </div>
    </div>
  )
}

function Bubble({
  side,
  text,
  animateIn,
}: {
  side: 'incoming' | 'outgoing'
  text: string
  animateIn: boolean
}) {
  const [entered, setEntered] = useState(!animateIn)

  useEffect(() => {
    if (!animateIn) return
    const t = setTimeout(() => setEntered(true), 40)
    return () => clearTimeout(t)
  }, [animateIn])

  return (
    <div
      className={`flex ${side === 'outgoing' ? 'justify-end' : 'justify-start'}`}
      style={{
        opacity: entered ? 1 : 0,
        transform: entered ? 'translateY(0)' : 'translateY(6px)',
        transition: 'opacity 300ms ease-out, transform 300ms ease-out',
      }}
    >
      <div
        style={{
          background: side === 'outgoing' ? '#9B1B30' : 'rgba(42,24,16,0.09)',
          color: side === 'outgoing' ? '#F0E6DC' : '#1C0E09',
          borderRadius: side === 'outgoing' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
          padding: '9px 12px',
          maxWidth: '76%',
          fontSize: 13,
          lineHeight: 1.45,
        }}
      >
        {text}
      </div>
    </div>
  )
}

function TypingDots({ color }: { color: string }) {
  return (
    <div className="flex gap-1 items-center" style={{ height: 12 }}>
      {[0, 1, 2].map(i => (
        <span
          key={i}
          style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: color,
            display: 'inline-block',
            animation: `typingBounce 1.2s ease-in-out ${i * 0.18}s infinite`,
          }}
        />
      ))}
    </div>
  )
}
