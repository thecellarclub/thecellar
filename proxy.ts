import { withAuth } from 'next-auth/middleware'

/**
 * Protects all /admin/* pages and /api/admin/* routes server-side.
 * Unauthenticated requests are redirected to /admin/login.
 *
 * This runs at the Edge before any page/route handler, so it is impossible
 * to accidentally expose an admin route that "forgets" to check auth —
 * the middleware enforces it unconditionally for every matched path.
 */
export default withAuth({
  pages: {
    signIn: '/admin/login',
  },
})

export const config = {
  matcher: [
    '/admin/((?!login$).*)',
    '/api/admin/:path*',
  ],
}
