'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import type { ChatMessage } from '@/lib/types/database';

interface QueuedMessage {
  id: string;
  creatorId: string;
  fanId: string;
  content: string;
  timestamp: number;
  retryCount: number;
  status: 'pending' | 'sending' | 'failed' | 'sent';
}

interface UseOfflineSyncOptions {
  conversationId: string;
  enabled?: boolean;
  maxRetries?: number;
  retryDelay?: number;
}

interface UseOfflineSyncReturn {
  isOnline: boolean;
  queuedMessages: QueuedMessage[];
  queueMessage: (creatorId: string, fanId: string, content: string) => string;
  retryFailedMessages: () => void;
  clearQueue: () => void;
  getQueuedMessageById: (id: string) => QueuedMessage | undefined;
}

const STORAGE_KEY_PREFIX = 'chat_queue_';
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds
const EXPONENTIAL_BACKOFF = 1.5;

const getOnline = () => (typeof navigator !== 'undefined' ? navigator.onLine : true);

export function useOfflineSync({
  conversationId,
  enabled = true,
  maxRetries = MAX_RETRIES,
  retryDelay = RETRY_DELAY
}: UseOfflineSyncOptions): UseOfflineSyncReturn {
  const [isOnline, setIsOnline] = useState(getOnline());
  const [queuedMessages, setQueuedMessages] = useState<QueuedMessage[]>([]);
  const processingRef = useRef<boolean>(false);
  const retryTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  
  const storageKey = `${STORAGE_KEY_PREFIX}${conversationId}`;

  // Load queued messages from localStorage on mount
  useEffect(() => {
    if (!enabled || typeof localStorage === 'undefined') return;

    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as QueuedMessage[];
        setQueuedMessages(parsed);
      }
    } catch (error) {
      console.error('Failed to load queued messages:', error);
    }
  }, [storageKey, enabled]);

  // Save queued messages to localStorage whenever they change
  useEffect(() => {
    if (!enabled || typeof localStorage === 'undefined') return;

    try {
      localStorage.setItem(storageKey, JSON.stringify(queuedMessages));
    } catch (error) {
      console.error('Failed to save queued messages:', error);
    }
  }, [queuedMessages, storageKey, enabled]);

  // Monitor online/offline status
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const handleOnline = () => {
      console.log('📶 Connection restored, processing queued messages');
      setIsOnline(true);
    };

    const handleOffline = () => {
      console.log('📵 Connection lost, messages will be queued');
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [enabled]);

  // Process queued messages when online
  useEffect(() => {
    if (!enabled || !isOnline || processingRef.current || queuedMessages.length === 0) {
      return;
    }

    processQueuedMessages();
  }, [isOnline, queuedMessages.length, enabled]);

  const clearRetryTimer = useCallback((id: string) => {
    const timer = retryTimeoutsRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      retryTimeoutsRef.current.delete(id);
    }
  }, []);

  const processQueuedMessages = useCallback(async () => {
    if (processingRef.current) return;
    
    processingRef.current = true;
    
    try {
      const pendingMessages = queuedMessages.filter(msg => 
        msg.status === 'pending' || msg.status === 'failed'
      );

      for (const queuedMsg of pendingMessages) {
        // Bail out if connectivity flips mid-loop
        if (!getOnline()) {
          processingRef.current = false;
          return;
        }

        if (queuedMsg.retryCount >= maxRetries) {
          console.log(`❌ Message ${queuedMsg.id} exceeded max retries, marking as failed`);
          updateMessageStatus(queuedMsg.id, 'failed');
          continue;
        }

        try {
          updateMessageStatus(queuedMsg.id, 'sending');
          
          const response = await fetch('/api/chat/send', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              creatorId: queuedMsg.creatorId,
              fanId: queuedMsg.fanId,
              content: queuedMsg.content
            }),
            cache: 'no-store',
            signal: typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal ? AbortSignal.timeout(7000) : undefined,
          });

          if (response.ok) {
            console.log(`✅ Queued message ${queuedMsg.id} sent successfully`);
            clearRetryTimer(queuedMsg.id);
            removeMessageFromQueue(queuedMsg.id);
          } else {
            throw new Error(`HTTP ${response.status}`);
          }
        } catch (error) {
          console.error(`❌ Failed to send queued message ${queuedMsg.id}:`, error);
          
          const newRetryCount = queuedMsg.retryCount + 1;
          updateMessageRetryCount(queuedMsg.id, newRetryCount);
          
          if (newRetryCount < maxRetries) {
            updateMessageStatus(queuedMsg.id, 'failed');
            
            // Schedule retry with exponential backoff
            const delay = retryDelay * Math.pow(EXPONENTIAL_BACKOFF, newRetryCount - 1);
            const timer = setTimeout(() => {
              updateMessageStatus(queuedMsg.id, 'pending');
            }, delay);
            retryTimeoutsRef.current.set(queuedMsg.id, timer);
          } else {
            updateMessageStatus(queuedMsg.id, 'failed');
          }
        }

        // Small delay between messages to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } finally {
      processingRef.current = false;
    }
  }, [queuedMessages, maxRetries, retryDelay, clearRetryTimer]);

  const queueMessage = useCallback((creatorId: string, fanId: string, content: string): string => {
    const messageId = `queued_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    
    const queuedMessage: QueuedMessage = {
      id: messageId,
      creatorId,
      fanId,
      content,
      timestamp: Date.now(),
      retryCount: 0,
      status: 'pending'
    };

    // Cap the queue to prevent runaway storage
    if (queuedMessages.length >= 200) {
      // Drop oldest message
      setQueuedMessages(prev => [...prev.slice(1), queuedMessage]);
    } else {
      setQueuedMessages(prev => [...prev, queuedMessage]);
    }
    
    console.log(`📤 Message queued: ${messageId} (${isOnline ? 'online' : 'offline'})`);
    
    return messageId;
  }, [isOnline, queuedMessages.length]);

  const updateMessageStatus = useCallback((messageId: string, status: QueuedMessage['status']) => {
    setQueuedMessages(prev => 
      prev.map(msg => 
        msg.id === messageId ? { ...msg, status } : msg
      )
    );
  }, []);

  const updateMessageRetryCount = useCallback((messageId: string, retryCount: number) => {
    setQueuedMessages(prev => 
      prev.map(msg => 
        msg.id === messageId ? { ...msg, retryCount } : msg
      )
    );
  }, []);

  const removeMessageFromQueue = useCallback((messageId: string) => {
    setQueuedMessages(prev => prev.filter(msg => msg.id !== messageId));
  }, []);

  const retryFailedMessages = useCallback(() => {
    setQueuedMessages(prev => 
      prev.map(msg => 
        msg.status === 'failed' ? { ...msg, status: 'pending', retryCount: 0 } : msg
      )
    );
  }, []);

  const clearQueue = useCallback(() => {
    // Clear all retry timers
    for (const timer of retryTimeoutsRef.current.values()) {
      clearTimeout(timer);
    }
    retryTimeoutsRef.current.clear();
    
    setQueuedMessages([]);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(storageKey);
      }
    } catch (error) {
      console.error('Failed to clear queue from storage:', error);
    }
  }, [storageKey]);

  const getQueuedMessageById = useCallback((id: string) => {
    return queuedMessages.find(msg => msg.id === id);
  }, [queuedMessages]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      for (const timer of retryTimeoutsRef.current.values()) {
        clearTimeout(timer);
      }
      retryTimeoutsRef.current.clear();
    };
  }, []);

  return {
    isOnline,
    queuedMessages,
    queueMessage,
    retryFailedMessages,
    clearQueue,
    getQueuedMessageById
  };
}

/**
 * Hook for syncing messages when coming back online
 */
interface UseMessageSyncOptions {
  conversationId: string;
  onMessagesReceived?: (messages: ChatMessage[]) => void;
  enabled?: boolean;
}

export function useMessageSync({
  conversationId,
  onMessagesReceived,
  enabled = true
}: UseMessageSyncOptions) {
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const { supabase } = useAuth();

  // Load last sync time from localStorage
  useEffect(() => {
    if (!enabled || typeof localStorage === 'undefined') return;

    try {
      const stored = localStorage.getItem(`last_sync_${conversationId}`);
      if (stored) {
        setLastSyncTime(parseInt(stored, 10));
      }
    } catch (error) {
      console.error('Failed to load last sync time:', error);
    }
  }, [conversationId, enabled]);

  // Sync messages when coming back online
  const syncMessages = useCallback(async () => {
    if (!enabled || syncing) return;

    setSyncing(true);
    
    try {
      const since = lastSyncTime ? new Date(lastSyncTime).toISOString() : undefined;
      
      // Parse conversationId to get creator and fan IDs
      const [creatorId, fanId] = conversationId.split('|');
      
      // Fetch messages since last sync
      const { data: messages, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('creator_id', creatorId)
        .eq('fan_id', fanId)
        .gt('created_at', since || '1970-01-01')
        .order('created_at', { ascending: true })
        .limit(500);

      if (error) {
        console.error('Failed to sync messages:', error);
        return;
      }

      if (messages && messages.length > 0) {
        console.log(`📥 Synced ${messages.length} messages`);
        onMessagesReceived?.(messages);
        
        // Update last sync time
        const newSyncTime = Date.now();
        setLastSyncTime(newSyncTime);
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(`last_sync_${conversationId}`, newSyncTime.toString());
        }
      }
    } catch (error) {
      console.error('Error syncing messages:', error);
    } finally {
      setSyncing(false);
    }
  }, [enabled, syncing, lastSyncTime, conversationId, supabase, onMessagesReceived]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const handleOnline = () => {
      console.log('📶 Connection restored, syncing messages');
      syncMessages();
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [enabled, syncMessages]);

  return {
    syncing,
    syncMessages,
    lastSyncTime
  };
}
