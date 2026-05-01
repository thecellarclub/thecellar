'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/admin', label: 'Dashboard', exact: true },
  { href: '/admin/customers', label: 'Customers', exact: false },
  { href: '/admin/wines', label: 'Wines', exact: false },
  { href: '/admin/send', label: 'Send offer', exact: false },
  { href: '/admin/broadcast', label: 'Broadcast', exact: false },
  { href: '/admin/texts', label: 'Offer history', exact: false },
  { href: '/admin/shipments', label: 'Shipments', exact: false },
  { href: '/admin/billing', label: 'Billing', exact: false },
  { href: '/admin/inbox', label: 'Inbox', exact: false },
]

export default function AdminNav({ inboxCount = 0 }: { inboxCount?: number }) {
  const pathname = usePathname()
  return (
    <nav className='flex-1 px-2 py-3 space-y-0.5'>
      {links.map(({ href, label, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href)
        const cls = active
          ? 'bg-gray-700 text-white'
          : 'text-gray-400 hover:text-white hover:bg-gray-800'
        return (
          <Link
            key={href}
            href={href}
            className={'flex items-center justify-between px-3 py-2 rounded text-sm font-medium transition-colors ' + cls}
          >
            <span>{label}</span>
            {label === 'Inbox' && inboxCount > 0 && (
              <span className="ml-2 inline-flex items-center justify-center rounded-full bg-red-600 text-white text-xs font-bold leading-none px-1.5 py-0.5 min-w-[18px]">
                {inboxCount > 9 ? '9+' : inboxCount}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
