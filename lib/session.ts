import { getIronSession, IronSession, SessionOptions } from 'iron-session'
import { cookies } from 'next/headers'

export interface SignupSessionData {
  phone?: string
  phoneVerified?: boolean
  stripeCustomerId?: string
  setupIntentId?: string
  paymentMethodId?: string
  firstName?: string
  lastName?: string
  email?: string
  dobDay?: number
  dobMonth?: number
  dobYear?: number
}

export const sessionOptions: SessionOptions = {
  password: process.env.NEXTAUTH_SECRET as string,
  cookieName: 'ct_signup',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60, // 1 hour
  },
}

export async function getSignupSession(): Promise<IronSession<SignupSessionData>> {
  const cookieStore = await cookies()
  return getIronSession<SignupSessionData>(cookieStore, sessionOptions)
}
