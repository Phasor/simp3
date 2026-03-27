'use client'

import Link from 'next/link'
import { getBunnyStorageUrl } from '@/lib/utils/bunnynet'

interface DomCardProps {
  id: string
  displayName: string | null
  handle: string | null
  tagline: string | null
  profilePictureUrl: string | null
}

export default function DomCard({ displayName, handle, tagline, profilePictureUrl }: DomCardProps) {
  const name = displayName || handle || 'Dom'
  const avatarUrl = profilePictureUrl ? getBunnyStorageUrl(profilePictureUrl) : null
  const profileHref = handle ? `/${handle}` : '#'

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full overflow-hidden shrink-0 ring-1 ring-gold/30">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gray-900 flex items-center justify-center font-serif text-xl text-white/40">
              {name[0].toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-serif text-lg font-medium text-white truncate">{name}</p>
          {tagline && (
            <p className="font-serif italic text-white/35 text-sm truncate">{tagline}</p>
          )}
        </div>
      </div>
      <Link
        href={profileHref}
        className="mt-4 block w-full py-2.5 rounded-xl border border-white/10 text-white/60 text-sm font-medium text-center hover:border-white/20 hover:text-white/80 transition-colors"
      >
        View Profile
      </Link>
    </div>
  )
}
