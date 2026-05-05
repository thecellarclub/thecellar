'use client'

interface Props {
  value: string
  className?: string
}

function smsSegments(length: number): number {
  if (length === 0) return 0
  return length <= 160 ? 1 : Math.ceil(length / 153)
}

export default function SmsCharCounter({ value, className }: Props) {
  const len = value.length
  const segs = smsSegments(len)

  const colour =
    len > 160
      ? 'text-red-600 font-bold'
      : len > 140
      ? 'text-amber-600'
      : 'text-green-600'

  return (
    <span className={`text-xs font-mono ${colour} ${className ?? ''}`}>
      {len} chars
      {segs > 1 ? ` · ${segs} segments` : ' · 1 segment'}
    </span>
  )
}
