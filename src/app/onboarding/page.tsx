'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

// ── Alias generator ──────────────────────────────────────────────────────────
const ADJECTIVES = [
  'silent', 'devoted', 'eager', 'loyal', 'humble', 'willing', 'faithful',
  'ardent', 'grateful', 'steadfast', 'earnest', 'reverent', 'patient',
  'fervent', 'sincere',
]
const NOUNS = [
  'wolf', 'fox', 'hawk', 'bear', 'stag', 'raven', 'lion', 'crane',
  'elk', 'boar', 'hound', 'falcon', 'lynx', 'otter', 'kite',
]
function generateAlias() {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)]
  return `${adj}_${noun}`
}

// ── Handle validation ─────────────────────────────────────────────────────────
const HANDLE_RE = /^[a-z0-9_]{3,30}$/
function validateHandle(h: string): string | null {
  if (!h) return 'Required'
  if (!HANDLE_RE.test(h)) return 'Lowercase letters, numbers and underscores only (3–30 chars)'
  return null
}

// ── Step types ────────────────────────────────────────────────────────────────
type Step =
  | 'email'
  | 'otp'
  | 'role'
  | 'dom-handle'
  | 'dom-profile'
  | 'sub-age'
  | 'sub-alias'

// ── Step indicator ────────────────────────────────────────────────────────────
const SUB_STEPS: Step[] = ['email', 'otp', 'role', 'sub-age', 'sub-alias']
const DOM_STEPS: Step[] = ['email', 'otp', 'role', 'dom-handle', 'dom-profile']

