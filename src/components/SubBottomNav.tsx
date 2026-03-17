'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/contexts/AuthContext'
import { getBunnyStorageUrl } from '@/lib/utils/bunnynet'

// ── Icons ──────────────────────────────────────────────────────────────────────
function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg className="w-5 h-5" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  )
}

function ChatIcon({ active }: { active: boolean }) {
  return (
    <svg className="w-5 h-5" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
    </svg>
  )
}

function TrophyIcon({ active }: { active: boolean }) {
  return (
    <svg className="w-5 h-5" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
    </svg>
  )
}

function UserIcon({ active }: { active: boolean }) {
  return (
    <svg className="w-5 h-5" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  )
}

function LibraryIcon({ active }: { active: boolean }) {
  return (
    <svg className="w-5 h-5" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
    </svg>
  )
}

// ── Route rules ────────────────────────────────────────────────────────────────
const ALWAYS_HIDDEN_PATTERNS = [
  /^\/task\/[^/]+\/pay$/,
  /^\/task\/[^/]+\/complete$/,
]
const HIDE_BOTTOM_ON_MOBILE = ['/chat']

export default function SubBottomNav() {
  const pathname = usePathname()
  const { profile, signOut } = useAuth()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [dropdownOpen])

  if (profile?.user_type !== 'FAN') return null
  if (ALWAYS_HIDDEN_PATTERNS.some(re => re.test(pathname))) return null

  const scoreHref = profile?.id ? `/score/${profile.id}` : '/score'
  const avatarUrl = profile?.profile_picture_url
    ? getBunnyStorageUrl(profile.profile_picture_url)
    : null
  const initials = (profile?.display_name ?? profile?.tribute_alias ?? 'S')[0].toUpperCase()

  const tabs = [
    { label: 'Home',    href: '/home',    Icon: HomeIcon,    active: pathname === '/home' || pathname === '/' },
    { label: 'Chat',    href: '/chat',    Icon: ChatIcon,    active: pathname.startsWith('/chat') },
    { label: 'Library', href: '/library', Icon: LibraryIcon, active: pathname.startsWith('/library') },
    { label: 'Score',   href: scoreHref,  Icon: TrophyIcon,  active: pathname.startsWith('/score') },
    { label: 'Profile', href: '/profile', Icon: UserIcon,    active: pathname === '/profile' },
  ]

  const hideBottomOnMobile = HIDE_BOTTOM_ON_MOBILE.some(r => pathname.startsWith(r))

  return (
    <>
      {/* ── Desktop top nav (md+) ── */}
      <header className="hidden md:flex sticky top-0 z-50 h-12 bg-black border-b border-gray-900 items-center px-6 gap-8">
        <Link href="/home" className="text-sm font-bold text-white tracking-tight shrink-0">
          Tribute
        </Link>
        <nav className="flex items-center gap-1 flex-1">
          {tabs.map(({ label, href, active }) => (
            <Link
              key={label}
              href={href}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-gray-950'
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Avatar + dropdown */}
        <div className="relative shrink-0" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(o => !o)}
            className="w-7 h-7 rounded-full overflow-hidden border border-gray-700 hover:border-gray-500 transition-colors focus:outline-none"
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gray-800 flex items-center justify-center text-xs font-semibold text-gray-300">
                {initials}
              </div>
            )}
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-9 w-44 bg-gray-950 border border-gray-800 rounded-xl shadow-xl overflow-hidden z-50">
              <Link
                href="/profile"
                onClick={() => setDropdownOpen(false)}
                className="block px-4 py-3 text-sm text-gray-300 hover:bg-gray-900 hover:text-white transition-colors"
              >
                Account settings
              </Link>
              <button
                onClick={() => { setDropdownOpen(false); signOut() }}
                className="w-full text-left px-4 py-3 text-sm text-gray-500 hover:bg-gray-900 hover:text-white transition-colors border-t border-gray-800"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── Mobile bottom nav (< md) ── */}
      <nav
        className={`fixed bottom-0 left-0 right-0 z-50 bg-black border-t border-gray-900 safe-area-bottom md:hidden ${
          hideBottomOnMobile ? 'hidden' : 'flex'
        }`}
      >
        {tabs.map(({ label, href, Icon, active }) => (
          <Link
            key={label}
            href={href}
            className={`flex-1 flex flex-col items-center justify-center py-3 gap-0.5 transition-colors ${
              active ? 'text-white' : 'text-gray-600 hover:text-gray-400'
            }`}
          >
            <Icon active={active} />
            <span className="text-[10px] font-medium tracking-wide">{label}</span>
          </Link>
        ))}
      </nav>
    </>
  )
}
