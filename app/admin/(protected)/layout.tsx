import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AdminNav from '../_components/AdminNav'
import SignOutButton from '../_components/SignOutButton'
import MobileAdminNav from '../_components/MobileAdminNav'

export const metadata = { title: 'Cellar Text Admin' }

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Belt-and-braces: proxy.ts handles the redirect, this catches any gap
  const session = await getServerSession(authOptions)
  if (!session) redirect('/admin/login')

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Desktop sidebar — hidden on mobile */}
      <aside className="hidden md:flex md:flex-col w-52 bg-gray-900 text-white shrink-0">
        <div className="px-4 py-5 border-b border-gray-700">
          <p className="font-bold text-sm tracking-wide">Cellar Text</p>
          <p className="text-xs text-gray-400 mt-0.5">Admin</p>
        </div>
        <AdminNav />
        <div className="mt-auto px-4 py-4 border-t border-gray-700">
          <SignOutButton />
        </div>
      </aside>

      {/* Content wrapper — takes remaining width */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top nav + hamburger (hidden on md+) */}
        <MobileAdminNav />

        {/* Page content */}
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
