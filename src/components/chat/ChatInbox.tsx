'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, MessageCircle, Crown, Heart, Clock, CheckCircle2, ChevronDown } from 'lucide-react';
import { getBunnyStorageUrl } from '@/lib/utils/bunnynet';
import { ChatAccessStatusBadge } from './ChatAccessStatus';
import { OnlineIndicator, PresenceAvatar } from './TypingIndicator';
import { useAuth } from '@/lib/contexts/AuthContext';
import { ChatAccessStatus } from '@/lib/utils/chatAccess';
import { getUserChatAccess, calculateAccessStatus } from '@/lib/utils/chatAccess';
import { formatConversationTitle } from '@/lib/utils/conversationUtils';
import { createClient } from '@/lib/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import type { Profile, ChatAccess, ChatMessage } from '@/lib/types/database';

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
  const { profile: currentProfile, loading: authLoading } = useAuth();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeOpen, setActiveOpen] = useState(true);
  const [expiredOpen, setExpiredOpen] = useState(false);

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
  const loadConversations = useCallback(async (profile?: typeof currentProfile, isAuthLoading?: boolean) => {
    const currentAuthLoading = isAuthLoading ?? authLoading;
    const currentUserProfile = profile ?? currentProfile;
    
    // Don't load if auth is still loading
    if (currentAuthLoading) {
      return;
    }
    
    // If auth is done but no profile, stop loading
    if (!currentUserProfile?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const supabase = createClient();

      // Get conversations where current user is either creator or fan
      const { data: conversationsData, error: conversationsError } = await supabase
        .from('conversations')
        .select(`
          id,
          creator_id,
          fan_id,
          last_message_at,
          created_at,
          creator:profiles!conversations_creator_id_fkey(
            id,
            email,
            display_name,
            user_type,
            profile_picture_url
          ),
          fan:profiles!conversations_fan_id_fkey(
            id,
            email,
            display_name,
            user_type,
            profile_picture_url
          )
        `)
        .or(`creator_id.eq.${currentUserProfile.id},fan_id.eq.${currentUserProfile.id}`)
        .order('last_message_at', { ascending: false });

      if (conversationsError) {
        console.error('Error loading conversations:', conversationsError);
        throw conversationsError;
      }

      if (!conversationsData || conversationsData.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      // Get chat access status for each conversation
      const chatAccessPromises = conversationsData.map(async (conv) => {
        try {
          const accessResult = await getUserChatAccess(currentUserProfile.id, currentUserProfile.user_type);
          const accessRecords = accessResult.data || [];
          const relevantAccess = accessRecords.find(
            (access) => access.creator_id === conv.creator_id && access.fan_id === conv.fan_id
          );
          
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
        } catch (error) {
          console.warn('Failed to get access status for conversation:', conv.id, error);
          const fallbackStatus: ChatAccessStatus = {
            hasAccess: false,
            accessUntil: null,
            isExpired: true,
            timeRemaining: 0,
            daysRemaining: 0,
            hoursRemaining: 0,
            minutesRemaining: 0,
            lastQualifyingPurchaseId: null
          };
          return {
            ...conv,
            accessStatus: fallbackStatus
          };
        }
      });

      const conversationsWithAccess = await Promise.all(chatAccessPromises);

      // Get last messages for each conversation
      const lastMessagePromises = conversationsWithAccess.map(async (conv) => {
        try {
          const { data: lastMessageData } = await supabase
            .from('chat_messages')
            .select('*')
            .eq('creator_id', conv.creator_id)
            .eq('fan_id', conv.fan_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          return {
            ...conv,
            lastMessage: lastMessageData || undefined
          };
        } catch (error) {
          // No last message is fine
          return conv;
        }
      });

      const conversationsWithMessages = await Promise.all(lastMessagePromises);

      // Transform to ConversationItem format
      const conversationItems: ConversationItem[] = conversationsWithMessages.map((conv) => ({
        id: conv.id,
        creatorId: conv.creator_id,
        fanId: conv.fan_id,
        creator: conv.creator as unknown as Profile,
        fan: conv.fan as unknown as Profile,
        lastMessage: (conv as unknown as { lastMessage?: ChatMessage }).lastMessage,
        lastMessageAt: conv.last_message_at || conv.created_at,
        unreadCount: 0, // TODO: Implement unread count
        accessStatus: conv.accessStatus
      }));

      setConversations(conversationItems);

    } catch (err) {
      console.error('Error loading conversations:', err);
      // More specific error handling
      if (err instanceof Error) {
        if (err.message.includes('column') && err.message.includes('does not exist')) {
          setError('Database schema mismatch. Please contact support.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Failed to load conversations');
      }
    } finally {
      setLoading(false);
    }
  }, []); // Remove dependencies to prevent infinite loops

  // Load conversations only when auth state changes
  useEffect(() => {
    if (!authLoading && currentProfile?.id) {
      loadConversations(currentProfile, authLoading);
    } else if (!authLoading && !currentProfile?.id) {
      setLoading(false);
    }
  }, [authLoading, currentProfile?.id, loadConversations]); // Include loadConversations since it's stable now

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
          className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
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
              <p className="text-red-600 text-sm mb-2">Failed to load conversations</p>
              <p className="text-gray-500 text-xs mb-4">{error}</p>
              <button
                onClick={loadConversations}
                className="px-4 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors"
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
              <p className="text-gray-500 text-sm mb-4">
                {searchQuery
                  ? 'Try adjusting your search terms'
                  : currentProfile.user_type === 'CREATOR'
                  ? 'Conversations will appear here when fans with chat access message you.'
                  : 'You can start conversations with creators once you have chat access.'
                }
              </p>
              {!searchQuery && currentProfile.user_type === 'FAN' && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500">
                    To get chat access, you need to make qualifying purchases from creators.
                  </p>
                  <button
                    onClick={() => window.location.href = '/'}
                    className="px-4 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors"
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
                  className="w-full flex items-center justify-between px-2 py-3"
                  onClick={() => setActiveOpen(!activeOpen)}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Active Chats</span>
                    <span className="text-xs rounded-full bg-gray-100 px-2 py-0.5">{activeConversations.length}</span>
                  </div>
                  <ChevronDown className={`h-4 w-4 transition-transform ${activeOpen ? 'rotate-180' : ''}`} />
                </button>
                {activeOpen && (
                  <div className="pb-2">
                    <ul className="space-y-1">
                      {activeConversations.map((conversation) => (
                        <li key={conversation.id}>
                          <ConversationListItem
                            conversation={conversation}
                            currentProfile={currentProfile}
                            isSelected={selectedConversationId === conversation.id}
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
                  className="w-full flex items-center justify-between px-2 py-3"
                  onClick={() => setExpiredOpen(!expiredOpen)}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Expired Access</span>
                    <span className="text-xs rounded-full border px-2 py-0.5">{expiredConversations.length}</span>
                  </div>
                  <ChevronDown className={`h-4 w-4 transition-transform ${expiredOpen ? 'rotate-180' : ''}`} />
                </button>
                {expiredOpen && (
                  <div className="pb-2">
                    <ul className="space-y-1">
                      {expiredConversations.map((conversation) => (
                        <li key={conversation.id}>
                          <ConversationListItem
                            conversation={conversation}
                            currentProfile={currentProfile}
                            isSelected={selectedConversationId === conversation.id}
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
      className={`flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-gray-50 w-full text-left transition-colors ${
        isSelected ? 'bg-gray-100' : ''
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
              console.log('🖼️ Profile picture failed to load:', {
                originalUrl: otherProfile.profile_picture_url,
                processedUrl: getBunnyStorageUrl(otherProfile.profile_picture_url),
                displayName: otherProfile.display_name,
                email: otherProfile.email
              });
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent) {
                parent.innerHTML = `<span class="font-medium text-gray-500 text-sm flex items-center justify-center h-full">${(otherProfile.display_name || otherProfile.email)?.charAt(0)?.toUpperCase() || '?'}</span>`;
              }
            }}
          />
        ) : (
          <span className="font-medium text-gray-500 text-sm flex items-center justify-center h-full">
            {(otherProfile.display_name || otherProfile.email)?.charAt(0)?.toUpperCase() || '?'}
          </span>
        )}
      </div>
      
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium">{conversationTitle}</span>
          {conversation.accessStatus && (
            <ChatAccessStatusBadge status={conversation.accessStatus} />
          )}
        </div>
        {conversation.lastMessage ? (
          <p className="truncate text-xs text-gray-500">
            {conversation.lastMessage.sender_id === currentProfile.id ? 'You: ' : ''}
            {conversation.lastMessage.content}
          </p>
        ) : (
          <p className="truncate text-xs text-gray-500">No messages yet</p>
        )}
      </div>
    </button>
  );
}
