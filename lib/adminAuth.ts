import { getServerSession } from 'next-auth'
import { authOptions } from './auth'
import { NextResponse } from 'next/server'

/**
 * Use in every /api/admin/* route handler.
 * Returns { ok: true } if authenticated,
 * or { ok: false, response } with a 401 to return immediately.
 */
export async function requireAdminSession(): Promise<
  { ok: true } | { ok: false; response: NextResponse }
> {
  const session = await getServerSession(authOptions)
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorised' }, { status: 401 }),
    }
  }
  return { ok: true }
}
