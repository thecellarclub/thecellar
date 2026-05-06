/**
 * Centralised SMS templates for the order/billing flow.
 * All functions return a plain string; callers must pass through sanitiseGsm7 before sending.
 */

/** Customer replied with quantity but has no card on file. No YES instruction — that comes after card save. */
export function noCardCardLink(n: number, wineName: string, total: string, appUrl: string, token: string): string {
  return `Got it — ${n} of ${wineName} (£${total}). Just need a card on file first: ${appUrl}/b/${token}. Once saved, I'll send a final confirm.`
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
  return `Card didn't go through for your ${n}-bottle order. Update it here: ${appUrl}/b/${token} — then reply YES to try again.`
}

/** Daily cron nudge when order is still payment_failed after first attempt. */
export function paymentFailedNudge(n: number, appUrl: string, token: string): string {
  return `Reminder: card still declining for your ${n}-bottle order. Update here: ${appUrl}/b/${token} — I'll cancel tomorrow if not.`
}

/** Sent when order is cancelled by the retry cron after two failed attempts. */
export function paymentFailedCancelled(): string {
  return `Couldn't charge your card so I cancelled your order. Reply OFFER to try again.`
}
