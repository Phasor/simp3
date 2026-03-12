'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import toast from 'react-hot-toast'

interface VipTier {
  id: string
  tier_type: 'GROUP' | 'PRIVATE'
  threshold_type: 'TOP_PERCENT' | 'TOP_N'
  threshold_value: number
}

function supabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export default function DashboardSettingsPage() {
  const router = useRouter()
  const sb = supabase()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [recalculating, setRecalculating] = useState(false)

  // VIP (GROUP) tier
  const [groupEnabled, setGroupEnabled] = useState(false)
  const [groupThresholdType, setGroupThresholdType] = useState<'TOP_PERCENT' | 'TOP_N'>('TOP_PERCENT')
  const [groupValue, setGroupValue] = useState('')

  // VVIP (PRIVATE) tier
  const [privateEnabled, setPrivateEnabled] = useState(false)
  const [privateValue, setPrivateValue] = useState('')

  // Profile fields
  const [displayName, setDisplayName] = useState('')
  const [tagline, setTagline] = useState('')
  const [ctaText, setCtaText] = useState('')

  // Preview: live sub counts
  const [subCount, setSubCount] = useState<number | null>(null)

  const fetchData = useCallback(async () => {
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: profile } = await sb
      .from('profiles')
      .select('id, user_type, display_name, tagline, vip_cta_text')
      .eq('auth_user_id', user.id)
      .single()

    if (!profile || profile.user_type !== 'CREATOR') { router.push('/'); return }

    setDisplayName(profile.display_name ?? '')
    setTagline(profile.tagline ?? '')
    setCtaText(profile.vip_cta_text ?? '')

    const [{ data: tiers }, { count }] = await Promise.all([
      sb.from('vip_tiers').select('*').eq('dom_id', profile.id),
      sb.from('tribute_scores')
        .select('fan_id', { count: 'exact', head: true })
        .eq('dom_id', profile.id),
    ])

    setSubCount(count ?? 0)

    for (const t of tiers ?? []) {
      if (t.tier_type === 'GROUP') {
        setGroupEnabled(true)
        setGroupThresholdType(t.threshold_type)
        setGroupValue(String(t.threshold_value))
      }
      if (t.tier_type === 'PRIVATE') {
        setPrivateEnabled(true)
        setPrivateValue(String(t.threshold_value))
      }
    }

    setLoading(false)
  }, [sb, router])

  useEffect(() => { fetchData() }, [fetchData])

  async function saveTier(tierType: 'GROUP' | 'PRIVATE', thresholdType: 'TOP_PERCENT' | 'TOP_N', value: string) {
    const num = parseFloat(value)
    if (isNaN(num) || num <= 0) { toast.error('Enter a valid number'); return false }
    const res = await fetch('/api/vip/tiers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier_type: tierType, threshold_type: thresholdType, threshold_value: num }),
    })
    return res.ok
  }

  async function handleSave() {
    setSaving(true)
    try {
      const { data: { user } } = await sb.auth.getUser()
      if (!user) return

      const { data: profile } = await sb
        .from('profiles')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()
      if (!profile) return

      // Save profile fields
      await sb.from('profiles').update({
        display_name: displayName || null,
        tagline: tagline || null,
        vip_cta_text: ctaText || null,
      }).eq('id', profile.id)

      // Save tiers
      const results = await Promise.all([
        groupEnabled ? saveTier('GROUP', groupThresholdType, groupValue) : Promise.resolve(true),
        privateEnabled ? saveTier('PRIVATE', 'TOP_N', privateValue) : Promise.resolve(true),
      ])

      if (results.every(Boolean)) {
        toast.success('Settings saved')
      } else {
        toast.error('Some settings failed to save')
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleRecalculate() {
    setRecalculating(true)
    try {
      const res = await fetch('/api/vip/recalculate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      const data = await res.json()
      if (res.ok) toast.success('VIP access recalculated')
      else toast.error(data.error ?? 'Recalculation failed')
    } finally {
      setRecalculating(false)
    }
  }

  // Preview calculation
  function groupPreview() {
    if (!groupEnabled || !groupValue || subCount === null) return null
    const v = parseFloat(groupValue)
    if (isNaN(v)) return null
    if (groupThresholdType === 'TOP_PERCENT') return Math.max(1, Math.floor(subCount * v / 100))
    return Math.min(Math.floor(v), subCount)
  }
  function privatePreview() {
    if (!privateEnabled || !privateValue || subCount === null) return null
    const v = parseInt(privateValue)
    if (isNaN(v)) return null
    return Math.min(v, subCount)
  }

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-black text-white pb-12">
      <div className="max-w-lg mx-auto px-4 pt-6 space-y-8">
        <h1 className="text-xl font-semibold">Settings</h1>

        {/* ── Profile ── */}
        <Section title="Profile">
          <Field label="Display name">
            <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
              maxLength={60} placeholder="Your display name"
              className="w-full px-3 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:border-gray-600" />
          </Field>
          <Field label="Tagline">
            <input type="text" value={tagline} onChange={e => setTagline(e.target.value)}
              maxLength={120} placeholder="One line that says what you are"
              className="w-full px-3 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:border-gray-600" />
          </Field>
          <Field label="Submit button text" hint="Shown on the Send Moment screen">
            <input type="text" value={ctaText} onChange={e => setCtaText(e.target.value)}
              maxLength={40} placeholder="Submit Tribute"
              className="w-full px-3 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:border-gray-600" />
          </Field>
        </Section>

        {/* ── VIP Chat Tiers ── */}
        <Section title="VIP access tiers">
          <p className="text-xs text-gray-500 -mt-1 mb-2">
            {subCount !== null ? `${subCount} subs in your Tribute Score table this month.` : ''}
          </p>

          {/* GROUP tier */}
          <div className="space-y-3 pb-4 border-b border-gray-900">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white">VIP Group channel</p>
                <p className="text-xs text-gray-500">Subs who qualify get access to your group channel</p>
              </div>
              <Toggle enabled={groupEnabled} onChange={setGroupEnabled} />
            </div>

            {groupEnabled && (
              <div className="space-y-3 pl-1">
                <div className="flex gap-2">
                  {(['TOP_PERCENT', 'TOP_N'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setGroupThresholdType(t)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        groupThresholdType === t ? 'bg-white text-black' : 'bg-gray-900 border border-gray-800 text-gray-400 hover:border-gray-600'
                      }`}
                    >
                      {t === 'TOP_PERCENT' ? 'Top %' : 'Top N'}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={groupValue}
                    onChange={e => setGroupValue(e.target.value)}
                    min={1}
                    max={groupThresholdType === 'TOP_PERCENT' ? 100 : 10000}
                    placeholder={groupThresholdType === 'TOP_PERCENT' ? 'e.g. 20' : 'e.g. 50'}
                    className="w-28 px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white text-sm focus:outline-none focus:border-gray-600"
                  />
                  <span className="text-sm text-gray-400">
                    {groupThresholdType === 'TOP_PERCENT' ? '% of subs' : 'subs'}
                  </span>
                </div>
                {groupPreview() !== null && (
                  <p className="text-xs text-gray-500">
                    Currently qualifies: ~{groupPreview()} sub{groupPreview() !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* PRIVATE (VVIP) tier */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white">VVIP private DMs</p>
                <p className="text-xs text-gray-500">Top N subs get 1-to-1 chat access</p>
              </div>
              <Toggle enabled={privateEnabled} onChange={setPrivateEnabled} />
            </div>

            {privateEnabled && (
              <div className="space-y-2 pl-1">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={privateValue}
                    onChange={e => setPrivateValue(e.target.value)}
                    min={1}
                    max={100}
                    placeholder="e.g. 3"
                    className="w-28 px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white text-sm focus:outline-none focus:border-gray-600"
                  />
                  <span className="text-sm text-gray-400">subs (top N only)</span>
                </div>
                {privatePreview() !== null && (
                  <p className="text-xs text-gray-500">
                    Currently qualifies: ~{privatePreview()} sub{privatePreview() !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Recalculate button */}
          <button
            onClick={handleRecalculate}
            disabled={recalculating}
            className="mt-4 w-full py-2.5 rounded-xl border border-gray-800 text-gray-400 text-sm hover:border-gray-600 hover:text-white disabled:opacity-50 transition-colors"
          >
            {recalculating ? 'Recalculating…' : 'Recalculate VIP access now'}
          </button>
          <p className="text-xs text-gray-600">Access recalculates automatically on the 1st of each month.</p>
        </Section>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-4 rounded-2xl bg-white text-black font-bold text-sm hover:bg-gray-100 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : 'Save settings'}
        </button>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400">{title}</h2>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1.5">
        {label}
        {hint && <span className="text-gray-600 ml-1">— {hint}</span>}
      </label>
      {children}
    </div>
  )
}

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={`relative w-10 h-6 rounded-full transition-colors ${enabled ? 'bg-white' : 'bg-gray-800'}`}
    >
      <span className={`absolute top-1 w-4 h-4 rounded-full bg-black transition-transform ${enabled ? 'translate-x-5' : 'translate-x-1'}`} />
    </button>
  )
}
