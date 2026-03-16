'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/contexts/AuthContext'

const TABS = [
  { label: 'Overview', href: '/dashboard' },
  { label: 'Tasks',    href: '/dashboard/tasks' },
  { label: 'Subs',     href: '/dashboard/subs' },
  { label: 'Chat',     href: '/chat' },
  { label: 'Earnings', href: '/dashboard/earnings' },
  { label: 'Settings', href: '/dashboard/settings' },
]

function HamburgerIcon({ open }: { open: boolean }) {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      {open ? (
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
      )}
    </svg>
  )
}

export default function DomDashboardNav() {
  const pathname = usePathname()
  const { profile, signOut } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Close mobile menu on navigation
  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  // Only render for CREATORs
  if (profile?.user_type !== 'CREATOR') return null

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  const profileHref = profile?.handle ? `/${profile.handle}` : '/dashboard'

  return (
    <header className="sticky top-0 z-50 bg-black border-b border-gray-900">
      {/* Main bar */}
      <div className="flex items-center h-14 px-4 gap-4">
        {/* Wordmark */}
        <Link href="/dashboard" className="text-white font-bold text-xl tracking-tight shrink-0 mr-2">
          Tribute
        </Link>

        {/* Desktop tabs */}
        <nav className="hidden md:flex items-center gap-1 flex-1">
          {TABS.map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                isActive(href)
                  ? 'text-white bg-gray-900'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex-1 md:hidden" />

        {/* Profile dropdown (desktop) */}
        <div className="hidden md:block relative shrink-0" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(v => !v)}
            className="flex items-center gap-2 focus:outline-none"
          >
            {profile?.profile_picture_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.profile_picture_url}
                alt="Profile"
                className="w-8 h-8 rounded-full object-cover border border-gray-700"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-gray-400 text-sm font-medium">
                {(profile?.display_name ?? profile?.email ?? 'D')[0].toUpperCase()}
              </div>
            )}
          </button>
          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-gray-950 border border-gray-800 rounded-xl shadow-xl overflow-hidden">
              <Link
                href={profileHref}
                className="block px-4 py-3 text-sm text-gray-300 hover:text-white hover:bg-gray-900 transition-colors"
                onClick={() => setDropdownOpen(false)}
              >
                View my profile
              </Link>
              <button
                onClick={() => { setDropdownOpen(false); signOut() }}
                className="w-full text-left px-4 py-3 text-sm text-gray-500 hover:text-red-400 hover:bg-gray-900 transition-colors border-t border-gray-800"
              >
                Logout
              </button>
            </div>
          )}
        </div>

        {/* Hamburger (mobile) */}
        <button
          className="md:hidden text-gray-400 hover:text-white transition-colors"
          onClick={() => setMenuOpen(v => !v)}
          aria-label="Toggle menu"
        >
          <HamburgerIcon open={menuOpen} />
        </button>
      </div>

      {/* Mobile slide-down menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-gray-900 bg-black">
          <nav className="flex flex-col px-4 py-3 gap-1">
            {TABS.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className={`px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  isActive(href)
                    ? 'text-white bg-gray-900'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {label}
              </Link>
            ))}
            <div className="border-t border-gray-900 mt-2 pt-2 flex flex-col gap-1">
              <Link
                href={profileHref}
                className="px-3 py-2.5 rounded-md text-sm text-gray-500 hover:text-gray-300 transition-colors"
              >
                View my profile
              </Link>
              <button
                onClick={signOut}
                className="text-left px-3 py-2.5 rounded-md text-sm text-gray-500 hover:text-red-400 transition-colors"
              >
                Logout
              </button>
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
