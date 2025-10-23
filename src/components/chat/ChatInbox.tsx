'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, MessageCircle, Crown, Heart, Clock, CheckCircle2, ChevronDown } from 'lucide-react';
import { getBunnyStorageUrl } from '@/lib/utils/bunnynet';
import { ChatAccessStatusBadge } from './ChatAccessStatus';
import { OnlineIndicator, PresenceAvatar } from './TypingIndicator';
import { useAuth } from '@/lib/contexts/AuthContext';
import { ChatAccessStatus } from '@/lib/utils/chatAccess';
import { getUserChatAccess, calculateAccessStatus } from '@/lib/utils/chatAccess';
import { formatConversationTitle } from '@/lib/utils/conversationUtils';

// Timeout wrapper to prevent hanging promises
function timeout<T>(p: Promise<T>, ms = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('CHAT_ACCESS_TIMEOUT')), ms);
    p.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}
import { formatDistanceToNow } from 'date-fns';
import type { Profile, ChatAccess, ChatMessage } from '@/lib/types/database';

const DEBUG = process.env.NEXT_PUBLIC_DEBUG === '1';

// Helper to throw AbortError so finally block always executes
function throwIfAborted(ctrl: AbortController) {
  // DOMException is what fetch uses; caught below as AbortError
  if (ctrl.signal.aborted) throw new DOMException('Aborted', 'AbortError');
}

interface ConversationItem {
  id: string;
  creatorId: string;
  fanId: string;
  creator: Profile;
  fan: Profile;
  lastMessage?: ChatMessage;
  lastMessageAt: string;
  unreadCount: number;
  accessStatus?: ChatAccessStatus;
}

interface ChatInboxProps {
  onSelectConversation?: (creatorId: string, fanId: string, creatorProfile: Profile, fanProfile: Profile) => void;
  selectedConversationId?: string;
  className?: string;
}

