'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/contexts/AuthContext'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { getBunnyStorageUrl } from '@/lib/utils/bunnynet'

interface VipTier {
  id: string
  tier_type: 'GROUP' | 'PRIVATE'
  threshold_type: 'TOP_PERCENT' | 'TOP_N'
  threshold_value: number
}

export default function DashboardSettingsPage() {
  const { profile, refreshProfile } = useAuth()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // VIP (GROUP) tier
  const [groupEnabled, setGroupEnabled] = useState(false)
  const [groupThresholdType, setGroupThresholdType] = useState<'TOP_PERCENT' | 'TOP_N'>('TOP_PERCENT')
  const [groupValue, setGroupValue] = useState('')
  const [groupMinSpend, setGroupMinSpend] = useState('')
  const [groupQualifying, setGroupQualifying] = useState<number | null>(null)

  // VVIP (PRIVATE) tier
  const [privateEnabled, setPrivateEnabled] = useState(false)
  const [privateValue, setPrivateValue] = useState('')
  const [privateQualifying, setPrivateQualifying] = useState<number | null>(null)
  const [privateMinSpend, setPrivateMinSpend] = useState('')

  // Profile fields
  const [displayName, setDisplayName] = useState('')
  const [tagline, setTagline] = useState('')
  const [bio, setBio] = useState('')
  const [ctaText, setCtaText] = useState('')
  const [walletAddress, setWalletAddress] = useState('')
  const [bannerUrl, setBannerUrl] = useState<string | null>(null)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)


  // Fetch all settings data from API (single source of truth)
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/settings', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()

      // Populate profile fields from server
      if (data.profile) {
        setDisplayName(data.profile.display_name ?? '')
        setTagline(data.profile.tagline ?? '')
        setBio(data.profile.about_text ?? '')
        setCtaText(data.profile.vip_cta_text ?? '')
        setWalletAddress(data.profile.wallet_address ?? '')
        setBannerUrl(data.profile.banner_image_url ?? null)
        setAvatarUrl(data.profile.profile_picture_url ?? null)
      }

      const qc = data.qualifyingCounts ?? {}
      for (const t of data.tiers ?? []) {
        if (t.tier_type === 'GROUP') {
          setGroupEnabled(true)
          setGroupThresholdType(t.threshold_type)
          setGroupValue(String(t.threshold_value))
          setGroupMinSpend(t.min_spend_usdc ? String(t.min_spend_usdc) : '')
          setGroupQualifying(qc.GROUP ?? 0)
        }
        if (t.tier_type === 'PRIVATE') {
          setPrivateEnabled(true)
          setPrivateValue(String(t.threshold_value))
          setPrivateMinSpend(t.min_spend_usdc ? String(t.min_spend_usdc) : '')
          setPrivateQualifying(qc.PRIVATE ?? 0)
        }
      }
    } catch (err) {
      console.error('Settings fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function saveTier(tierType: 'GROUP' | 'PRIVATE', thresholdType: 'TOP_PERCENT' | 'TOP_N', value: string, minSpend: string) {
    const num = parseFloat(value)
    if (isNaN(num) || num <= 0) { toast.error('Enter a valid number'); return false }
    const minSpendNum = minSpend ? parseFloat(minSpend) : 0
    if (isNaN(minSpendNum) || minSpendNum < 0) { toast.error('Min spend must be 0 or more'); return false }
    const res = await fetch('/api/vip/tiers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier_type: tierType, threshold_type: thresholdType, threshold_value: num, min_spend_usdc: minSpendNum }),
    })
    return res.ok
  }

  async function handleBannerUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingBanner(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/upload/banner-image', { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Upload failed'); return }
      setBannerUrl(json.url)
      toast.success('Banner updated')
    } finally {
      setUploadingBanner(false)
      e.target.value = ''
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/upload/profile-picture', { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Upload failed'); return }
      const url = json.url
      setAvatarUrl(url)
      // Save to DB immediately
      if (profile) {
        await createClient().from('profiles').update({ profile_picture_url: url }).eq('id', profile.id)
      }
      toast.success('Avatar updated')
    } finally {
      setUploadingAvatar(false)
      e.target.value = ''
    }
  }

  async function handleSave() {
    if (!profile) return
    setSaving(true)
    try {
      // Validate wallet address if provided
      if (walletAddress && !/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) {
        toast.error('Payout wallet must be a valid Ethereum address (0x…)')
        return
      }

      // Save profile fields via API route (server-side Supabase)
      const res = await fetch('/api/dashboard/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: displayName,
          tagline,
          about_text: bio,
          vip_cta_text: ctaText,
          wallet_address: walletAddress,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error ?? 'Failed to save profile')
        return
      }

      // Save tiers
      const results = await Promise.all([
        groupEnabled ? saveTier('GROUP', groupThresholdType, groupValue, groupMinSpend) : Promise.resolve(true),
        privateEnabled ? saveTier('PRIVATE', 'TOP_N', privateValue, privateMinSpend) : Promise.resolve(true),
      ])

      if (results.every(Boolean)) {
        refreshProfile().catch(() => {})
        // Recalculate VIP access with new tier settings, then refresh counts
        if (groupEnabled || privateEnabled) {
          await fetch('/api/vip/recalculate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{}',
          }).catch(() => {})
        }
        fetchData()
        toast.success('Settings saved')
      } else {
        toast.error('Some settings failed to save')
      }
    } catch (err) {
      console.error('Settings save error:', err)
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }



  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="h-full flex flex-col bg-black text-white">
      <div className="flex-1 overflow-y-auto">
      <div className="max-w-lg mx-auto px-4 pt-6 space-y-8 pb-6">
        <h1 className="text-xl font-semibold">Settings</h1>

        {/* ── Profile ── */}
        <Section title="Profile">
          <Field label="Avatar">
            <label className={`relative w-16 h-16 rounded-full block cursor-pointer group ${uploadingAvatar ? 'pointer-events-none' : ''}`}>
              <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-800 border border-gray-700 flex items-center justify-center">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={getBunnyStorageUrl(avatarUrl)} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl text-gray-600">👤</span>
                )}
              </div>
              {/* Pencil overlay */}
              <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                {uploadingAvatar
                  ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  : <PencilIcon />}
              </div>
              <input type="file" accept="image/*" className="sr-only" onChange={handleAvatarUpload} disabled={uploadingAvatar} />
            </label>
          </Field>
          <Field label="Banner image">
            <label className={`relative block rounded-lg overflow-hidden cursor-pointer group ${uploadingBanner ? 'pointer-events-none' : ''}`}>
              {bannerUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={getBunnyStorageUrl(bannerUrl!)} alt="Banner" className="w-full h-24 object-cover" />
              ) : (
                <div className="w-full h-24 bg-gray-900 border border-gray-800 rounded-lg flex items-center justify-center text-gray-600 text-sm">
                  No banner — click to upload
                </div>
              )}
              {/* Pencil overlay */}
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                {uploadingBanner
                  ? <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  : <PencilIcon />}
              </div>
              <input type="file" accept="image/*" className="sr-only" onChange={handleBannerUpload} disabled={uploadingBanner} />
            </label>
            <p className="text-xs text-gray-600 mt-1">1500 × 500 px · max 10 MB</p>
          </Field>
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
          <Field label="About" hint="Shown on your public profile under your name">
            <textarea value={bio} onChange={e => setBio(e.target.value)}
              maxLength={1000} rows={5} placeholder="Tell subs about yourself..."
              className="w-full px-3 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:border-gray-600 resize-none" />
            <p className="text-xs text-gray-600 mt-1 text-right">{bio.length}/1000</p>
          </Field>
          <Field label="Submit button text" hint="Shown on the Send Moment screen">
            <input type="text" value={ctaText} onChange={e => setCtaText(e.target.value)}
              maxLength={40} placeholder="Submit Tribute"
              className="w-full px-3 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:border-gray-600" />
          </Field>
        </Section>

        {/* ── Payout wallet ── */}
        <Section title="Payout wallet">
          <p className="text-xs text-gray-500 -mt-1">
            USDC payments from subs are sent directly to this address on Base. Required before subs can pay you.
          </p>
          <Field label="Wallet address (Base / Ethereum)">
            <input
              type="text"
              value={walletAddress}
              onChange={e => setWalletAddress(e.target.value.trim())}
              placeholder="0x…"
              maxLength={42}
              spellCheck={false}
              className="w-full px-3 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-white text-sm font-mono placeholder-gray-600 focus:outline-none focus:border-gray-600"
            />
          </Field>
          {walletAddress && !/^0x[0-9a-fA-F]{40}$/.test(walletAddress) && (
            <p className="text-xs text-red-400">Must be a valid 0x Ethereum address</p>
          )}
        </Section>

        {/* ── VIP Chat Tiers ── */}
        <Section title="VIP access tiers">
          <p className="text-xs text-gray-500 -mt-1 mb-2">
            Subs must meet both the minimum spend and ranking filter (rolling 30 days).
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
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Minimum spend (USDC, last 30 days)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={groupMinSpend}
                      onChange={e => setGroupMinSpend(e.target.value)}
                      min={0}
                      step="0.01"
                      placeholder="e.g. 50"
                      className="w-28 px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white text-sm focus:outline-none focus:border-gray-600"
                    />
                    <span className="text-sm text-gray-400">USDC</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Ranking filter</label>
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
                {groupQualifying !== null && (
                  <p className="text-xs text-gray-500">
                    {groupQualifying} sub{groupQualifying !== 1 ? 's' : ''} currently qualify — recalculates on save
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
              <div className="space-y-3 pl-1">
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Minimum spend (USDC, last 30 days)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={privateMinSpend}
                      onChange={e => setPrivateMinSpend(e.target.value)}
                      min={0}
                      step="0.01"
                      placeholder="e.g. 100"
                      className="w-28 px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white text-sm focus:outline-none focus:border-gray-600"
                    />
                    <span className="text-sm text-gray-400">USDC</span>
                  </div>
                </div>
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
                {privateQualifying !== null && (
                  <p className="text-xs text-gray-500">
                    {privateQualifying} sub{privateQualifying !== 1 ? 's' : ''} currently qualify — recalculates on save
                  </p>
                )}
              </div>
            )}
          </div>

          <p className="text-xs text-gray-600 mt-2">VIP access recalculates on save and daily based on rolling 30-day activity.</p>
        </Section>

      </div>
      </div>

      {/* Save — pinned to bottom of this flex column */}
      <div className="shrink-0 border-t border-gray-900 bg-black px-4 py-3">
        <div className="max-w-lg mx-auto">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3.5 rounded-2xl bg-white text-black font-bold text-sm hover:bg-gray-100 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </div>
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

function PencilIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
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
