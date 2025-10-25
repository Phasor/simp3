'use client';
import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

const CACHE_KEY = 'chat:inbox:conversations-cache';

export function useWarmChatInbox(userId?: string) {
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    (async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('conversations')
          .select(`*,
            creator:profiles!conversations_creator_id_fkey(*),
            fan:profiles!conversations_fan_id_fkey(*)
          `)
          .or(`creator_id.eq.${userId},fan_id.eq.${userId}`)
          .order('created_at', { ascending: false })
          .limit(50);

        if (cancelled || error || !data) return;
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ userId, items: data }));
      } catch {
        // best-effort warmup; ignore
      }
    })();

    return () => { cancelled = true; };
  }, [userId]);
}

