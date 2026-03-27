'use client';

import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { MessageList } from './ChatMessage';
import { MessageInput } from './MessageInput';
import { ChatAccessStatusBadge } from './ChatAccessStatus';
import { TypingIndicator } from './TypingIndicator';
import { useChatAccess } from '@/lib/hooks/useChatAccess';
import { useRealtimeChat } from '@/lib/hooks/useRealtimeChat';
import { useTypingIndicator } from '@/lib/hooks/useTypingIndicator';
import { useOfflineSync } from '@/lib/hooks/useOfflineSync';
import { useAuth } from '@/lib/contexts/AuthContext';
import { sendMessage, fetchMessages, createOptimisticMessage } from '@/lib/utils/messageApi';
import { generateConversationId } from '@/lib/utils/conversationUtils';
import { ArrowLeft, AlertTriangle, WifiOff } from 'lucide-react';
import { getBunnyStorageUrl } from '@/lib/utils/bunnynet';
import type { ChatMessage, Profile } from '@/lib/types/database';

interface ChatThreadProps {
  creatorId: string;
  fanId: string;
  creatorProfile: Profile;
  fanProfile: Profile;
  currentProfileId?: string;
  onBack?: () => void;
  className?: string;
}

export function ChatThread({
  creatorId,
  fanId,
  creatorProfile,
  fanProfile,
  currentProfileId: currentProfileIdProp,
  onBack,
  className = ''
}: ChatThreadProps) {
  const { profile: currentProfile } = useAuth();

  // Use context profile ID, falling back to the server-provided ID while profile loads
  const currentProfileId = currentProfile?.id ?? currentProfileIdProp ?? '';

  const { accessStatus, loading: accessLoading } = useChatAccess({ creatorId, fanId });

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sendingMessage, setSendingMessage] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const didInitialScrollRef = useRef(false);
  const isBackfillingRef = useRef(true);
  const [stickToBottom, setStickToBottom] = useState(true);

  // NEW: measure footer so we can pad the scroll area correctly
  const footerRef = useRef<HTMLDivElement>(null);
  const [footerH, setFooterH] = useState(0);

  // Determine which profile to show in header
  const otherProfile = currentProfileId === creatorId ? fanProfile : creatorProfile;
  const isCreator = currentProfile?.user_type === 'CREATOR';

  const [conversationId, setConversationId] = useState<string | null>(null);
  const authReady = !!currentProfileId;

  // Robust scroll to bottom: use both container math and sentinel for iOS quirks
  const scrollToBottom = useCallback((smooth: boolean = true) => {
    const container = messagesContainerRef.current;
    if (container) {
      const target = container.scrollHeight - container.clientHeight;
      if (smooth) {
        container.scrollTo({ top: target + 1, behavior: 'smooth' });
      } else {
        container.scrollTop = target + 1;
      }
    }
    messagesEndRef.current?.scrollIntoView({
      behavior: smooth ? 'smooth' : 'auto',
      block: 'end',
    });
  }, []);

  // Track if the user is near the bottom (allow for footer height)
  const isNearBottom = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return true;
    const threshold = Math.max(80, footerH); // include footer in tolerance
    return el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
  }, [footerH]);

  const handleScroll = useCallback(() => {
    setStickToBottom(isNearBottom());
  }, [isNearBottom]);

  // Measure footer height (and react to keyboard/viewport changes)
  useEffect(() => {
    const el = footerRef.current;
    if (!el) return;
    const setH = () => setFooterH(el.getBoundingClientRect().height || 0);
    setH();
    const ro = new ResizeObserver(setH);
    ro.observe(el);
    window.addEventListener('resize', setH);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', setH);
    };
  }, []);

  // Realtime integration
  const { error: realtimeError, reconnect } = useRealtimeChat({
    creatorId,
    fanId,
    currentUserId: currentProfileId,
    accessStatus,
    isCreator,
    conversationId: conversationId || undefined,
    usePostgresChanges: true,
    onNewMessage: useCallback((newMessage: ChatMessage) => {
      // Do NOT set conversationId here — it's managed by the useEffect hooks below.
      // Using a different format here (pipe vs underscore) caused channel reconnection storms.
      setMessages(prev => {
        if (prev.some(msg => msg.id === newMessage.id)) return prev;
        const last = prev[prev.length - 1];
        if (!last || new Date(newMessage.created_at) >= new Date(last.created_at)) {
          return [...prev, newMessage];
        }
        const updated = [...prev, newMessage].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        return updated;
      });
    }, []),
    onConnectionChange: useCallback((isConnected: boolean) => {
      if (isConnected) {
        // Always backfill on (re)connect to recover any messages missed during
        // connection gaps. setMessages uses a functional merge so duplicates are
        // discarded — safe to call even if loadMessages already ran.
        fetchMessages(creatorId, fanId, { limit: 20 })
          .then(response => {
            if (response.messages.length > 0) {
              setMessages(prev => {
                const newMessages = response.messages.filter(
                  m => !prev.some(p => p.id === m.id)
                );
                if (newMessages.length === 0) return prev;
                return [...prev, ...newMessages].sort(
                  (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                );
              });
            }
          })
          .catch(err => console.error('Failed to backfill messages on reconnect:', err));
      }
    }, [creatorId, fanId]),
    onAccessExpired: useCallback(() => {}, [])
  });

  // Typing indicators
  const { typingUsers, startTyping, stopTyping } = useTypingIndicator({
    conversationId: conversationId || `${creatorId}|${fanId}`,
    currentUserId: currentProfileId,
    enabled: !!conversationId
  });

  // Online status
  const { isOnline: connectionOnline } = useOfflineSync({
    conversationId: conversationId || `${creatorId}|${fanId}`,
    enabled: !!conversationId
  });


  // Load messages
  const loadMessages = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetchMessages(creatorId, fanId, { limit: 50 });
      setMessages(response.messages);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load messages';
      if (errorMessage.includes('Not authorized') || errorMessage.includes('authorized')) {
        setError('unauthorized');
      } else {
        console.error('Error loading messages:', err);
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  }, [creatorId, fanId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (!loading) isBackfillingRef.current = false;
  }, [loading]);

  useEffect(() => {
    if (!conversationId && messages.length > 0) {
      const firstMessage = messages[0];
      if (firstMessage) {
        setConversationId(generateConversationId(firstMessage.creator_id, firstMessage.fan_id));
      }
    }
  }, [messages, conversationId]);

  useEffect(() => {
    if (!conversationId && authReady) {
      setConversationId(generateConversationId(creatorId, fanId));
    }
  }, [conversationId, creatorId, fanId, authReady]);

  // Safety-net poll: catches messages missed during JWT transitions or realtime gaps
  useEffect(() => {
    if (!creatorId || !fanId) return;
    const interval = setInterval(async () => {
      try {
        const response = await fetchMessages(creatorId, fanId, { limit: 10 });
        setMessages(prev => {
          const newMsgs = response.messages.filter(m => !prev.some(p => p.id === m.id));
          if (newMsgs.length === 0) return prev;
          return [...prev, ...newMsgs].sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
        });
      } catch {
        // Silently ignore poll failures — realtime is the primary path
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [creatorId, fanId]);

  // FIRST PAINT: double rAF to ensure layout is settled (prevents short-scroll under footer)
  useLayoutEffect(() => {
    if (!didInitialScrollRef.current && messages.length > 0) {
      didInitialScrollRef.current = true;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollToBottom(false);
        });
      });
    }
  }, [messages.length, scrollToBottom]);

  // NEW MESSAGES: stay pinned only if user is near bottom
  useEffect(() => {
    if (!messages.length) return;
    if (stickToBottom) {
      requestAnimationFrame(() => scrollToBottom(true));
    }
  }, [messages[messages.length - 1]?.id, stickToBottom, scrollToBottom]);

  // CONTENT HEIGHT CHANGES: keep pinned when images/typing affect height
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (stickToBottom) {
        requestAnimationFrame(() => scrollToBottom(false));
      }
    });
    const content = el.firstElementChild as HTMLElement | null;
    if (content) ro.observe(content);
    return () => ro.disconnect();
  }, [stickToBottom, scrollToBottom]);

  const handleSendMessage = useCallback(async (content: string) => {
    if (!currentProfileId || (!isCreator && !accessStatus?.hasAccess)) return;
    setStickToBottom(true); // sending implies we want to be pinned

    let optimisticMessage: ChatMessage | null = null;

    try {
      setSendingMessage(true);
      optimisticMessage = createOptimisticMessage({
        senderId: currentProfileId,
        creatorId,
        fanId,
        content
      });
      setMessages(prev => [...prev, optimisticMessage!]);

      const result = await sendMessage({ creatorId, fanId, content });

      if (result.success && result.message) {
        if (!conversationId) {
          setConversationId(generateConversationId(result.message.creator_id, result.message.fan_id));
        }
        setMessages(prev => {
          const withoutServerDupes = prev.filter(m => m.id !== result.message!.id);
          return withoutServerDupes.map(m => (m === optimisticMessage ? result.message! : m));
        });
      } else {
        setMessages(prev => prev.filter(msg => msg !== optimisticMessage));
        console.error('Failed to send message:', result.error);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      if (optimisticMessage) {
        setMessages(prev => prev.filter(msg => msg !== optimisticMessage));
      }
    } finally {
      setSendingMessage(false);
    }
  }, [currentProfile, accessStatus, creatorId, fanId, conversationId]);

  const canSendMessages = (isCreator || accessStatus?.hasAccess) && !accessLoading && authReady;
  const showAccessWarning = !accessLoading && !accessStatus?.hasAccess;

  if (!authReady) {
    return (
      <div className={`flex flex-col h-full bg-background ${className}`}>
        <div className="flex items-center justify-center h-full">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  if (error === 'unauthorized') {
    return (
      <div className={`flex flex-col h-full bg-background ${className}`}>
        <div className="mobile-sticky-header sticky top-0 z-10 flex items-center gap-3 px-4 py-2 border-b border-border bg-card/95 backdrop-blur-sm">
          {onBack && (
            <button onClick={onBack} className="p-1 hover:bg-accent rounded-md transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <h2 className="font-semibold text-sm">Conversation Not Available</h2>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold mb-2 text-foreground">Access Denied</h2>
            <p className="text-muted-foreground mb-6 leading-relaxed">
              You don&apos;t have permission to view this conversation.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => {
                  const dashboardUrl = currentProfile?.user_type === 'CREATOR' ? '/creator/dashboard' : '/fan/dashboard';
                  window.location.href = dashboardUrl;
                }}
                className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                Go to Dashboard
              </button>
              {onBack && (
                <button onClick={onBack} className="w-full px-4 py-2 border border-border rounded-md hover:bg-accent transition-colors">
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
    <div className={`flex flex-col h-full bg-white ${className}`}>
      {/* Header */}
      <header className="sticky top-0 z-20 h-14 border-b flex items-center justify-between px-4 md:px-6 bg-white flex-shrink-0">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="p-1 hover:bg-gray-100 rounded-md transition-colors md:hidden">
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <div className="h-8 w-8 rounded-full bg-gray-200 flex-shrink-0">
            {otherProfile.profile_picture_url && (
              <img
                src={getBunnyStorageUrl(otherProfile.profile_picture_url)}
                alt={otherProfile.display_name || otherProfile.email}
                className="h-8 w-8 rounded-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent) {
                    parent.innerHTML = `<span class="font-medium text-gray-500 text-sm">${(otherProfile.display_name || otherProfile.email)?.charAt(0)?.toUpperCase() || '?'}</span>`;
                  }
                }}
              />
            )}
          </div>
          <div className="min-w-0">
            <div className="font-medium leading-4 truncate">{otherProfile.display_name || otherProfile.email}</div>
            <div className="text-xs text-gray-500 leading-4">{connectionOnline ? 'Online' : 'Offline'}</div>
          </div>
        </div>
        <div className="text-xs text-gray-500 flex-shrink-0">
          {accessStatus && <ChatAccessStatusBadge status={accessStatus} />}
        </div>
      </header>

      {/* Access Warning */}
      {showAccessWarning && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 flex-shrink-0">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-yellow-800">Chat access required</p>
              <p className="text-yellow-700">
                {isCreator ? 'This fan needs to make a qualifying purchase to send messages.' : 'Make a qualifying purchase to unlock messaging with this creator.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Realtime Error Warning */}
      {realtimeError && accessStatus?.hasAccess && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 flex-shrink-0">
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
      <section
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8 bg-gray-50"
      >
        <div className="max-w-3xl mx-auto space-y-4">
          <MessageList
            messages={messages}
            profiles={{ [creatorId]: creatorProfile, [fanId]: fanProfile }}
            currentUserId={currentProfileId}
            loading={loading}
            error={error}
          />
          {/* Sentinel: add scroll margin so it clears the footer when scrolled into view */}
          <div
            ref={messagesEndRef}
            aria-hidden
            style={{ height: 1, scrollMarginBottom: footerH + 12 }}
          />
          {/* Dynamic spacer instead of hard-coded value */}
          <div style={{ height: footerH + 8 }} />
        </div>
      </section>

      {/* Typing Indicators */}
      <TypingIndicator typingUsers={typingUsers.filter(user => user.userId !== currentProfileId)} />

      {/* Footer */}
      <footer
        ref={footerRef}
        className="fixed md:relative bottom-0 left-0 right-0 border-t px-3 py-3 md:px-6 bg-white z-10 flex-shrink-0"
      >
        <MessageInput
          onSendMessage={handleSendMessage}
          disabled={!canSendMessages || sendingMessage}
          placeholder={!canSendMessages ? 'Chat access required to send messages' : 'Type your message...'}
          onStartTyping={startTyping}
          onStopTyping={stopTyping}
        />
      </footer>
    </div>
  );
}
