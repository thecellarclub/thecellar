import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { createServiceClient } from './supabase'
import { isAllowed } from './rateLimit'

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

        // Rate-limit by email since we can't easily get the caller's IP here.
        // In-memory is imperfect on serverless but this is belt-and-braces on
        // top of bcrypt cost 12.
        if (!isAllowed(`admin-login:${credentials.email.toLowerCase()}`, 10, 15 * 60 * 1000)) {
          return null
        }

        const sb = createServiceClient()
        const { data: row, error } = await sb
          .from('admin_users')
          .select('id, email, name, password_hash')
          .ilike('email', credentials.email)
          .maybeSingle()

        if (error || !row) return null

        const valid = await bcrypt.compare(credentials.password, row.password_hash)
        if (!valid) return null
        return { id: row.id, email: row.email, name: row.name }
      },
    }),
  ],
  session: { strategy: 'jwt', maxAge: 7 * 24 * 60 * 60 },
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
