import { getServerSession } from 'next-auth'
import { authOptions } from './auth'
import { NextResponse } from 'next/server'

export type AdminSession = {
  user: {
    id: string
    email: string
    name: string
  }
}

/**
 * Use in every /api/admin/* route handler.
 * Returns the session if authenticated, or a 401 response to return immediately.
 */
export async function requireAdminSession(): Promise<
  { ok: true; session: AdminSession } | { ok: false; response: NextResponse }
> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorised' }, { status: 401 }),
    }
  }
  return { ok: true, session: session as AdminSession }
}
