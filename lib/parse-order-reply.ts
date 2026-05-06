export type ParseResult =
  | { kind: 'quantity'; quantity: number; ambiguous?: boolean; raw: string }
  | { kind: 'unparseable'; raw: string }

// Ordered so that more specific words are tested before the generic article 'a'/'an'
const WORD_ENTRIES: [string, number][] = [
  ['one', 1], ['two', 2], ['three', 3], ['four', 4], ['five', 5],
  ['six', 6], ['seven', 7], ['eight', 8], ['nine', 9], ['ten', 10],
  ['eleven', 11], ['twelve', 12],
  ['single', 1], ['couple', 2], ['pair', 2], ['few', 3],
  ['an', 1], ['a', 1],
]

// Negation patterns — tested on lightly-cleaned (lowercase, apostrophe kept) text
const NEGATION = /\b(no|not|none|don'?t|cancel|skip)\b/
const POSITIVE = /\b(yes|want|take|i'?ll\s+take|please\s+send)\b/

export function parseOrderReply(input: string): ParseResult {
  const raw = input

  // Step 1: trim + lowercase for negation/positive check (keep apostrophes)
  const lower = input.trim().toLowerCase()
  if (!lower) return { kind: 'unparseable', raw }

  // Reject anything longer than 5 words — it's a human message, not a quantity
  if (lower.split(/\s+/).length > 5) return { kind: 'unparseable', raw }

  // Step 5: negation guard — reject if negation present and no positive phrasing
  if (NEGATION.test(lower) && !POSITIVE.test(lower)) {
    return { kind: 'unparseable', raw }
  }

  // Strip all punctuation except '?' for digit/word matching
  const cleaned = lower.replace(/[^\w\s?]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!cleaned) return { kind: 'unparseable', raw }

  // Step 2: digit match — take first, flag ambiguous if more than one found
  const digitMatches = [...cleaned.matchAll(/\b(\d{1,3})\b/g)]
  const digitQty = digitMatches.length > 0 ? parseInt(digitMatches[0][1], 10) : null
  const multipleDigits = digitMatches.length > 1

  // Step 3: first word-map match (ordered: specific before generic)
  let wordQty: number | null = null
  for (const [word, val] of WORD_ENTRIES) {
    if (new RegExp(`\\b${word}\\b`).test(cleaned)) {
      wordQty = val
      break
    }
  }

  // Step 4: both found → prefer digit, mark ambiguous
  let quantity: number | null = null
  let ambiguous = false

  if (digitQty !== null && wordQty !== null) {
    quantity = digitQty
    ambiguous = true
  } else if (digitQty !== null) {
    quantity = digitQty
    if (multipleDigits) ambiguous = true
  } else if (wordQty !== null) {
    quantity = wordQty
  }

  // Step 6: quantity must be ≥ 1
  if (quantity === null || quantity < 1) return { kind: 'unparseable', raw }

  return ambiguous
    ? { kind: 'quantity', quantity, ambiguous: true, raw }
    : { kind: 'quantity', quantity, raw }
}
