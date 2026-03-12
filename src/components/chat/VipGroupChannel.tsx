'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useVipGroupChat, type VipMessage } from '@/lib/hooks/useVipGroupChat'
import toast from 'react-hot-toast'

interface DomInfo {
  id: string
  display_name: string | null
  handle: string | null
  profile_picture_url: string | null
}

interface Props {
  dom: DomInfo
}

function supabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export default function VipGroupChannel({ dom }: Props) {
  const { profile } = useAuth()
  const sb = supabase()
  const [messages, setMessages] = useState<VipMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const isDom = profile?.user_type === 'CREATOR'

  // Alias cache: senderId → display string
  const aliasCache = useRef<Record<string, string>>({})

  async function resolveAlias(senderId: string): Promise<string> {
    if (aliasCache.current[senderId]) return aliasCache.current[senderId]
    const { data } = await sb
      .from('profiles')
      .select('tribute_alias, display_name, user_type')
      .eq('id', senderId)
      .single()
    const alias = data?.user_type === 'CREATOR'
      ? (data.display_name ?? dom.handle ?? 'Dom')
      : (data?.tribute_alias ?? data?.display_name ?? 'Sub')
    aliasCache.current[senderId] = alias
    return alias
  }

  // Load history
  useEffect(() => {
    async function load() {
      const { data } = await sb
        .from('vip_messages')
        .select('id, dom_id, sender_id, content, created_at')
        .eq('dom_id', dom.id)
        .order('created_at', { ascending: true })
        .limit(100)

      if (data) {
        const withAliases = await Promise.all(
          data.map(async m => ({ ...m, sender_alias: await resolveAlias(m.sender_id) }))
        )
        setMessages(withAliases)
      }
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dom.id])

  const handleNewMessage = useCallback(async (msg: VipMessage) => {
    const alias = await resolveAlias(msg.sender_id)
    setMessages(prev => {
      // Deduplicate
      if (prev.some(m => m.id === msg.id)) return prev
      return [...prev, { ...msg, sender_alias: alias }]
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const { connected, sendMessage } = useVipGroupChat({ domId: dom.id, onNewMessage: handleNewMessage })

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    const content = input.trim()
    if (!content || sending) return
    setSending(true)
    setInput('')
    try {
      const { error } = await sendMessage(content)
      if (error) { toast.error(error); setInput(content) }
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const domName = dom.display_name ?? dom.handle ?? 'Dom'

  return (
    <div className="flex flex-col h-full bg-black">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-900">
        <div className="relative">
          {dom.profile_picture_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={dom.profile_picture_url} alt={domName} className="w-9 h-9 rounded-full object-cover" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center text-sm font-bold text-gray-400">
              {domName[0].toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{domName}&apos;s VIP Channel</p>
          <p className="text-xs text-gray-500">
            {connected ? 'Live' : 'Connecting…'}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-gray-600 text-sm">No messages yet.</p>
            <p className="text-gray-700 text-xs mt-1">Be the first to say something.</p>
          </div>
        ) : (
          messages.map(msg => {
            const isMe = msg.sender_id === profile?.id
            const isDomMsg = msg.sender_id === dom.id
            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <span className={`text-xs mb-1 ${isDomMsg ? 'text-white font-semibold' : 'text-gray-500'}`}>
                  {isDomMsg ? `👑 ${msg.sender_alias}` : msg.sender_alias}
                </span>
                <div className={`max-w-xs sm:max-w-md px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  isMe
                    ? 'bg-white text-black rounded-br-sm'
                    : isDomMsg
                      ? 'bg-gray-800 text-white border border-gray-700 rounded-bl-sm'
                      : 'bg-gray-900 text-gray-200 rounded-bl-sm'
                }`}>
                  {msg.content}
                </div>
                <span className="text-xs text-gray-700 mt-1">
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-900">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isDom ? 'Send a message to your VIPs…' : `Message ${domName}'s VIP channel…`}
            rows={1}
            maxLength={1000}
            className="flex-1 px-4 py-3 bg-gray-950 border border-gray-800 rounded-2xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-gray-600 resize-none max-h-32"
            style={{ overflowY: input.split('\n').length > 3 ? 'auto' : 'hidden' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center disabled:opacity-40 hover:bg-gray-100 transition-colors shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
