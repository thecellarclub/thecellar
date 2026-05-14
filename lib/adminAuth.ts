import { getServerSession } from 'next-auth'
import { authOptions } from './auth'
import { NextResponse } from 'next/server'
import { createServiceClient } from './supabase'

export type AdminSession = {
  user: {
    id: string
    email: string
    name: string
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Use in every /api/admin/* route handler.
 * Returns the session if authenticated, or a 401 response to return immediately.
 *
 * Stale sessions minted before multi-user auth (where id was the string 'admin')
 * are transparently re-resolved to the real admin_users UUID via email lookup,
 * so FK inserts (notes, activity log, etc.) succeed without requiring a sign-out.
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

  // If the session id is not a UUID (e.g. legacy 'admin' string), resolve via email
  if (!UUID_RE.test(session.user.id)) {
    const sb = createServiceClient()
    const { data: row } = await sb
      .from('admin_users')
      .select('id, name, email')
      .ilike('email', session.user.email)
      .maybeSingle()
    if (!row) {
      return {
        ok: false,
        response: NextResponse.json({ error: 'Unauthorised' }, { status: 401 }),
      }
    }
    return {
      ok: true,
      session: { user: { id: row.id, email: row.email, name: row.name } },
    }
  }

  return { ok: true, session: session as AdminSession }
}
