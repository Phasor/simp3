'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { MessageList } from './ChatMessage';
import { MessageInput } from './MessageInput';
import { ChatAccessStatusBadge } from './ChatAccessStatus';
import { TypingIndicator, OnlineIndicator, PresenceAvatar } from './TypingIndicator';
import { useChatAccess } from '@/hooks/useChatAccess';
import { useRealtimeChat } from '@/hooks/useRealtimeChat';
import { useTypingIndicator, usePresence } from '@/hooks/useTypingIndicator';
import { useRealtimeHealth } from '@/hooks/useConnectionHealth';
import { useAuth } from '@/contexts/AuthContext';
import { sendMessage, fetchMessages, createOptimisticMessage, isOptimisticMessage } from '@/lib/messageApi';
import { generateConversationId } from '@/lib/conversationUtils';
import { ArrowLeft, AlertTriangle, WifiOff } from 'lucide-react';
import type { Tables } from '@simp2/shared';

type ChatMessage = Tables<'chat_messages'>;
type Profile = Tables<'profiles'>;

interface ChatThreadProps {
  creatorId: string;
  fanId: string;
  creatorProfile: Profile;
  fanProfile: Profile;
  onBack?: () => void;
  className?: string;
}

export function ChatThread({
  creatorId,
  fanId,
  creatorProfile,
  fanProfile,
  onBack,
  className = ''
}: ChatThreadProps) {
  const { profile: currentProfile } = useAuth();
  const { accessStatus, loading: accessLoading } = useChatAccess({
    creatorId,
    fanId,
    autoRefresh: true
  });

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Determine which profile to show in header
  const otherProfile = currentProfile?.id === creatorId ? fanProfile : creatorProfile;
  const isCreator = currentProfile?.user_type === 'CREATOR';
  
  // Use database-generated conversation ID (will be set after first message)
  const [conversationId, setConversationId] = useState<string | null>(null);
  
  // Auth readiness guard
  const authReady = !!currentProfile?.id;
  
  // Fallback to deterministic naming for initial connection
  const channelConversationId = conversationId || generateConversationId(creatorId, fanId);

  // Realtime integration with improved features
  const { connected, error: realtimeError, reconnect } = useRealtimeChat({
    creatorId,
    fanId,
    currentUserId: currentProfile?.id || '',
    accessStatus,
    conversationId: conversationId || undefined, // Only use real conversation ID
    // Use postgres_changes for secure, durable message delivery (Option A - public channels)
    usePostgresChanges: true,
    onNewMessage: useCallback((newMessage: ChatMessage) => {
      console.log('📨 New message received in chat');
      
      // Extract conversation_id from the message if we don't have it yet
      if (!conversationId && (newMessage as any).conversation_id) {
        setConversationId((newMessage as any).conversation_id);
      }
      
      setMessages(prev => {
        // Check if message already exists (avoid duplicates)
        const exists = prev.some(msg => msg.id === newMessage.id);
        if (exists) return prev;
        
        // Add new message with optimized sorting
        const last = prev[prev.length - 1];
        if (!last || new Date(newMessage.created_at) >= new Date(last.created_at)) {
          return [...prev, newMessage];
        }
        const updated = [...prev, newMessage].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        return updated;
      });
    }, [conversationId]),
    onConnectionChange: useCallback((isConnected: boolean) => {
      console.log('🔗 Chat connection status:', isConnected ? 'connected' : 'disconnected');
      
      // Only backfill on initial connection, not on every reconnection
      // This prevents excessive API calls from unstable connections
      if (isConnected && messages.length === 0) {
        console.log('🔄 Initial connection - fetching recent messages');
        fetchMessages(creatorId, fanId, { 
          limit: 20
        }).then(response => {
          if (response.messages.length > 0) {
            setMessages(prev => {
              const newMessages = response.messages.filter(
                newMsg => !prev.some(existingMsg => existingMsg.id === newMsg.id)
              );
              return [...prev, ...newMessages].sort(
                (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              );
            });
          }
        }).catch(error => {
          console.error('Failed to backfill messages:', error);
        });
      }
    }, [creatorId, fanId, messages.length]),
    onAccessExpired: useCallback(() => {
      console.log('⚠️ Chat access expired, refreshing access status');
      // Could show a toast notification here
      // The useChatAccess hook will automatically refresh and detect the change
    }, [])
  });

  // Typing and presence guards
  const typingPresenceEnabled = !!accessStatus?.hasAccess && !!conversationId && authReady;

  // Typing indicators
  const { typingUsers, startTyping, stopTyping, isUserTyping } = useTypingIndicator({
    conversationId: conversationId!,
    currentUserId: currentProfile?.id || '',
    enabled: typingPresenceEnabled
  });

  // Presence indicators
  const { onlineUsers, isUserOnline } = usePresence({
    conversationId: conversationId!,
    currentUserId: currentProfile?.id || '',
    enabled: typingPresenceEnabled
  });

  // Connection health monitoring
  const connectionHealth = useRealtimeHealth({
    enabled: (accessStatus?.hasAccess || false) && authReady,
    onQualityChange: (quality) => {
      console.log(`📊 Connection quality: ${quality}`);
    },
    onReconnect: () => {
      console.log('🔄 Connection health detected reconnection');
    }
  });

  // Profiles lookup
  const profiles: Record<string, Profile> = {
    [creatorId]: creatorProfile,
    [fanId]: fanProfile
  };

  // Load messages from API
  const loadMessages = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetchMessages(creatorId, fanId, { limit: 50 });
      setMessages(response.messages);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load messages';
      
      // Handle authorization errors more gracefully (don't log as errors since they're expected)
      if (errorMessage.includes('Not authorized') || errorMessage.includes('authorized')) {
        console.log('🔒 Message access denied (expected for unauthorized users)');
        setError('unauthorized');
      } else {
        console.error('Error loading messages:', err);
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  }, [creatorId, fanId]);

  // Load messages on component mount
  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Set conversationId from existing messages after initial load
  useEffect(() => {
    if (!conversationId && messages.length > 0) {
      const firstWithConv = messages.find(m => (m as any).conversation_id);
      if (firstWithConv) {
        setConversationId((firstWithConv as any).conversation_id);
      }
    }
  }, [messages, conversationId]);

  // Poll for conversationId when it's missing (for realtime bootstrap)
  useEffect(() => {
    // Since chat_messages table doesn't have conversation_id, don't poll for it
    // Use the deterministic conversation ID instead
    if (!conversationId && authReady) {
      const deterministicId = generateConversationId(creatorId, fanId);
      console.log('🔗 Using deterministic conversation ID:', deterministicId);
      setConversationId(deterministicId);
    }
  }, [conversationId, creatorId, fanId, authReady]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSendMessage = useCallback(async (content: string) => {
    if (!currentProfile || !accessStatus?.hasAccess) {
      console.error('No access to send messages');
      return;
    }

    let optimisticMessage: ChatMessage | null = null;

    try {
      setSendingMessage(true);

      // Create optimistic message
      optimisticMessage = createOptimisticMessage(
        creatorId,
        fanId,
        currentProfile.id,
        content
      );

      // Add optimistic message immediately
      setMessages(prev => [...prev, optimisticMessage!]);

      // Send message to API
      const result = await sendMessage({
        creatorId,
        fanId,
        content
      });

      if (result.success && result.message) {
        // Extract conversation_id from the response if we don't have it yet
        if (!conversationId && (result.message as any).conversation_id) {
          setConversationId((result.message as any).conversation_id);
        }
        
        // Replace optimistic message with real message using reference equality
        // Also dedupe in case realtime insert arrived before API response
        setMessages(prev => {
          const withoutServerDupes = prev.filter(m => m.id !== result.message!.id);
          return withoutServerDupes.map(m =>
            m === optimisticMessage ? result.message! : m
          );
        });
      } else {
        // Remove optimistic message and show error using reference equality
        setMessages(prev => prev.filter(msg => msg !== optimisticMessage));
        console.error('Failed to send message:', result.error);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Remove the optimistic message if it was added using reference equality
      if (optimisticMessage) {
        setMessages(prev => prev.filter(msg => msg !== optimisticMessage));
      }
    } finally {
      setSendingMessage(false);
    }
  }, [currentProfile, accessStatus, creatorId, fanId]);


  const canSendMessages = accessStatus?.hasAccess && !accessLoading && authReady;
  const showAccessWarning = !accessLoading && !accessStatus?.hasAccess;

  // Don't render until auth is ready
  if (!authReady) {
    return (
      <div className={`flex flex-col h-full bg-background ${className}`}>
        <div className="flex items-center justify-center h-full">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  // Handle unauthorized access gracefully
  if (error === 'unauthorized') {
    return (
      <div className={`flex flex-col h-full bg-background ${className}`}>
        {/* Header with back button */}
        <div className="mobile-sticky-header sticky top-0 z-10 flex items-center gap-3 px-4 py-2 border-b border-border bg-card/95 backdrop-blur-sm">
          {onBack && (
            <button
              onClick={onBack}
              className="p-1 hover:bg-accent rounded-md transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <h2 className="font-semibold text-sm">Conversation Not Available</h2>
        </div>

        {/* Unauthorized message */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            
            <h2 className="text-xl font-semibold mb-2 text-foreground">Access Denied</h2>
            <p className="text-muted-foreground mb-6 leading-relaxed">
              You don't have permission to view this conversation. This may be because:
            </p>
            
            <ul className="text-sm text-muted-foreground mb-6 space-y-2 text-left">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full mt-2 flex-shrink-0"></span>
                <span>You're not a participant in this conversation</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full mt-2 flex-shrink-0"></span>
                <span>You don't have the required chat access</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full mt-2 flex-shrink-0"></span>
                <span>The conversation link is invalid or expired</span>
              </li>
            </ul>

            <div className="space-y-3">
              <button
                onClick={() => {
                  const dashboardUrl = currentProfile?.user_type === 'CREATOR' 
                    ? '/creator/dashboard' 
                    : '/fan/dashboard';
                  window.location.href = dashboardUrl;
                }}
                className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                Go to Dashboard
              </button>
              
              {onBack && (
                <button
                  onClick={onBack}
                  className="w-full px-4 py-2 border border-border rounded-md hover:bg-accent transition-colors"
                >
                  Back to Messages
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full bg-background overflow-hidden ${className}`}>
      {/* Header - Sticky */}
      <div className="mobile-sticky-header sticky top-0 z-10 flex items-center gap-3 px-4 py-2 border-b border-border bg-card/95 backdrop-blur-sm">
        {onBack && (
          <button
            onClick={onBack}
            className="p-1 hover:bg-accent rounded-md transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}

        <div className="flex items-center gap-3 flex-1">
          {/* Avatar */}
          {otherProfile.profile_picture_url ? (
            <img
              src={otherProfile.profile_picture_url}
              alt={otherProfile.display_name || otherProfile.email}
              className="w-10 h-10 rounded-full object-cover"
              onError={(e) => {
                // Hide broken image and show initials fallback
                e.currentTarget.style.display = 'none';
                const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                if (fallback) fallback.style.display = 'flex';
              }}
            />
          ) : null}
          <div 
            className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium"
            style={{ display: otherProfile.profile_picture_url ? 'none' : 'flex' }}
          >
            {(otherProfile.display_name || otherProfile.email)
              .split(' ')
              .map(name => name[0])
              .join('')
              .toUpperCase()
              .slice(0, 2)}
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="font-semibold text-sm">
                {otherProfile.display_name || otherProfile.email}
              </h2>
              {accessStatus && (
                <ChatAccessStatusBadge status={accessStatus} />
              )}
            </div>
            <OnlineIndicator 
              isOnline={isUserOnline(otherProfile?.id || '')}
              className="text-xs"
            />
          </div>
        </div>

      </div>

      {/* Access Warning */}
      {showAccessWarning && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-yellow-800">Chat access required</p>
              <p className="text-yellow-700">
                {isCreator 
                  ? 'This fan needs to make a qualifying purchase to send messages.'
                  : 'Make a qualifying purchase to unlock messaging with this creator.'
                }
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Realtime Error Warning */}
      {realtimeError && accessStatus?.hasAccess && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2">
          <div className="flex items-start gap-2">
            <WifiOff className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm flex-1">
              <p className="font-medium text-red-800">Connection issue</p>
              <p className="text-red-700">
                Messages may not appear in real-time. {realtimeError}
              </p>
            </div>
            <button
              onClick={reconnect}
              className="text-sm bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700 transition-colors"
            >
              Reconnect
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div 
        ref={messagesContainerRef}
        className="chat-container flex-1 overflow-y-auto overscroll-contain px-4 py-2 space-y-2"
        style={{ scrollBehavior: 'smooth' }}
      >
        <MessageList
          messages={messages}
          profiles={profiles}
          currentUserId={currentProfile?.id || ''}
          loading={loading}
          error={error}
        />
        <div ref={messagesEndRef} />
      </div>

      {/* Typing Indicators */}
      <TypingIndicator 
        typingUsers={typingUsers.filter(user => user.userId !== currentProfile?.id)}
      />

      {/* Message Input */}
      <MessageInput
        onSendMessage={handleSendMessage}
        disabled={!canSendMessages || sendingMessage}
        placeholder={
          !canSendMessages 
            ? 'Chat access required to send messages'
            : 'Type your message...'
        }
        onStartTyping={startTyping}
        onStopTyping={stopTyping}
      />
    </div>
  );
}
