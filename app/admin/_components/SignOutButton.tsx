'use client'

import { signOut } from 'next-auth/react'

export default function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/admin/login' })}
      className="w-full text-left text-xs text-gray-400 hover:text-white transition-colors"
    >
      Sign out
    </button>
  )
}
