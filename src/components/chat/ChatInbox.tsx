'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, MessageCircle, Crown, Heart, Clock, CheckCircle2 } from 'lucide-react';
import { ChatAccessStatusBadge } from './ChatAccessStatus';
import { OnlineIndicator } from './TypingIndicator';
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

  // Load conversations
  const loadConversations = useCallback(async () => {
    // Don't load if auth is still loading or no profile
    if (authLoading || !currentProfile?.id) return;

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
        .or(`creator_id.eq.${currentProfile.id},fan_id.eq.${currentProfile.id}`)
        .order('last_message_at', { ascending: false });

      if (conversationsError) {
        console.error('Error loading conversations:', conversationsError);
        throw conversationsError;
      }

      if (!conversationsData || conversationsData.length === 0) {
        console.log('No conversations found, showing empty state');
        setConversations([]);
        return;
      }

      // Get chat access status for each conversation
      const chatAccessPromises = conversationsData.map(async (conv) => {
        try {
          const accessResult = await getUserChatAccess(currentProfile.id, currentProfile.user_type);
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
  }, [currentProfile?.id, authLoading]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

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
    <div className={`flex flex-col h-full bg-background ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-border bg-card">
        <h1 className="text-lg font-semibold mb-3">
          {currentProfile.user_type === 'CREATOR' ? 'Your Chats' : 'Conversations'}
        </h1>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-input rounded-md bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <p className="text-destructive text-sm mb-2">Failed to load conversations</p>
              <p className="text-muted-foreground text-xs mb-4">{error}</p>
              <button
                onClick={loadConversations}
                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center max-w-sm">
              <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold mb-2">
                {searchQuery ? 'No matching conversations' : 'No conversations yet'}
              </h3>
              <p className="text-muted-foreground text-sm mb-4">
                {searchQuery
                  ? 'Try adjusting your search terms'
                  : currentProfile.user_type === 'CREATOR'
                  ? 'Conversations will appear here when fans with chat access message you.'
                  : 'You can start conversations with creators once you have chat access.'
                }
              </p>
              {!searchQuery && currentProfile.user_type === 'FAN' && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    To get chat access, you need to make qualifying purchases from creators.
                  </p>
                  <button
                    onClick={() => window.location.href = '/'}
                    className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                  >
                    Browse Creators
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6 p-4">
            {/* Active conversations */}
            {activeConversations.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <h2 className="font-medium text-sm text-foreground">Active Chats</h2>
                  <span className="text-xs text-muted-foreground">
                    ({activeConversations.length})
                  </span>
                </div>
                <div className="space-y-1">
                  {activeConversations.map((conversation) => (
                    <ConversationListItem
                      key={conversation.id}
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
                  ))}
                </div>
              </div>
            )}

            {/* Expired conversations */}
            {expiredConversations.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="h-4 w-4 text-amber-600" />
                  <h2 className="font-medium text-sm text-foreground">Expired Access</h2>
                  <span className="text-xs text-muted-foreground">
                    ({expiredConversations.length})
                  </span>
                </div>
                <div className="space-y-1">
                  {expiredConversations.map((conversation) => (
                    <ConversationListItem
                      key={conversation.id}
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
                  ))}
                </div>
              </div>
            )}
          </div>
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
    conversation.creator,
    conversation.fan
  );

  return (
    <button
      onClick={onClick}
      className={`w-full p-3 rounded-lg text-left transition-colors hover:bg-accent ${
        isSelected ? 'bg-accent' : ''
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
            {otherProfile.user_type === 'CREATOR' ? (
              <Crown className="h-5 w-5 text-muted-foreground" />
            ) : (
              <Heart className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          {/* Online indicator */}
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background bg-gray-400" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-medium text-sm truncate">{conversationTitle}</h3>
            {conversation.lastMessage && (
              <span className="text-xs text-muted-foreground flex-shrink-0">
                {formatDistanceToNow(new Date(conversation.lastMessage.created_at), {
                  addSuffix: false
                })}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              {conversation.lastMessage ? (
                <p className="text-xs text-muted-foreground truncate">
                  {conversation.lastMessage.sender_id === currentProfile.id ? 'You: ' : ''}
                  {conversation.lastMessage.content}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground italic">No messages yet</p>
              )}
            </div>

            <div className="flex items-center gap-2 ml-2">
              {conversation.unreadCount > 0 && (
                <span className="bg-primary text-primary-foreground text-xs rounded-full px-2 py-0.5 min-w-[1.25rem] text-center">
                  {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
                </span>
              )}
              
              {conversation.accessStatus && (
                <ChatAccessStatusBadge status={conversation.accessStatus} />
              )}
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}
