import { randomBytes } from 'crypto'

/**
 * Generate a short URL-safe token for use in SMS links.
 * 6 bytes → 8 base64url characters (~48 bits of entropy).
 * Example: "aB3xYp9Q"
 */
export function generateShortToken(): string {
  return randomBytes(6).toString('base64url')
}
