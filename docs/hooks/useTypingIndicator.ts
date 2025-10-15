import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface UseTypingIndicatorOptions {
  conversationId: string;
  currentUserId: string;
  enabled?: boolean;
}

interface TypingUser {
  userId: string;
  displayName?: string;
  startedAt: number;
}

interface UseTypingIndicatorReturn {
  typingUsers: TypingUser[];
  startTyping: () => void;
  stopTyping: () => void;
  isUserTyping: (userId: string) => boolean;
}

const TYPING_TIMEOUT = 3000; // 3 seconds
const TYPING_BROADCAST_THROTTLE = 1000; // 1 second

export function useTypingIndicator({
  conversationId,
  currentUserId,
  enabled = true
}: UseTypingIndicatorOptions): UseTypingIndicatorReturn {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingBroadcastRef = useRef<number>(0);
  const isCurrentlyTypingRef = useRef<boolean>(false);
  
  const { supabase } = useAuth();

  // Clean up expired typing indicators
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setTypingUsers(prev => 
        prev.filter(user => now - user.startedAt < TYPING_TIMEOUT)
      );
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Set up realtime channel for typing indicators
  useEffect(() => {
    if (!enabled || !conversationId) {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }

    const channelName = `typing_${conversationId}`;
    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: false }
      }
    });

    channel
      .on('broadcast', { event: 'typing_start' }, (payload) => {
        const { userId, displayName } = payload.payload as { userId: string; displayName?: string };
        
        if (userId !== currentUserId) {
          setTypingUsers(prev => {
            // Remove existing entry for this user and add new one
            const filtered = prev.filter(user => user.userId !== userId);
            return [...filtered, { userId, displayName, startedAt: Date.now() }];
          });
        }
      })
      .on('broadcast', { event: 'typing_stop' }, (payload) => {
        const { userId } = payload.payload as { userId: string };
        
        if (userId !== currentUserId) {
          setTypingUsers(prev => prev.filter(user => user.userId !== userId));
        }
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [supabase, conversationId, currentUserId, enabled]);

  const startTyping = useCallback(() => {
    if (!channelRef.current || !enabled) return;

    const now = Date.now();
    
    // Throttle typing broadcasts to avoid spam
    if (now - lastTypingBroadcastRef.current < TYPING_BROADCAST_THROTTLE) {
      return;
    }

    lastTypingBroadcastRef.current = now;
    isCurrentlyTypingRef.current = true;

    // Broadcast typing start
    channelRef.current.send({
      type: 'broadcast',
      event: 'typing_start',
      payload: {
        userId: currentUserId,
        displayName: 'User' // Could be enhanced with actual display name
      }
    });

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Auto-stop typing after timeout
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, TYPING_TIMEOUT);
  }, [currentUserId, enabled]);

  const stopTyping = useCallback(() => {
    if (!channelRef.current || !enabled || !isCurrentlyTypingRef.current) return;

    isCurrentlyTypingRef.current = false;

    // Clear timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    // Broadcast typing stop
    channelRef.current.send({
      type: 'broadcast',
      event: 'typing_stop',
      payload: {
        userId: currentUserId
      }
    });
  }, [currentUserId, enabled]);

  const isUserTyping = useCallback((userId: string) => {
    return typingUsers.some(user => user.userId === userId);
  }, [typingUsers]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  return {
    typingUsers,
    startTyping,
    stopTyping,
    isUserTyping
  };
}

/**
 * Hook for managing user presence in a conversation
 */
interface UsePresenceOptions {
  conversationId: string;
  currentUserId: string;
  enabled?: boolean;
}

interface PresenceUser {
  userId: string;
  displayName?: string;
  lastSeen: number;
}

interface UsePresenceReturn {
  onlineUsers: PresenceUser[];
  isUserOnline: (userId: string) => boolean;
}

export function usePresence({
  conversationId,
  currentUserId,
  enabled = true
}: UsePresenceOptions): UsePresenceReturn {
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const { supabase } = useAuth();

  useEffect(() => {
    if (!enabled || !conversationId) {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      setOnlineUsers([]);
      return;
    }

    const channelName = `presence_${conversationId}`;
    const channel = supabase.channel(channelName, {
      config: { presence: { key: currentUserId } }
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const presenceState = channel.presenceState();
        const users: PresenceUser[] = [];
        
        Object.entries(presenceState).forEach(([userId, presences]) => {
          if (userId !== currentUserId && presences.length > 0) {
            const presence = presences[0] as any;
            users.push({
              userId,
              displayName: presence.displayName,
              lastSeen: presence.lastSeen || Date.now()
            });
          }
        });
        
        setOnlineUsers(users);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        if (key !== currentUserId) {
          const presence = newPresences[0] as any;
          setOnlineUsers(prev => {
            const filtered = prev.filter(user => user.userId !== key);
            return [...filtered, {
              userId: key,
              displayName: presence.displayName,
              lastSeen: presence.lastSeen || Date.now()
            }];
          });
        }
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        if (key !== currentUserId) {
          setOnlineUsers(prev => prev.filter(user => user.userId !== key));
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Track our presence
          await channel.track({
            userId: currentUserId,
            displayName: 'User', // Could be enhanced with actual display name
            lastSeen: Date.now()
          });

          // Set up heartbeat to maintain presence
          heartbeatIntervalRef.current = setInterval(async () => {
            await channel.track({
              userId: currentUserId,
              displayName: 'User',
              lastSeen: Date.now()
            });
          }, 30000); // Update every 30 seconds
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    };
  }, [supabase, conversationId, currentUserId, enabled]);

  const isUserOnline = useCallback((userId: string) => {
    return onlineUsers.some(user => user.userId === userId);
  }, [onlineUsers]);

  return {
    onlineUsers,
    isUserOnline
  };
}