function StepDots({ step, role }: { step: Step; role: 'CREATOR' | 'FAN' | null }) {
  const steps = role === 'CREATOR' ? DOM_STEPS : SUB_STEPS
  const idx = steps.indexOf(step)
  if (idx < 0) return null
  return (
    <div className="flex items-center gap-2 justify-center mb-8">
      {steps.map((s, i) => (
        <div
          key={s}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i < idx ? 'w-4 bg-white' : i === idx ? 'w-6 bg-white' : 'w-4 bg-gray-700'
          }`}
        />
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextParam = searchParams.get('next') ?? ''
  const supabase = createClient()

  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [role, setRole] = useState<'CREATOR' | 'FAN' | null>(null)
  const [profileId, setProfileId] = useState<string | null>(null)
  const [handle, setHandle] = useState('')
  const [handleError, setHandleError] = useState<string | null>(null)
  const [handleAvailable, setHandleAvailable] = useState<boolean | null>(null)
  const [tagline, setTagline] = useState('')
  const [ctaText, setCtaText] = useState('')
  const [alias, setAlias] = useState('')
  const [loading, setLoading] = useState(false)

  // Resume if already authenticated
  useEffect(() => {
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, onboarding_completed, user_type, handle, tribute_alias')
        .eq('auth_user_id', session.user.id)
        .maybeSingle()

      if (profile?.onboarding_completed) {
        window.location.href = nextParam || (profile.user_type === 'CREATOR' ? '/dashboard' : '/home')
        return
      }

      if (profile) {
        setProfileId(profile.id)
        setEmail(session.user.email ?? '')
        if (profile.user_type) {
          setRole(profile.user_type as 'CREATOR' | 'FAN')
          // Resume from correct step
          if (profile.user_type === 'CREATOR') {
            setStep(profile.handle ? 'dom-profile' : 'dom-handle')
          } else {
            setStep(profile.tribute_alias ? 'sub-alias' : 'sub-age')
            if (profile.tribute_alias) setAlias(profile.tribute_alias)
          }
        } else {
          setStep('role')
        }
      } else {
        // Session exists but no profile row — new user who clicked a magic link
        setEmail(session.user.email ?? '')
        setStep('role')
      }
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Step: email ─────────────────────────────────────────────────────────────
  async function sendOtp(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/onboarding`,
      },
    })
    setLoading(false)
    if (error) { toast.error(error.message); return }
    setStep('otp')
  }

  // ── Step: otp ───────────────────────────────────────────────────────────────
  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: otpCode.trim(),
      type: 'email',
    })
    if (error) {
      setLoading(false)
      toast.error('Invalid or expired code. Please try again.')
      return
    }

    const user = data.user!
    // Check for existing profile
    const { data: existing } = await supabase
      .from('profiles')
      .select('id, onboarding_completed, user_type, handle, tribute_alias')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    setLoading(false)

    if (existing?.onboarding_completed) {
      window.location.href = nextParam || (existing.user_type === 'CREATOR' ? '/dashboard' : '/home')
      return
    }

    if (existing) {
      setProfileId(existing.id)
      if (existing.user_type) {
        setRole(existing.user_type as 'CREATOR' | 'FAN')
        if (existing.user_type === 'CREATOR') {
          setStep(existing.handle ? 'dom-profile' : 'dom-handle')
        } else {
          if (existing.tribute_alias) {
            setAlias(existing.tribute_alias)
            setStep('sub-alias')
          } else {
            setStep('sub-age')
          }
        }
      } else {
        setStep('role')
      }
    } else {
      setStep('role')
    }
  }

  // ── Step: role ──────────────────────────────────────────────────────────────
  async function chooseRole(chosen: 'CREATOR' | 'FAN') {
    setLoading(true)
    setRole(chosen)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { toast.error('Session lost — please refresh.'); setLoading(false); return }

    // Create or upsert profile row
    const { data: profile, error } = await supabase
      .from('profiles')
      .upsert(
        { auth_user_id: user.id, email: user.email!, user_type: chosen, onboarding_completed: false },
        { onConflict: 'auth_user_id' }
      )
      .select('id')
      .single()

    setLoading(false)

    if (error || !profile) {
      toast.error('Could not save your account. Please try again.')
      return
    }

    setProfileId(profile.id)
    setStep(chosen === 'CREATOR' ? 'dom-handle' : 'sub-age')
  }

  // ── Handle availability check ────────────────────────────────────────────────
  const checkHandle = useCallback(async (value: string) => {
    const err = validateHandle(value)
    setHandleError(err)
    setHandleAvailable(null)
    if (err) return

    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('handle', value)
      .maybeSingle()

    setHandleAvailable(!data)
  }, [supabase])

  // ── Step: dom-handle ────────────────────────────────────────────────────────
  async function saveHandle(e: React.FormEvent) {
    e.preventDefault()
    if (!profileId || !handleAvailable) return
    setLoading(true)
    const { error } = await supabase
      .from('profiles')
      .update({ handle })
      .eq('id', profileId)
    setLoading(false)
    if (error) { toast.error(error.message); return }
    setStep('dom-profile')
  }

  // ── Step: dom-profile ───────────────────────────────────────────────────────
  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    if (!profileId) return
    setLoading(true)
    const { error } = await supabase
      .from('profiles')
      .update({
        tagline: tagline || null,
        vip_cta_text: ctaText || null,
        onboarding_completed: true,
      })
      .eq('id', profileId)
    setLoading(false)
    if (error) { toast.error(error.message); return }
    window.location.href = '/dashboard'
  }

  // ── Step: sub-age ───────────────────────────────────────────────────────────
  async function runAgeVerify() {
    if (!profileId) return
    setLoading(true)
    try {
      const res = await fetch('/api/age-verify/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, profileId }),
      })
      const data = await res.json()
      if (!data.verified) {
        // TODO: redirect to Yoti fallback when YOTI keys are available
        toast.error('Age verification failed. Please contact support.')
        setLoading(false)
        return
      }
    } catch {
      toast.error('Age verification error. Please try again.')
      setLoading(false)
      return
    }

    // Create wallet in background + generate alias
    const generatedAlias = generateAlias()
    setAlias(generatedAlias)

    await supabase.from('profiles').update({ tribute_alias: generatedAlias }).eq('id', profileId)

    // Fire wallet creation (non-blocking — shows alias immediately)
    fetch('/api/wallet/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileId }),
    }).catch(() => {/* wallet creation can retry later */})

    setLoading(false)
    setStep('sub-alias')
  }

  // ── Step: sub-alias (complete) ──────────────────────────────────────────────
  async function completeSub() {
    if (!profileId) return
    setLoading(true)
    await supabase.from('profiles').update({ onboarding_completed: true }).eq('id', profileId)
    setLoading(false)
    window.location.href = nextParam || '/home'
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6">
      {/* Wordmark */}
      <div className="absolute top-6 left-6">
        <span className="text-white font-bold text-xl tracking-tight">Tribute</span>
      </div>

      <div className="w-full max-w-sm">
        <StepDots step={step} role={role} />

        {/* ── Email ── */}
        {step === 'email' && (
          <form onSubmit={sendOtp} className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold mb-1">Join Tribute</h1>
              <p className="text-gray-400 text-sm">Enter your email to get started.</p>
            </div>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoFocus
              className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-gray-600"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg font-semibold bg-white text-black hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Sending…' : 'Continue'}
            </button>
          </form>
        )}

        {/* ── OTP ── */}
        {step === 'otp' && (
          <form onSubmit={verifyOtp} className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold mb-1">Check your email</h1>
              <p className="text-gray-400 text-sm">
                We sent a 6-digit code to <span className="text-white">{email}</span>.
              </p>
            </div>
            <input
              type="text"
              inputMode="numeric"
              value={otpCode}
              onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              required
              autoFocus
              className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-lg text-white text-center text-2xl tracking-widest placeholder-gray-600 focus:outline-none focus:border-gray-600"
            />
            <button
              type="submit"
              disabled={loading || otpCode.trim().length < 6}
              className="w-full py-3 rounded-lg font-semibold bg-white text-black hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Verifying…' : 'Verify code'}
            </button>
            <button
              type="button"
              onClick={() => { setStep('email'); setOtpCode('') }}
              className="w-full text-sm text-gray-500 hover:text-gray-300"
            >
              Use a different email
            </button>
          </form>
        )}

        {/* ── Role selection ── */}
        {step === 'role' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold mb-1">Who are you?</h1>
              <p className="text-gray-400 text-sm">Choose your role on Tribute.</p>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => chooseRole('CREATOR')}
                disabled={loading}
                className="w-full p-4 rounded-xl border border-gray-800 hover:border-gray-600 text-left transition-colors disabled:opacity-40 group"
              >
                <div className="font-semibold group-hover:text-white">I&apos;m a Dom</div>
                <div className="text-sm text-gray-500 mt-0.5">Create tasks, manage your subs, earn tribute.</div>
              </button>
              <button
                onClick={() => chooseRole('FAN')}
                disabled={loading}
                className="w-full p-4 rounded-xl border border-gray-800 hover:border-gray-600 text-left transition-colors disabled:opacity-40 group"
              >
                <div className="font-semibold group-hover:text-white">I&apos;m a Sub</div>
                <div className="text-sm text-gray-500 mt-0.5">Discover doms, complete tasks, earn your place.</div>
              </button>
            </div>
          </div>
        )}

        {/* ── Dom: handle ── */}
        {step === 'dom-handle' && (
          <form onSubmit={saveHandle} className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold mb-1">Choose your handle</h1>
              <p className="text-gray-400 text-sm">
                Subs will find you at <span className="text-gray-300">tribute.app/[handle]</span>
              </p>
            </div>
            <div className="space-y-2">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">@</span>
                <input
                  type="text"
                  value={handle}
                  onChange={e => {
                    const v = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')
                    setHandle(v)
                    setHandleAvailable(null)
                  }}
                  onBlur={() => handle && checkHandle(handle)}
                  placeholder="your_handle"
                  maxLength={30}
                  autoFocus
                  className="w-full pl-8 pr-4 py-3 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-gray-600"
                />
              </div>
              {handleError && <p className="text-red-400 text-xs">{handleError}</p>}
              {!handleError && handleAvailable === true && (
                <p className="text-green-400 text-xs">✓ Available</p>
              )}
              {!handleError && handleAvailable === false && (
                <p className="text-red-400 text-xs">Already taken — try another</p>
              )}
            </div>
            <button
              type="submit"
              disabled={loading || !handleAvailable}
              className="w-full py-3 rounded-lg font-semibold bg-white text-black hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Saving…' : 'Claim handle'}
            </button>
          </form>
        )}

        {/* ── Dom: profile ── */}
        {step === 'dom-profile' && (
          <form onSubmit={saveProfile} className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold mb-1">Build your profile</h1>
              <p className="text-gray-400 text-sm">Tell subs who you are. You can update this later.</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Tagline</label>
                <input
                  type="text"
                  value={tagline}
                  onChange={e => setTagline(e.target.value)}
                  placeholder="e.g. Your time belongs to me."
                  maxLength={120}
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-gray-600"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">
                  Payment button text
                  <span className="text-gray-600 ml-1">(default: &quot;Submit Tribute&quot;)</span>
                </label>
                <input
                  type="text"
                  value={ctaText}
                  onChange={e => setCtaText(e.target.value)}
                  placeholder="Submit Tribute"
                  maxLength={40}
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-gray-600"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">
                  Banner image
                  <span className="text-gray-600 ml-1">(available after setup)</span>
                </label>
                <div className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-lg text-gray-600 text-sm cursor-not-allowed">
                  Upload via dashboard → Settings
                </div>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg font-semibold bg-white text-black hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Saving…' : 'Complete setup'}
            </button>
          </form>
        )}

        {/* ── Sub: age verify ── */}
        {step === 'sub-age' && (
          <div className="space-y-6 text-center">
            <div>
              <h1 className="text-2xl font-bold mb-1">Age verification</h1>
              <p className="text-gray-400 text-sm">
                Tribute is for adults only. We verify your age before you can make a tribute.
                This is quick and private.
              </p>
            </div>
            <div className="py-6">
              <div className="w-16 h-16 rounded-full bg-gray-900 border border-gray-800 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.955 11.955 0 003 12c0 5.385 3.954 9.849 9.166 10.827.653.112 1.306.112 1.957 0C19.046 21.849 23 17.385 23 12c0-2.28-.638-4.408-1.746-6.221" />
                </svg>
              </div>
              <p className="text-sm text-gray-500">Silent check — no documents needed in most cases.</p>
            </div>
            <button
              onClick={runAgeVerify}
              disabled={loading}
              className="w-full py-3 rounded-lg font-semibold bg-white text-black hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Verifying…' : 'Verify my age'}
            </button>
          </div>
        )}

        {/* ── Sub: alias reveal ── */}
        {step === 'sub-alias' && (
          <div className="space-y-6 text-center">
            <div>
              <h1 className="text-2xl font-bold mb-1">You are ready</h1>
              <p className="text-gray-400 text-sm">Your identity on Tribute:</p>
            </div>
            <div className="py-6">
              <div className="inline-block px-6 py-4 bg-gray-900 border border-gray-700 rounded-2xl">
                <p className="text-3xl font-bold tracking-wide">{alias}</p>
              </div>
              <p className="text-xs text-gray-600 mt-4">You can change this in Settings.</p>
            </div>
            <button
              onClick={completeSub}
              disabled={loading}
              className="w-full py-3 rounded-lg font-semibold bg-white text-black hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Setting up…' : 'Start exploring'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
