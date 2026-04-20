'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import SignOutButton from './SignOutButton'

const links = [
  { href: '/admin', label: 'Dashboard', exact: true },
  { href: '/admin/customers', label: 'Customers', exact: false },
  { href: '/admin/wines', label: 'Wines', exact: false },
  { href: '/admin/send', label: 'Send text', exact: false },
  { href: '/admin/texts', label: 'Text history', exact: false },
  { href: '/admin/shipments', label: 'Shipments', exact: false },
  { href: '/admin/billing', label: 'Billing', exact: false },
  { href: '/admin/requests', label: 'Requests', exact: false },
  { href: '/admin/concierge', label: 'Concierge', exact: false },
]

export default function MobileAdminNav() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  return (
    <div className="md:hidden">
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-4 bg-gray-900 text-white shrink-0"
        style={{ height: '56px' }}
      >
        <div>
          <p className="font-bold text-sm tracking-wide">The Cellar Club</p>
          <p className="text-xs text-gray-400">Admin</p>
        </div>
        <button
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          className="flex items-center justify-center rounded hover:bg-gray-700 transition-colors"
          style={{ minWidth: '44px', minHeight: '44px' }}
        >
          <svg width="20" height="16" viewBox="0 0 20 16" fill="none" aria-hidden="true">
            <line x1="0" y1="1" x2="20" y2="1" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="0" y1="8" x2="20" y2="8" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="0" y1="15" x2="20" y2="15" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Drawer */}
      {open && (
        <div className="fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          {/* Panel */}
          <div className="absolute left-0 top-0 bottom-0 w-64 bg-gray-900 text-white flex flex-col shadow-2xl">
            {/* Drawer header */}
            <div
              className="flex items-center justify-between px-4 border-b border-gray-700 shrink-0"
              style={{ height: '56px' }}
            >
              <p className="font-bold text-sm tracking-wide">The Cellar Club Admin</p>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close navigation"
                className="flex items-center justify-center rounded hover:bg-gray-700 transition-colors"
                style={{ minWidth: '44px', minHeight: '44px' }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <line x1="1" y1="1" x2="13" y2="13" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                  <line x1="13" y1="1" x2="1" y2="13" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Nav links */}
            <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
              {links.map(({ href, label, exact }) => {
                const active = exact ? pathname === href : pathname.startsWith(href)
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center px-3 rounded text-base font-medium transition-colors ${
                      active
                        ? 'bg-gray-700 text-white'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    }`}
                    style={{ minHeight: '44px' }}
                  >
                    {label}
                  </Link>
                )
              })}
            </nav>

            <div className="px-4 py-4 border-t border-gray-700 shrink-0">
              <SignOutButton />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
