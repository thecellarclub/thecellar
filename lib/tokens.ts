/**
 * Token expiry constants and validators.
 *
 * Expiry is calculated from the parent record's created_at timestamp,
 * not from a separate expires_at column — no extra schema columns needed.
 */

/** /authenticate?token= links expire 15 minutes after the order was created */
export const AUTH_TOKEN_TTL_MS = 15 * 60 * 1000

/** /ship?token= links expire 7 days after the shipment was created */
export const SHIP_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Returns true if the auth token (3DS payment link) has expired.
 * @param orderCreatedAt ISO 8601 timestamp from orders.created_at
 */
export function isAuthTokenExpired(orderCreatedAt: string): boolean {
  return Date.now() - new Date(orderCreatedAt).getTime() > AUTH_TOKEN_TTL_MS
}

/**
 * Returns true if the ship token has expired.
 * @param shipmentCreatedAt ISO 8601 timestamp from shipments.created_at
 */
export function isShipTokenExpired(shipmentCreatedAt: string): boolean {
  return Date.now() - new Date(shipmentCreatedAt).getTime() > SHIP_TOKEN_TTL_MS
}

/** Remaining TTL in seconds for a given created_at, clamped to 0 */
export function remainingSeconds(createdAt: string, ttlMs: number): number {
  const elapsed = Date.now() - new Date(createdAt).getTime()
  return Math.max(0, Math.floor((ttlMs - elapsed) / 1000))
}
