'use client'

import { useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { useAuth } from '@/lib/contexts/AuthContext'

export default function SignupPage() {
  const { supabase } = useAuth()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return

    setLoading(true)

    try {
      const redirectTo = `${window.location.origin}/auth/callback`
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      })

      if (error) {
        toast.error(error.message)
        return
      }

      setSent(true)
    } catch (err) {
      console.error('Signup error:', err)
      toast.error('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <div className="w-full max-w-md text-center">
          <h1 className="text-3xl font-bold text-white mb-4">Check your email</h1>
          <p className="text-gray-400 mb-8">
            We sent a magic link to <span className="text-white font-medium">{email}</span>.
            Click the link to continue.
          </p>
          <button
            onClick={() => setSent(false)}
            className="text-sm text-gray-400 hover:text-white underline"
          >
            Use a different email
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Join Tribute</h1>
          <p className="text-gray-400">Enter your email to get started</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-gray-500"
          />

          <button
            type="submit"
            disabled={loading || !email}
            className="w-full py-3 rounded-lg font-medium text-black bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Sending...' : 'Continue'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Already have an account?{' '}
          <Link href="/login" className="text-white hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
