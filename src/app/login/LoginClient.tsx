'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const supabase = createClient()
  const router = useRouter()
  const params = useSearchParams()
  const error = params.get('error') ?? ''
  const expired = params.get('expired') === '1'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [sending, setSending] = useState(false)
  const [usePassword, setUsePassword] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    if (usePassword) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      setSending(false)
      if (error) { toast.error(error.message); return }
      router.push('/')
    } else {
      const redirectTo = `${window.location.origin}/auth/callback?next=/`
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      })
      setSending(false)
      if (error) { toast.error(error.message); return }
      toast.success('Magic link sent! Check your email.', { icon: '✨', duration: 5000 })
    }
  }

  async function signInWithGoogle() {
    const redirectTo = `${window.location.origin}/auth/callback?next=/`
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    })
    if (error) toast.error(error.message)
  }

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="w-full max-w-md space-y-6">
        <h1 className="typ-h1 text-slate-900">Sign in</h1>

        {expired && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
            <p className="typ-body-sm text-amber-400">Your session expired. Please sign in again to reconnect.</p>
          </div>
        )}
        {error ? <p className="typ-body-sm text-red-600">Error: {error}</p> : null}

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            className="w-full border rounded p-2"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e)=>setEmail(e.target.value)}
            required
          />
          {usePassword && (
            <input
              className="w-full border rounded p-2"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e)=>setPassword(e.target.value)}
              required
            />
          )}
          <button type="submit" disabled={sending} className="w-full rounded bg-black text-white py-2 typ-ui">
            {sending ? '…' : usePassword ? 'Sign in' : 'Send Magic Link'}
          </button>
          <button type="button" onClick={() => setUsePassword(!usePassword)} className="w-full text-sm text-gray-500 hover:text-gray-700 underline">
            {usePassword ? 'Use magic link instead' : 'Sign in with password instead'}
          </button>
        </form>

        <div className="flex items-center gap-2">
          <div className="h-px bg-gray-300 flex-1" />
          <span className="typ-caption text-gray-500">or</span>
          <div className="h-px bg-gray-300 flex-1" />
        </div>

        <button onClick={signInWithGoogle} className="w-full rounded border py-2 typ-ui flex items-center justify-center gap-3 text-gray-700 hover:bg-gray-50">
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          <span className="text-gray-700">Continue with Google</span>
        </button>
        
        <div className="text-center">
          <p className="typ-body-sm text-gray-600">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-blue-600 hover:underline typ-body-sm">
              Sign up here
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
