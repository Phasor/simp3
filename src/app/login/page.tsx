'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const supabase = createClient()
  const router = useRouter()
  const params = useSearchParams()
  const error = params.get('error') ?? ''
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    const redirectTo = `${window.location.origin}/auth/callback?next=/`
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    })
    setSending(false)
    if (error) { alert(error.message); return }
    alert('Magic link sent! Check your email.')
  }

  async function signInWithGoogle() {
    const redirectTo = `${window.location.origin}/auth/callback?next=/`
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    })
    if (error) alert(error.message)
  }

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="w-full max-w-md space-y-6">
        <h1 className="text-2xl font-semibold">Sign in</h1>

        {error ? <p className="text-red-600 text-sm">Error: {error}</p> : null}

        <form onSubmit={sendMagicLink} className="space-y-3">
          <label className="block text-sm">Email (Magic Link)</label>
          <input
            className="w-full border rounded p-2"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e)=>setEmail(e.target.value)}
            required
          />
          <button type="submit" disabled={sending} className="w-full rounded bg-black text-white py-2">
            {sending ? 'Sending…' : 'Send Magic Link'}
          </button>
        </form>

        <div className="flex items-center gap-2">
          <div className="h-px bg-gray-300 flex-1" />
          <span className="text-xs text-gray-500">or</span>
          <div className="h-px bg-gray-300 flex-1" />
        </div>

        <button onClick={signInWithGoogle} className="w-full rounded border py-2">
          Continue with Google
        </button>
        
        <div className="text-center">
          <p className="text-sm text-gray-600">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-blue-600 hover:underline">
              Sign up here
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
