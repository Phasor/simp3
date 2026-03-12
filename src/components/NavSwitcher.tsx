'use client'

import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/contexts/AuthContext'
import DomDashboardNav from '@/components/DomDashboardNav'
import SubBottomNav from '@/components/SubBottomNav'

// Static route prefixes that exist in the app (not domHandle dynamic segments).
// Used to identify [domHandle] routes — anything NOT in this list that starts
// at root level is a domHandle and gets WordmarkOnly from its own layout.
const KNOWN_STATIC_PREFIXES = [
  '/login', '/signup', '/onboarding', '/auth', '/chat', '/dashboard',
  '/task', '/score', '/profile', '/settings', '/api', '/payment',
]

function isDomHandleRoute(path: string) {
  if (path === '/') return false
  const first = '/' + path.split('/')[1]
  return !KNOWN_STATIC_PREFIXES.some(p => first === p || first.startsWith(p + '/'))
}

// Routes that manage their own nav (or have no nav at all).
// The global NavSwitcher renders nothing for these.
const NO_GLOBAL_NAV = [
  /^\/$/, // home page handles its own redirect
  /^\/login/,
  /^\/signup/,
  /^\/onboarding/,
  /^\/task\/[^/]+\/pay$/,       // Send Moment — zero nav
  /^\/task\/[^/]+\/complete$/,  // Task completion — minimal header in-page
]

export default function NavSwitcher() {
  const pathname = usePathname()
  const { profile, resolved } = useAuth()

  // Don't flash nav before auth resolves
  if (!resolved) return null

  // Routes that opt out of the global nav
  if (NO_GLOBAL_NAV.some(re => re.test(pathname))) return null

  // [domHandle] routes have WordmarkOnly rendered in their own layout
  if (isDomHandleRoute(pathname)) return null

  if (!profile) return null

  if (profile.user_type === 'CREATOR') return <DomDashboardNav />
  if (profile.user_type === 'FAN') return <SubBottomNav />

  return null
}
