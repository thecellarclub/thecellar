import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

export const COOKIE_NAME = 'portal_session'
const EXPIRY_SECONDS = 30 * 24 * 60 * 60 // 30 days

export interface PortalPayload {
  customerId: string
  phone: string
}

function getSecret(): Uint8Array {
  const secret = process.env.PORTAL_JWT_SECRET
  if (!secret) throw new Error('PORTAL_JWT_SECRET is not set')
  return new TextEncoder().encode(secret)
}

/**
 * Sign a portal JWT and return the token string.
 */
export async function signPortalToken(customerId: string, phone: string): Promise<string> {
  return new SignJWT({ customerId, phone })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${EXPIRY_SECONDS}s`)
    .sign(getSecret())
}

/**
 * Verify a portal JWT and return the payload.
 * Throws if the token is invalid or expired.
 */
export async function verifyPortalToken(token: string): Promise<PortalPayload> {
  const { payload } = await jwtVerify(token, getSecret())
  return payload as unknown as PortalPayload
}

/**
 * Read the portal session from the request cookies (API routes)
 * or from next/headers cookies() (server components / server actions).
 *
 * Returns null if no valid session exists.
 */
export async function getPortalSession(
  req?: { cookies: { get: (name: string) => { value: string } | undefined } }
): Promise<PortalPayload | null> {
  let token: string | undefined

  if (req) {
    token = req.cookies.get(COOKIE_NAME)?.value
  } else {
    const cookieStore = await cookies()
    token = cookieStore.get(COOKIE_NAME)?.value
  }

  if (!token) return null

  try {
    return await verifyPortalToken(token)
  } catch {
    return null
  }
}