export function ChatInbox({
  onSelectConversation,
  selectedConversationId,
  className = ''
}: ChatInboxProps) {
  const { profile: currentProfile, loading: authLoading, supabase } = useAuth();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeOpen, setActiveOpen] = useState(true);
  const [expiredOpen, setExpiredOpen] = useState(false);
  
  // Mounted ref to prevent state updates after unmount
  const mountedRef = useRef(true);
  
  // AbortController and loading refs for race condition prevention
  const inFlight = useRef<AbortController | null>(null);
  const loadingRef = useRef(false);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Debug logging for component mount and auth state
  DEBUG && console.log('🏠 ChatInbox component rendered:', { 
    authLoading, 
    hasProfile: !!currentProfile, 
    profileId: currentProfile?.id,
    loading 
  });

  // Safety timeout to prevent infinite loading (non-destructive)
  useEffect(() => {
    if (!loading) return;
    const timeout = setTimeout(() => {
      if (loading && inFlight.current) {
        console.warn('⚠️ UI timeout: showing partial state');
        // Don't set an error that blocks the list; prefer a non-blocking banner
        setError(prev => prev ?? 'Taking longer than usual…');
        // DO NOT setLoading(false) here anymore; finish() handles it.
        // Let the request complete or be aborted by navigation.
      }
    }, 10000); // 10 second timeout

    return () => clearTimeout(timeout);
  }, [loading]);

  // Load conversations
  const loadConversations = useCallback(async (
    profile?: typeof currentProfile,
    isAuthLoadingOverride?: boolean
  ) => {
    // Cancel previous run
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;

    if (loadingRef.current) return; // no overlap
    loadingRef.current = true;
    setLoading(true);
    setError(null);

    const finish = () => {
      if (inFlight.current === controller) inFlight.current = null;
      loadingRef.current = false;
      setLoading(false);
    };

    try {
      // Gate on auth
      const currentAuthLoading = isAuthLoadingOverride ?? authLoading;
      const currentUserProfile = profile ?? currentProfile;

      DEBUG && console.log('🔄 loadConversations called:', {
        profileId: currentUserProfile?.id,
        authLoading: currentAuthLoading,
        hasProfile: !!currentUserProfile
      });

      if (currentAuthLoading && !isAuthLoadingOverride) {
        DEBUG && console.log('⏳ Auth still loading, skipping...');
        return finish();
      }
      if (!currentUserProfile?.id) {
        DEBUG && console.log('❌ No profile found, stopping loading');
        setError('You are not signed in.');
        return finish();
      }

      // Use supabase from context instead of creating new client

      // Conversations query (with abort)
      DEBUG && console.log('🔍 Fetching conversations for user:', currentUserProfile.id);
      
      const { data: conversationsData, error: conversationsError } = await supabase
        .from('conversations_with_last_message')
        .select('*')
        .or(`creator_id.eq.${currentUserProfile.id},fan_id.eq.${currentUserProfile.id}`)
        .order('last_message_at', { ascending: false })
        .abortSignal(controller.signal);      // 👈 correct way

      throwIfAborted(controller);
      if (conversationsError) throw conversationsError;

      if (!conversationsData?.length) { 
        setConversations([]); 
        return finish();
      }

      // Access lookup — non-blocking if slow
      let withAccess = conversationsData;
      try {
        console.log('🔍 Fetching chat access records for user:', currentUserProfile.id);
        const accessResult = await timeout(
          getUserChatAccess(supabase, currentUserProfile.id, currentUserProfile.user_type),
          3000
        );
        throwIfAborted(controller);

        const map = new Map(accessResult.data?.map(a => [`${a.creator_id}|${a.fan_id}`, a]));
        withAccess = conversationsData.map(conv => {
          const a = map.get(`${conv.creator_id}|${conv.fan_id}`);
          return { 
            ...conv, 
            accessStatus: a ? calculateAccessStatus(a) : {
              hasAccess: false, 
              accessUntil: null, 
              isExpired: true, 
              timeRemaining: 0,
              daysRemaining: 0, 
              hoursRemaining: 0, 
              minutesRemaining: 0, 
              lastQualifyingPurchaseId: null
            }
          };
        });
        console.log('✅ Applied access status to', withAccess.length, 'conversations');
      } catch (e) {
        if ((e as any).name === 'AbortError') throw e; // fall through to finally/finish
        // Non-fatal: use fallback status
        console.warn('⚠️ Chat access lookup skipped:', (e as Error).message);
        withAccess = conversationsData.map(conv => ({
          ...conv,
          accessStatus: {
            hasAccess: false, 
            accessUntil: null, 
            isExpired: true, 
            timeRemaining: 0,
            daysRemaining: 0, 
            hoursRemaining: 0, 
            minutesRemaining: 0, 
            lastQualifyingPurchaseId: null
          }
        }));
      }

      throwIfAborted(controller);

      // Transform and set (your existing transform)
      console.log('🔄 Transforming conversations data');
      const conversationItems: ConversationItem[] = withAccess.map((conv: any) => {
        // Check if this is from the optimized view (has creator_id_join) or fallback (has creator object)
        const isOptimizedView = conv.creator_id_join !== undefined;
        
        return {
          id: conv.id,
          creatorId: conv.creator_id,
          fanId: conv.fan_id,
          creator: isOptimizedView ? {
            id: conv.creator_id_join,
            email: conv.creator_email,
            display_name: conv.creator_display_name,
            user_type: conv.creator_user_type,
            profile_picture_url: conv.creator_ppu
          } as Profile : conv.creator,
          fan: isOptimizedView ? {
            id: conv.fan_id_join,
            email: conv.fan_email,
            display_name: conv.fan_display_name,
            user_type: conv.fan_user_type,
            profile_picture_url: conv.fan_ppu
          } as Profile : conv.fan,
          lastMessage: (isOptimizedView && conv.last_message_id) ? {
            id: conv.last_message_id,
            sender_id: conv.last_message_sender_id,
            content: conv.last_message_content,
            created_at: conv.last_message_created_at,
            creator_id: conv.creator_id,
            fan_id: conv.fan_id
          } as ChatMessage : undefined,
          lastMessageAt: (isOptimizedView ? conv.last_message_at : null) || conv.created_at,
          unreadCount: 0, // TODO: Implement unread count
          accessStatus: conv.accessStatus
        };
      });
      
      console.log('✅ Transformed conversations:', conversationItems.length);

      if (mountedRef.current) {
        setConversations(conversationItems);
      }

    } catch (e) {
      if ((e as any).name !== 'AbortError') {
        console.error('Error loading conversations:', e);
        setError(e instanceof Error ? e.message : 'Failed to load conversations');
      }
    } finally {
      finish(); // 🔑 guarantees loading + flags reset on all paths
    }
  }, [authLoading, currentProfile, supabase]); // include deps; no infinite loops because we gate usage

  // Load conversations only when auth state changes
  useEffect(() => {
    let active = true;
    
    console.log('🔄 useEffect triggered:', { 
      authLoading, 
      hasProfile: !!currentProfile, 
      profileId: currentProfile?.id,
      loading 
    });
    
    (async () => {
      if (!authLoading && currentProfile?.id) {
        console.log('✅ Conditions met, calling loadConversations');
        await loadConversations(currentProfile, authLoading);
      } else if (!authLoading && !currentProfile?.id) {
        console.log('⚠️ No profile found, stopping loading');
        if (active) setLoading(false);
      } else {
        console.log('⏳ Waiting for auth or profile...', { authLoading, profileId: currentProfile?.id });
      }
    })();
    
    return () => { active = false; };
  }, [authLoading, currentProfile?.id]); // Remove loadConversations from dependencies to prevent loops

  // Filter conversations based on search
  const filteredConversations = conversations.filter((conv) => {
    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase();
    const otherProfile = currentProfile?.id === conv.creatorId ? conv.fan : conv.creator;
    const searchText = [
      otherProfile.display_name,
      otherProfile.email,
      conv.lastMessage?.content
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return searchText.includes(query);
  });

  // Group conversations by access status
  const activeConversations = filteredConversations.filter(
    (conv) => conv.accessStatus?.hasAccess
  );
  const expiredConversations = filteredConversations.filter(
    (conv) => !conv.accessStatus?.hasAccess
  );

  // Show loading while auth is loading
  if (authLoading) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!currentProfile) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <p className="text-muted-foreground">Please sign in to view your conversations</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full bg-white ${className}`}>
      {/* Search */}
      <div className="p-3">
        <input
          type="search"
          placeholder="Search chats or creators…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border px-3 py-2 typ-body-sm outline-none focus:ring-2 focus:ring-black/10"
        />
      </div>

      {/* Collapsible Sections */}
      <div className="flex-1 overflow-auto px-2 nice-scrollbar">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <p className="text-red-600 typ-body-sm mb-2">Failed to load conversations</p>
              <p className="text-gray-500 typ-caption mb-4">{error}</p>
              <button
                onClick={() => {
                  console.log('🔄 Try Again clicked:', { profileId: currentProfile?.id, authLoading });
                  loadConversations(currentProfile, /* isAuthLoadingOverride */ false);
                }}
                className="px-4 py-2 typ-body-sm bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center max-w-sm">
              <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="font-semibold mb-2">
                {searchQuery ? 'No matching conversations' : 'No chats yet'}
              </h3>
              <p className="text-gray-500 typ-body-sm mb-4">
                {searchQuery
                  ? 'Try adjusting your search terms'
                  : currentProfile.user_type === 'CREATOR'
                  ? 'Conversations will appear here when fans with chat access message you.'
                  : 'You can start conversations with creators once you have chat access.'
                }
              </p>
              {!searchQuery && currentProfile.user_type === 'FAN' && (
                <div className="space-y-2">
                  <p className="typ-caption text-gray-500">
                    To get chat access, you need to make qualifying purchases from creators.
                  </p>
                  <button
                    onClick={() => window.location.href = '/'}
                    className="px-4 py-2 typ-body-sm bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors"
                  >
                    Browse Creators
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Active Chats */}
            {activeConversations.length > 0 && (
              <section className="border-b">
                <button 
                  className="w-full flex items-center justify-between px-3 py-3 hover:bg-gray-50 text-left"
                  onClick={() => setActiveOpen(!activeOpen)}
                >
                  <div className="flex items-center gap-2">
                    <span className="typ-ui font-semibold text-gray-900">Active Chats</span>
                    <span className="typ-caption rounded-full bg-gray-100 px-2 py-0.5 text-gray-700">{activeConversations.length}</span>
                  </div>
                  <ChevronDown className={`h-4 w-4 transition-transform text-gray-600 ${activeOpen ? 'rotate-180' : ''}`} />
                </button>
                {activeOpen && (
                  <div className="pb-2">
                    <ul className="space-y-1">
                      {activeConversations.map((conversation) => (
                        <li key={conversation.id}>
                          <ConversationListItem
                            conversation={conversation}
                            currentProfile={currentProfile}
                            isSelected={selectedConversationId === `${conversation.creatorId}|${conversation.fanId}`}
                            onClick={() =>
                              onSelectConversation?.(
                                conversation.creatorId,
                                conversation.fanId,
                                conversation.creator,
                                conversation.fan
                              )
                            }
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            )}

            {/* Expired Access */}
            {expiredConversations.length > 0 && (
              <section className="border-b">
                <button 
                  className="w-full flex items-center justify-between px-3 py-3 hover:bg-gray-50 text-left"
                  onClick={() => setExpiredOpen(!expiredOpen)}
                >
                  <div className="flex items-center gap-2">
                    <span className="typ-ui font-semibold text-gray-900">Expired Access</span>
                    <span className="typ-caption rounded-full border px-2 py-0.5 text-gray-700">{expiredConversations.length}</span>
                  </div>
                  <ChevronDown className={`h-4 w-4 transition-transform text-gray-600 ${expiredOpen ? 'rotate-180' : ''}`} />
                </button>
                {expiredOpen && (
                  <div className="pb-2">
                    <ul className="space-y-1">
                      {expiredConversations.map((conversation) => (
                        <li key={conversation.id}>
                          <ConversationListItem
                            conversation={conversation}
                            currentProfile={currentProfile}
                            isSelected={selectedConversationId === `${conversation.creatorId}|${conversation.fanId}`}
                            onClick={() =>
                              onSelectConversation?.(
                                conversation.creatorId,
                                conversation.fanId,
                                conversation.creator,
                                conversation.fan
                              )
                            }
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

interface ConversationListItemProps {
  conversation: ConversationItem;
  currentProfile: Profile;
  isSelected: boolean;
  onClick: () => void;
}

function ConversationListItem({
  conversation,
  currentProfile,
  isSelected,
  onClick
}: ConversationListItemProps) {
  const otherProfile = currentProfile.id === conversation.creatorId 
    ? conversation.fan 
    : conversation.creator;

  const conversationTitle = formatConversationTitle(
    currentProfile.id,
    {
      id: conversation.creator.id,
      display_name: conversation.creator.display_name || undefined,
      email: conversation.creator.email
    },
    {
      id: conversation.fan.id,
      display_name: conversation.fan.display_name || undefined,
      email: conversation.fan.email
    }
  );

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 rounded-xl px-2 py-2 w-full text-left transition-colors ${
        isSelected 
          ? 'bg-blue-50 border-2 border-blue-200 shadow-sm' 
          : 'hover:bg-gray-50 border-2 border-transparent'
      }`}
    >
      <div className="relative h-8 w-8 rounded-full bg-gray-200 flex-shrink-0">
        {otherProfile.profile_picture_url ? (
          <img
            src={getBunnyStorageUrl(otherProfile.profile_picture_url)}
            alt={otherProfile.display_name || otherProfile.email}
            className="h-8 w-8 rounded-full object-cover"
            onError={(e) => {
              // Fallback to initials if image fails to load
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent) {
                parent.innerHTML = `<span class="typ-ui text-gray-500 typ-body-sm flex items-center justify-center h-full">${(otherProfile.display_name || otherProfile.email)?.charAt(0)?.toUpperCase() || '?'}</span>`;
              }
            }}
          />
        ) : (
          <span className="typ-ui text-gray-500 typ-body-sm flex items-center justify-center h-full">
            {(otherProfile.display_name || otherProfile.email)?.charAt(0)?.toUpperCase() || '?'}
          </span>
        )}
      </div>
      
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <span className="typ-ui text-gray-900 leading-tight">{conversationTitle}</span>
          {conversation.accessStatus && (
            <div className="flex-shrink-0">
              <ChatAccessStatusBadge status={conversation.accessStatus} />
            </div>
          )}
        </div>
        {conversation.lastMessage ? (
          <p className="truncate typ-caption text-gray-500">
            {conversation.lastMessage.sender_id === currentProfile.id ? 'You: ' : ''}
            {conversation.lastMessage.content}
          </p>
        ) : (
          <p className="truncate typ-caption text-gray-500">No messages yet</p>
        )}
      </div>
    </button>
  );
}
