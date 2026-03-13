'use client'

import dynamic from 'next/dynamic'

// Privy is a browser-only library. Dynamic import with ssr:false keeps it out of
// the server bundle so ISR pages (e.g. /[domHandle]) don't fail at render time.
const PrivyClientProvider = dynamic(() => import('./PrivyClientProvider'), { ssr: false })

export default function PrivyNoSSR({ children }: { children: React.ReactNode }) {
  return <PrivyClientProvider>{children}</PrivyClientProvider>
}
