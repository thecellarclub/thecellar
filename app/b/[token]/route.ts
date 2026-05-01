import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /b/[token]
 *
 * Short-URL redirect for billing/card-update links sent via SMS.
 * Keeps the URL compact in text messages (~32 chars vs ~72 for the full URL).
 * Redirects to /billing?token=[token] which handles validation and renders the form.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  return NextResponse.redirect(
    new URL(`/billing?token=${encodeURIComponent(token)}`, _req.url),
    { status: 302 }
  )
}
