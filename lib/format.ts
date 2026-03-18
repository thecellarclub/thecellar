/** Format pence integer as £X.XX string */
export function penceToGbp(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`
}

/** Short date e.g. "12 Mar 2026" */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** Short datetime e.g. "12 Mar 2026, 14:30" */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
