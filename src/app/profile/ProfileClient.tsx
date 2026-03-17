'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import type { Profile } from '@/lib/types/database'

interface ProfileClientProps {
  initialProfile?: Profile | null
}

export default function ProfileClient({ initialProfile }: ProfileClientProps) {
  const { profile: contextProfile, refreshProfile } = useAuth()
  const router = useRouter()

  const profile = initialProfile || contextProfile

  const [formData, setFormData] = useState({ displayName: '', email: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (profile) {
      setFormData({
        displayName: profile.display_name || '',
        email: profile.email || '',
      })
    }
  }, [profile])

  useEffect(() => {
    if (profile && profile.user_type !== 'FAN') {
      router.push('/')
    }
  }, [profile, router])

  useEffect(() => {
    if (!profile) {
      setTimeout(() => {
        if (!contextProfile) router.replace('/onboarding')
      }, 2000)
    }
  }, [profile, contextProfile, router])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setMessage(null)

    try {
      const response = await fetch('/api/profile/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: formData.displayName.trim(),
          email: formData.email.trim(),
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to update profile')

      setMessage({ type: 'success', text: 'Changes saved.' })
      await refreshProfile()
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to update profile',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  const initials = (profile.display_name || profile.email || 'U')[0].toUpperCase()

  return (
    <div className="min-h-screen bg-black pb-24">
      <div className="max-w-lg mx-auto px-4 pt-10">

        {/* Avatar */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center mb-3">
            {profile.profile_picture_url ? (
              <img
                src={profile.profile_picture_url}
                alt="Profile"
                className="w-20 h-20 rounded-full object-cover"
              />
            ) : (
              <span className="text-2xl font-bold text-white">{initials}</span>
            )}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="displayName" className="block text-xs font-medium text-white/50 mb-2 uppercase tracking-wider">
              Display Name
            </label>
            <input
              type="text"
              id="displayName"
              name="displayName"
              value={formData.displayName}
              onChange={handleInputChange}
              placeholder="Your name"
              className="w-full bg-gray-950 border border-gray-800 text-white rounded-lg px-4 py-3 text-sm placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-xs font-medium text-white/50 mb-2 uppercase tracking-wider">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              required
              placeholder="you@example.com"
              className="w-full bg-gray-950 border border-gray-800 text-white rounded-lg px-4 py-3 text-sm placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors"
            />
          </div>

          {message && (
            <p className={`text-sm ${message.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
              {message.text}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-white text-black font-semibold text-sm rounded-lg py-3 hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity mt-2"
          >
            {isSubmitting ? 'Saving…' : 'Save Changes'}
          </button>
        </form>

      </div>
    </div>
  )
}
