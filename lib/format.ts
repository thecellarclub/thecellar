/** Format pence integer as £X.XX string */
export function penceToGbp(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

/** Short date e.g. "2nd August 2026" */
export function formatDate(iso: string): string {
  const d = new Date(iso)
  const day = ordinal(d.getDate())
  const month = d.toLocaleDateString('en-GB', { month: 'long' })
  const year = d.getFullYear()
  return `${day} ${month} ${year}`
}

/** Short datetime e.g. "2nd Aug 2026, 14:30" */
export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  const day = ordinal(d.getDate())
  const month = d.toLocaleDateString('en-GB', { month: 'short' })
  const year = d.getFullYear()
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  return `${day} ${month} ${year}, ${time}`
}
