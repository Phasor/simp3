import { useEffect, useRef, useState, useCallback } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Tables } from '@simp2/shared';
import type { ChatAccessStatus } from '@/lib/chatAccess';
import { useAuth } from '@/contexts/AuthContext';

type ChatMessage = Tables<'chat_messages'>;

interface UseRealtimeChatOptions {
  creatorId: string;
  fanId: string;
  currentUserId: string;
  accessStatus: ChatAccessStatus | null;
  conversationId?: string; // Optional: if provided, use this instead of generating from IDs
  usePostgresChanges?: boolean; // Optional: use postgres_changes instead of broadcast
  onNewMessage?: (message: ChatMessage) => void;
  onConnectionChange?: (connected: boolean) => void;
  onAccessExpired?: () => void;
}

interface UseRealtimeChatReturn {
  connected: boolean;
  error: string | null;
  reconnect: () => void;
}

export function useRealtimeChat({
  creatorId,
  fanId,
  currentUserId,
  accessStatus,
  conversationId,
  usePostgresChanges = true,
  onNewMessage,
  onConnectionChange,
  onAccessExpired
}: UseRealtimeChatOptions): UseRealtimeChatReturn {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reconnectNonce, setReconnectNonce] = useState(0);
  
  // Use refs to store channel and callbacks to prevent unnecessary effect re-runs
  const channelRef = useRef<RealtimeChannel | null>(null);
  const onNewMessageRef = useRef(onNewMessage);
  const onConnectionChangeRef = useRef(onConnectionChange);
  const onAccessExpiredRef = useRef(onAccessExpired);
  
  // Connection stability tracking
  const retryCountRef = useRef(0);
  const lastConnectAttemptRef = useRef<number>(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCleanupRef = useRef(false);
  
  // Keep latest handlers without re-subscribing
  useEffect(() => { onNewMessageRef.current = onNewMessage; }, [onNewMessage]);
  useEffect(() => { onConnectionChangeRef.current = onConnectionChange; }, [onConnectionChange]);
  useEffect(() => { onAccessExpiredRef.current = onAccessExpired; }, [onAccessExpired]);
  
  // Track access expired notifications to prevent spam
  const accessExpiredNotifiedRef = useRef(false);
  
  // Use shared Supabase client from AuthContext to prevent multiple auth listeners
  const { supabase } = useAuth();

  // Cleanup function
  const cleanup = useCallback(() => {
    isCleanupRef.current = true;
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (channelRef.current) {
      if (process.env.NEXT_PUBLIC_DEBUG === '1') {
        console.log('🧹 Cleaning up chat channel');
      }
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    
    setConnected(false);
    setError(null);
  }, [supabase]);

  // Improved retry logic with exponential backoff
  const scheduleReconnect = useCallback((reason: string) => {
    if (isCleanupRef.current) return;
    
    // Don't retry if access is lost
    if (!accessStatus?.hasAccess) {
      if (!accessExpiredNotifiedRef.current) {
        console.log('🚫 Not retrying - access lost');
        onAccessExpiredRef.current?.();
        accessExpiredNotifiedRef.current = true;
      }
      return;
    } else {
      accessExpiredNotifiedRef.current = false;
    }
    
    retryCountRef.current++;
    
    // Retry indefinitely with capped delay for long-lived tabs
    const delay = Math.min(1000 * 2 ** Math.min(retryCountRef.current, 10), 30000); // max 30s
    const jitter = Math.random() * 1000; // Add jitter to prevent thundering herd
    const totalDelay = delay + jitter;
    
    if (process.env.NEXT_PUBLIC_DEBUG === '1') {
      console.log(`🔄 Scheduling reconnect attempt ${retryCountRef.current} in ${Math.round(totalDelay)}ms (reason: ${reason})`);
    }
    
    // Avoid stacking multiple reconnect timers
    if (reconnectTimeoutRef.current) return;
    reconnectTimeoutRef.current = setTimeout(() => {
      if (!isCleanupRef.current) {
        setReconnectNonce(prev => prev + 1);
      }
      reconnectTimeoutRef.current = null;
    }, totalDelay);
  }, [accessStatus?.hasAccess]);

  // Set up realtime subscription with improved stability
  useEffect(() => {
    isCleanupRef.current = false;
    
    if (!accessStatus?.hasAccess) {
      cleanup();
      return;
    }

    // Prevent too frequent connection attempts
    const now = Date.now();
    const timeSinceLastAttempt = now - lastConnectAttemptRef.current;
    if (timeSinceLastAttempt < 1000) {
      const wait = 1000 - timeSinceLastAttempt;
      if (!reconnectTimeoutRef.current && !connected && !channelRef.current) {
        if (process.env.NEXT_PUBLIC_DEBUG === '1') {
          console.log('⏳ Throttling connection attempt, scheduling delayed reconnect');
        }
        reconnectTimeoutRef.current = setTimeout(() => {
          setReconnectNonce(prev => prev + 1);
          reconnectTimeoutRef.current = null;
        }, wait);
      }
      return () => {}; // keep existing channel alive (don't tear it down here)
    }
    lastConnectAttemptRef.current = now;

    // Async function to handle conversation_id lookup and connection
    const setupConnection = async () => {
      // Use supplied conversationId when present; otherwise fall back to sorted IDs
      const effectiveConversationId =
        conversationId ?? [creatorId, fanId].sort().join('_');
      
      // Check if cleanup was called while we were fetching
      if (isCleanupRef.current) return;
      
      const channelName = `chat_${effectiveConversationId}`;
      console.log('🔗 Client connecting to channel:', channelName, 'for users:', { creatorId, fanId });
      console.log(`🔗 Connecting to channel: ${channelName}`);
      
      // Clean up any stale channel before creating a new one
      if (channelRef.current && !connected) {
        try { 
          supabase.removeChannel(channelRef.current); 
        } catch {}
        channelRef.current = null;
      }
      
      const newChannel = supabase.channel(channelName, {
        config: {
          broadcast: { self: false }, // Don't receive our own broadcasts
          presence: { key: currentUserId }
        }
      });

      if (usePostgresChanges) {
        // Use postgres_changes for durable message streaming
        console.log('🔗 Setting up postgres_changes subscription:', {
          table: 'chat_messages',
          filter: `creator_id=eq.${creatorId}`,
          creatorId,
          fanId
        });
        
        newChannel
          .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_messages',
            filter: `creator_id=eq.${creatorId}`
          }, (payload) => {
            console.log('📨 Postgres_changes event received:', {
              event: payload.eventType,
              table: payload.table,
              new: payload.new,
              old: payload.old
            });
            
            const newMessage = payload.new as ChatMessage;
            
            // Only handle messages for this conversation (creator_id + fan_id match)
            if (newMessage.creator_id === creatorId && newMessage.fan_id === fanId) {
              // Only handle messages from other users to avoid duplicates
              if (newMessage.sender_id !== currentUserId) {
                console.log('✅ Delivering message to UI:', newMessage.id);
                onNewMessageRef.current?.(newMessage);
              } else {
                console.log('🚫 Ignoring own message:', newMessage.id);
              }
            } else {
              console.log('🚫 Ignoring message for different conversation:', {
                messageCreatorId: newMessage.creator_id,
                messageFanId: newMessage.fan_id,
                expectedCreatorId: creatorId,
                expectedFanId: fanId
              });
            }
          });
      } else {
        // Use broadcast for ephemeral message streaming (existing behavior)
        newChannel
          .on('broadcast', { event: 'new_message' }, (payload) => {
            if (process.env.NEXT_PUBLIC_DEBUG === '1') {
              console.log('📡 Received broadcast:', payload);
            }
            if (payload.payload && typeof payload.payload === 'object') {
              const newMessage = payload.payload as ChatMessage;
              if (process.env.NEXT_PUBLIC_DEBUG === '1') {
                console.log('📨 Message:', { 
                  id: newMessage.id, 
                  sender_id: newMessage.sender_id
                });
              }
              
              // Only handle messages from other users to avoid duplicates
              if (newMessage.sender_id !== currentUserId) {
                if (process.env.NEXT_PUBLIC_DEBUG === '1') {
                  console.log('✅ Delivering message to UI');
                }
                onNewMessageRef.current?.(newMessage);
              } else {
                if (process.env.NEXT_PUBLIC_DEBUG === '1') {
                  console.log('🚫 Ignoring own message');
                }
              }
            }
          });
      }

      newChannel.subscribe(async (status) => {
          if (isCleanupRef.current) return;
          
          if (process.env.NEXT_PUBLIC_DEBUG === '1') {
            console.log(`📡 Channel status: ${status}`);
          }
          
          if (status === 'SUBSCRIBED') {
            console.log('✅ Realtime chat connected successfully');
            setConnected(true);
            setError(null);
            retryCountRef.current = 0; // Reset retry count on successful connection
            onConnectionChangeRef.current?.(true);
          } else if (status === 'CHANNEL_ERROR') {
            console.log('❌ Channel error occurred');
            setConnected(false);
            setError('Channel error');
            onConnectionChangeRef.current?.(false);
            scheduleReconnect('CHANNEL_ERROR');
          } else if (status === 'TIMED_OUT') {
            console.log('⏰ Connection timed out');
            setConnected(false);
            setError('Connection timeout');
            onConnectionChangeRef.current?.(false);
            scheduleReconnect('TIMED_OUT');
          } else if (status === 'CLOSED') {
            console.log('🔒 Connection closed');
            setConnected(false);
            setError('Connection closed');
            onConnectionChangeRef.current?.(false);
            
            // Only retry if not intentionally closed
            if (!isCleanupRef.current) {
              scheduleReconnect('CLOSED');
            }
          }
        });

      channelRef.current = newChannel;
    };

    // Call the async setup function
    setupConnection();

    return cleanup;
  }, [creatorId, fanId, currentUserId, accessStatus?.hasAccess, supabase, reconnectNonce, conversationId, usePostgresChanges, cleanup, scheduleReconnect]);

  const reconnect = useCallback(() => {
    if (process.env.NEXT_PUBLIC_DEBUG === '1') {
      console.log('🔄 Manual reconnect requested');
    }
    
    // Clear any pending reconnect attempts
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    // Reset retry count for manual reconnect
    retryCountRef.current = 0;
    
    cleanup();
    
    // Small delay before reconnecting to avoid immediate retry
    setTimeout(() => {
      if (!isCleanupRef.current) {
        setReconnectNonce(prev => prev + 1);
      }
    }, 100);
  }, [cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    connected,
    error,
    reconnect
  };
}

