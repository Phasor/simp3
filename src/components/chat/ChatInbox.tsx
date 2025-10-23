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

  // Safety timeout to prevent infinite loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loading && !authLoading) {
        console.warn('⚠️ Loading timeout reached, forcing loading to false');
        setLoading(false);
        setError('Loading timeout - please refresh the page');
      }
    }, 10000); // 10 second timeout

    return () => clearTimeout(timeout);
  }, [loading, authLoading]);

  // Load conversations
  const loadConversations = useCallback(async (
    profile?: typeof currentProfile,
    isAuthLoadingOverride?: boolean
  ) => {
    const currentAuthLoading = isAuthLoadingOverride ?? authLoading;
    const currentUserProfile = profile ?? currentProfile;

    DEBUG && console.log('🔄 loadConversations called:', {
      profileId: currentUserProfile?.id,
      authLoading: currentAuthLoading,
      hasProfile: !!currentUserProfile
    });

    // Only skip if we truly don't have a profile; allow Try Again to bypass the auth gate
    if (currentAuthLoading && !isAuthLoadingOverride) {
      DEBUG && console.log('⏳ Auth still loading, skipping...');
      return;
    }
    if (!currentUserProfile?.id) {
      DEBUG && console.log('❌ No profile found, stopping loading');
      if (mountedRef.current) {
        setLoading(false);
        setError('You are not signed in.');
      }
      return;
    }

    try {
      if (mountedRef.current) {
        setLoading(true);
        setError(null);
      }

      // Use supabase from context instead of creating new client

      // Get conversations with last messages in one optimized query
      DEBUG && console.log('🔍 Fetching conversations for user:', currentUserProfile.id);
      
      let conversationsData, conversationsError;
      
      // Try the optimized view first
      try {
        const result = await timeout(
          supabase
            .from('conversations_with_last_message')
            .select('*')
            .or(`creator_id.eq.${currentUserProfile.id},fan_id.eq.${currentUserProfile.id}`)
            .order('last_message_at', { ascending: false }),
          5000 // 5 second timeout for the optimized query
        );
        conversationsData = result.data;
        conversationsError = result.error;
        DEBUG && console.log('📊 Optimized conversations query result:', { data: conversationsData, error: conversationsError });
      } catch (error) {
        DEBUG && console.warn('⚠️ Optimized view failed, falling back to basic query:', (error as Error).message);
        
        // Fallback to basic conversations query without the view
        const result = await timeout(
          supabase
            .from('conversations')
            .select(`
              *,
              creator:profiles!conversations_creator_id_fkey(*),
              fan:profiles!conversations_fan_id_fkey(*)
            `)
            .or(`creator_id.eq.${currentUserProfile.id},fan_id.eq.${currentUserProfile.id}`)
            .order('created_at', { ascending: false }),
          5000
        );
        
        conversationsData = result.data;
        conversationsError = result.error;
        DEBUG && console.log('📊 Fallback conversations query result:', { data: conversationsData, error: conversationsError });
      }

      if (conversationsError) {
        console.error('Error loading conversations:', conversationsError);
        throw conversationsError;
      }

      if (!conversationsData || conversationsData.length === 0) {
        if (mountedRef.current) {
          setConversations([]);
          setLoading(false);
        }
        return;
      }

      // Get chat access status for all conversations in one call (optimization)
      let conversationsWithAccess = conversationsData;
      try {
        console.log('🔍 Fetching chat access records for user:', currentUserProfile.id);
        const accessResult = await timeout(
          getUserChatAccess(currentUserProfile.id, currentUserProfile.user_type),
          3000
        );
        console.log('📊 Chat access result:', accessResult);
        
        const accessRecords = accessResult.data || [];
        console.log('📋 Found', accessRecords.length, 'access records');
        
        // Create a map for fast lookup
        const accessMap = new Map<string, any>();
        accessRecords.forEach(access => {
          const key = `${access.creator_id}|${access.fan_id}`;
          accessMap.set(key, access);
        });
        
        // Apply access status to each conversation
        conversationsWithAccess = conversationsData.map(conv => {
          const accessKey = `${conv.creator_id}|${conv.fan_id}`;
          const relevantAccess = accessMap.get(accessKey);
          
          const accessStatus = relevantAccess 
            ? calculateAccessStatus(relevantAccess)
            : {
                hasAccess: false,
                accessUntil: null,
                isExpired: true,
                timeRemaining: 0,
                daysRemaining: 0,
                hoursRemaining: 0,
                minutesRemaining: 0,
                lastQualifyingPurchaseId: null
              } as ChatAccessStatus;

          return {
            ...conv,
            accessStatus
          };
        });
        
        console.log('✅ Applied access status to', conversationsWithAccess.length, 'conversations');
      } catch (error) {
        console.warn('⚠️ Chat access lookup skipped:', (error as Error).message);
        // Apply fallback status to all conversations
        conversationsWithAccess = conversationsData.map(conv => ({
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
          } as ChatAccessStatus
        }));
      }

      // Transform to ConversationItem format (handle both optimized view and fallback formats)
      console.log('🔄 Transforming conversations data');
      const conversationItems: ConversationItem[] = conversationsWithAccess.map((conv: any) => {
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

    } catch (err) {
      console.error('Error loading conversations:', err);
      
      // More specific error handling with better user messaging
      let errorMessage = 'Failed to load conversations';
      
      if (err instanceof Error) {
        if (err.message.includes('column') && err.message.includes('does not exist')) {
          errorMessage = 'Database schema mismatch. Please contact support.';
        } else if (err.message.includes('timeout') || err.message.includes('TIMEOUT')) {
          errorMessage = 'Request timed out. Please check your connection and try again.';
        } else if (err.message.includes('network') || err.message.includes('fetch')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        } else if (err.message.includes('unauthorized') || err.message.includes('401')) {
          errorMessage = 'Authentication error. Please refresh the page and sign in again.';
        } else {
          errorMessage = `Error: ${err.message}`;
        }
      }
      
      if (mountedRef.current) {
        setError(errorMessage);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
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
