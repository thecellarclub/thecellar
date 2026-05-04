/**
 * Centralised SMS templates for the order/billing flow.
 * All functions return a plain string; callers must pass through sanitiseGsm7 before sending.
 */

/** Customer replied with quantity but has no card on file. No YES instruction — that comes after card save. */
export function noCardCardLink(n: number, wineName: string, total: string, appUrl: string, token: string): string {
  return `Got it — ${n} of ${wineName} (£${total}). Add a card here and we'll send you a final check to confirm: ${appUrl}/b/${token}`
}

/** Sent after card saved (update-card or setup_intent webhook) when a pending order exists. */
export function cardSavedOrderRecap(n: number, wineName: string, total: string, last4: string): string {
  return `Card saved. Final check: ${n} x ${wineName}, £${total}, card ending ${last4}. Reply YES to confirm.`
}

/** Sent after card saved when no pending order exists. */
export function cardSavedNoOrder(): string {
  return `Card saved. Reply OFFER any time to see what's available.`
}

/** Sent immediately when YES charge fails. No YES gate in this SMS — that fires after card update. */
export function paymentFailedT0(n: number, appUrl: string, token: string): string {
  return `Card declined for your ${n}-bottle order. Update card here: ${appUrl}/b/${token} — we'll send a fresh check once it's saved.`
}

/** Daily cron nudge when order is still payment_failed after first attempt. */
export function paymentFailedNudge(n: number, appUrl: string, token: string): string {
  return `Reminder: card still declining for your ${n}-bottle order. Update here: ${appUrl}/b/${token}. We'll cancel tomorrow if not.`
}

/** Sent when order is cancelled by the retry cron after two failed attempts. */
export function paymentFailedCancelled(): string {
  return `We couldn't charge your card so we cancelled your order. Reply OFFER to try again.`
}

/** Sent when an inbound SMS can't be parsed as a quantity or keyword. */
export function unparseableFallback(): string {
  return `Sorry, didn't catch that. Reply with a number (e.g. 2) to order. For anything else, reply QUESTION followed by your message.`
}
