import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { createServiceClient } from './supabase'

declare module 'next-auth' {
  interface User {
    id: string
    email: string
    name: string
  }
  interface Session {
    user: {
      id: string
      email: string
      name: string
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    email: string
    name: string
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        // Try DB-backed admin_users first
        try {
          const sb = createServiceClient()
          const { data: row, error } = await sb
            .from('admin_users')
            .select('id, email, name, password_hash')
            .ilike('email', credentials.email)
            .maybeSingle()

          if (!error && row && row.password_hash && !row.password_hash.startsWith('$placeholder')) {
            const valid = await bcrypt.compare(credentials.password, row.password_hash)
            if (!valid) return null
            return { id: row.id, email: row.email, name: row.name }
          }
        } catch (err) {
          console.warn('[auth] admin_users lookup failed, falling back to env vars:', err)
        }

        // Fallback: env-var single user (pre-migration or seed-not-yet-run)
        if (
          process.env.ADMIN_EMAIL &&
          process.env.ADMIN_PASSWORD_HASH &&
          credentials.email.toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase()
        ) {
          console.warn('[auth] WARNING: using env-var admin fallback — run the seed script to switch to DB auth')
          const valid = await bcrypt.compare(credentials.password, process.env.ADMIN_PASSWORD_HASH)
          if (!valid) return null
          return { id: 'admin', email: credentials.email, name: 'Admin' }
        }

        return null
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/admin/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.email = user.email as string
        token.name = user.name as string
      }
      // Backfill id from sub for sessions minted before the id field was added
      if (!token.id && token.sub) token.id = token.sub
      return token
    },
    async session({ session, token }) {
      session.user = {
        id: token.id,
        email: token.email,
        name: token.name,
      }
      return session
    },
  },
}
