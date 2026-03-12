import { useEffect, useRef, useState, useCallback } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { useAuth } from '@/lib/contexts/AuthContext'

export interface VipMessage {
  id: string
  dom_id: string
  sender_id: string
  content: string
  created_at: string
  sender_alias?: string | null  // tribute_alias or display_name, resolved client-side
}

interface UseVipGroupChatOptions {
  domId: string
  onNewMessage?: (msg: VipMessage) => void
}

interface UseVipGroupChatReturn {
  connected: boolean
  sendMessage: (content: string) => Promise<{ error?: string }>
}

export function useVipGroupChat({ domId, onNewMessage }: UseVipGroupChatOptions): UseVipGroupChatReturn {
  const { supabase, profile } = useAuth()
  const [connected, setConnected] = useState(false)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const onNewMessageRef = useRef(onNewMessage)
  useEffect(() => { onNewMessageRef.current = onNewMessage }, [onNewMessage])

  useEffect(() => {
    if (!domId || !profile) return

    const channel = supabase
      .channel(`vip-group-${domId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'vip_messages', filter: `dom_id=eq.${domId}` },
        (payload) => {
          const msg = payload.new as VipMessage
          onNewMessageRef.current?.(msg)
        }
      )
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED')
      })

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
      setConnected(false)
    }
  }, [domId, profile, supabase])

  const sendMessage = useCallback(async (content: string) => {
    if (!profile) return { error: 'Not authenticated' }
    const { error } = await supabase
      .from('vip_messages')
      .insert({ dom_id: domId, sender_id: profile.id, content })
    return error ? { error: error.message } : {}
  }, [supabase, domId, profile])

  return { connected, sendMessage }
}