interface UseRealtimePresenceOptions {
  channelName: string;
  userId: string;
  enabled?: boolean;
}

interface PresenceUser {
  user_id: string;
  online_at: string;
  heartbeat?: number;
}

interface UseRealtimePresenceReturn {
  onlineUsers: PresenceUser[];
  isUserOnline: (userId: string) => boolean;
}

/**
 * Hook for tracking user presence in a chat channel
 */
export function useRealtimePresence({
  channelName,
  userId,
  enabled = true
}: UseRealtimePresenceOptions): UseRealtimePresenceReturn {
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  
  // Use shared Supabase client from AuthContext
  const { supabase } = useAuth();

  useEffect(() => {
    if (!enabled) return;

    const channel = supabase.channel(channelName, { 
      config: { presence: { key: userId } } 
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const presenceState = channel.presenceState();
        const users: Record<string, PresenceUser> = {};
        
        Object.values(presenceState).forEach((presences: any) => {
          presences.forEach((presence: PresenceUser) => {
            users[presence.user_id] = presence;
          });
        });
        
        setOnlineUsers(Object.values(users));
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.track({ 
            user_id: userId, 
            online_at: new Date().toISOString() 
          });
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [channelName, enabled, supabase, userId]);

  const isUserOnline = useCallback((targetUserId: string) => {
    return onlineUsers.some(user => user.user_id === targetUserId);
  }, [onlineUsers]);

  return {
    onlineUsers,
    isUserOnline
  };
}
