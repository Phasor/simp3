'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserChatAccess } from '@/hooks/useChatAccess';
import { calculateAccessStatus } from '@/lib/chatAccess';
import { createSupabaseBrowser } from '@simp2/shared';
import { MessageCircle, Clock, CheckCircle, XCircle, Search, Settings } from 'lucide-react';
import type { Tables } from '@simp2/shared';

type Profile = Tables<'profiles'>;
type ChatMessage = Tables<'chat_messages'>;

interface ChatConversation {
  id: string;
  creator_id: string;
  fan_id: string;
  creator?: Profile;
  fan?: Profile;
  last_message_preview?: string;
  last_message_at?: string;
  message_count: number;
  hasAccess: boolean;
  accessStatus: 'active' | 'expired' | 'none';
  accessExpiresAt?: string;
}

interface ChatInboxProps {
  selectedConversationId?: string;
  onSelectConversation: (creatorId: string, fanId: string) => void;
  className?: string;
}

export function ChatInbox({ selectedConversationId, onSelectConversation, className = '' }: ChatInboxProps) {
  const { profile, isCreator } = useAuth();
  const { chatAccess, loading: accessLoading, refreshChatAccess } = useUserChatAccess();
  
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadConversations = useCallback(async () => {
    if (!profile?.id) return;

    try {
      setLoading(true);
      setError(null);
      
      const supabase = createSupabaseBrowser();

      // Get conversations based on user type using the conversations table
      let conversationsQuery;
      
      if (isCreator) {
        // For creators: get all conversations where they are the creator
        conversationsQuery = supabase
          .from('conversations')
          .select('id, creator_id, fan_id, last_message_preview, last_message_at, message_count')
          .eq('creator_id', profile.id)
          .order('last_message_at', { ascending: false })
          .limit(50);
      } else {
        // For fans: get conversations where they are the fan
        conversationsQuery = supabase
          .from('conversations')
          .select('id, creator_id, fan_id, last_message_preview, last_message_at, message_count')
          .eq('fan_id', profile.id)
          .order('last_message_at', { ascending: false })
          .limit(50);
      }

      const { data: conversations, error: conversationsError } = await conversationsQuery;

      if (conversationsError) {
        throw conversationsError;
      }

      // Handle empty conversations array
      if (!conversations || conversations.length === 0) {
        if (!isCreator) {
          // For fans with no conversations, show available creators from chat_access
          const conversationList: ChatConversation[] = [];
          
          for (const access of chatAccess) {
            const status = calculateAccessStatus(access);
            
            // Get creator profile
            const { data: creatorProfile, error: profileError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', access.creator_id)
              .single();
              
            if (!profileError && creatorProfile) {
              conversationList.push({
                id: `${access.creator_id}|${profile.id}`,
                creator_id: access.creator_id,
                fan_id: profile.id,
                creator: creatorProfile,
                fan: profile,
                last_message_preview: undefined, // No messages yet
                last_message_at: undefined,
                message_count: 0,
                hasAccess: status.hasAccess,
                accessStatus: status.hasAccess ? 'active' : 'expired',
                accessExpiresAt: access.expires_at
              });
            }
          }
          
          setConversations(conversationList);
          return;
        } else {
          // Creators with no conversations show empty list
          setConversations([]);
          return;
        }
      }

      // Get unique user IDs to fetch profiles
      const userIds = new Set<string>();
      conversations?.forEach(conv => {
        userIds.add(conv.creator_id);
        userIds.add(conv.fan_id);
      });

      // Fetch all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', Array.from(userIds));

      if (profilesError) {
        throw profilesError;
      }

      const profileMap = new Map<string, Profile>();
      profiles?.forEach(profile => {
        profileMap.set(profile.id, profile);
      });

      // Convert to conversation objects with profiles and access status
      const conversationList: ChatConversation[] = [];
      
      conversations?.forEach(conv => {
        // Calculate access status
        let hasAccess = false;
        let accessStatus: 'active' | 'expired' | 'none' = 'none';
        let accessExpiresAt: string | undefined;

        if (isCreator) {
          // Creators always have access to their conversations
          hasAccess = true;
          accessStatus = 'active';
        } else {
          // For fans, check chat access
          const access = chatAccess.find(a => a.creator_id === conv.creator_id);
          if (access) {
            const status = calculateAccessStatus(access);
            hasAccess = status.hasAccess;
            accessStatus = status.hasAccess ? 'active' : 'expired';
            accessExpiresAt = access.expires_at;
          }
        }

        conversationList.push({
          id: conv.id,
          creator_id: conv.creator_id,
          fan_id: conv.fan_id,
          creator: profileMap.get(conv.creator_id),
          fan: profileMap.get(conv.fan_id),
          last_message_preview: conv.last_message_preview,
          last_message_at: conv.last_message_at,
          message_count: conv.message_count,
          hasAccess,
          accessStatus,
          accessExpiresAt
        });
      });

      // For fans, also add creators they have access to but haven't messaged yet
      if (!isCreator) {
        for (const access of chatAccess) {
          const existingConversation = conversationList.find(c => c.creator_id === access.creator_id);
          
          if (!existingConversation) {
            const status = calculateAccessStatus(access);
            
            // Get creator profile if not already loaded
            let creatorProfile = profileMap.get(access.creator_id);
            if (!creatorProfile) {
              const { data: fetchedProfile, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', access.creator_id)
                .single();
                
              if (!profileError && fetchedProfile) {
                creatorProfile = fetchedProfile;
              }
            }
            
            if (creatorProfile) {
              conversationList.push({
                id: `${access.creator_id}|${profile.id}`,
                creator_id: access.creator_id,
                fan_id: profile.id,
                creator: creatorProfile,
                fan: profile,
                last_message_preview: undefined, // No messages yet
                last_message_at: undefined,
                message_count: 0,
                hasAccess: status.hasAccess,
                accessStatus: status.hasAccess ? 'active' : 'expired',
                accessExpiresAt: access.expires_at
              });
            }
          }
        }
        
        // Re-sort after adding new conversations (conversations without messages go to bottom)
        conversationList.sort((a, b) => {
          const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
          const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
          return bTime - aTime;
        });
      }

      setConversations(conversationList);
    } catch (err) {
      console.error('Error loading conversations:', err);
      setError(err instanceof Error ? err.message : 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  }, [profile?.id, isCreator, chatAccess]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Filter conversations based on search query
  const filteredConversations = conversations.filter(conversation => {
    if (!searchQuery) return true;
    
    const otherProfile = isCreator ? conversation.fan : conversation.creator;
    const name = otherProfile?.display_name || otherProfile?.email || '';
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const formatLastMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else if (diffInHours < 168) { // 7 days
      return `${Math.floor(diffInHours / 24)}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const getAccessStatusIcon = (status: 'active' | 'expired' | 'none') => {
    switch (status) {
      case 'active':
        return (
          <div className="flex h-3 w-3 items-center justify-center rounded-full bg-green-500 ring-2 ring-background">
            <div className="h-1.5 w-1.5 rounded-full bg-white" />
          </div>
        );
      case 'expired':
        return (
          <div className="flex h-3 w-3 items-center justify-center rounded-full bg-yellow-500 ring-2 ring-background">
            <div className="h-1.5 w-1.5 rounded-full bg-white" />
          </div>
        );
      case 'none':
        return (
          <div className="flex h-3 w-3 items-center justify-center rounded-full bg-red-500 ring-2 ring-background">
            <div className="h-1.5 w-1.5 rounded-full bg-white" />
          </div>
        );
    }
  };

  if (loading && conversations.length === 0) {
    return (
      <div className={`flex flex-col h-full bg-background ${className}`}>
        <div className="p-6 border-b border-border/50 bg-card/50 backdrop-blur-sm">
          <h1 className="text-xl font-semibold tracking-tight">Messages</h1>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
            <p className="text-sm text-muted-foreground">Loading conversations...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full bg-background ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold tracking-tight">Messages</h1>
          {isCreator ? (
            <a
              href="/creator/dashboard"
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:bg-accent hover:text-accent-foreground h-9 w-9"
              title="Creator Dashboard"
            >
              <Settings className="h-4 w-4" />
            </a>
          ) : (
            <button
              onClick={() => {
                refreshChatAccess();
                loadConversations();
              }}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 w-9"
              disabled={loading}
              title="Refresh conversations"
            >
              <Settings className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pl-10 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        {error && (
          <div className="mx-4 mt-4 rounded-lg border border-destructive/20 bg-destructive/10 p-3">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-destructive" />
              <p className="text-sm font-medium text-destructive">{error}</p>
            </div>
          </div>
        )}

        {filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-muted">
              <MessageCircle className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">No conversations yet</h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-sm">
              {isCreator 
                ? 'Fans will appear here when they start chatting with you.'
                : 'Start a conversation by purchasing content from creators.'
              }
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {filteredConversations.map((conversation) => {
              const otherProfile = isCreator ? conversation.fan : conversation.creator;
              const isSelected = selectedConversationId === conversation.id;
              
              return (
                <button
                  key={conversation.id}
                  onClick={() => onSelectConversation(conversation.creator_id, conversation.fan_id)}
                  className={`w-full p-4 text-left transition-all duration-200 hover:bg-accent/50 ${
                    isSelected ? 'bg-accent border-r-2 border-primary' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="relative">
                      {otherProfile?.profile_picture_url ? (
                        <img
                          src={otherProfile.profile_picture_url}
                          alt={otherProfile.display_name || otherProfile.email}
                          className="h-12 w-12 rounded-full object-cover ring-2 ring-background"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                            if (fallback) fallback.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div 
                        className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/80 text-primary-foreground text-sm font-semibold ring-2 ring-background"
                        style={{ display: otherProfile?.profile_picture_url ? 'none' : 'flex' }}
                      >
                        {(otherProfile?.display_name || otherProfile?.email || 'U')
                          .split(' ')
                          .map(name => name[0])
                          .join('')
                          .toUpperCase()
                          .slice(0, 2)}
                      </div>
                      
                      {/* Status indicator */}
                      <div className="absolute -bottom-0.5 -right-0.5">
                        {getAccessStatusIcon(conversation.accessStatus)}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-semibold text-sm truncate">
                          {otherProfile?.display_name || otherProfile?.email || 'Unknown User'}
                        </h3>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {conversation.last_message_at && (
                            <span className="text-xs text-muted-foreground font-medium">
                              {formatLastMessageTime(conversation.last_message_at)}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {conversation.last_message_preview ? (
                        <p className="text-sm text-muted-foreground truncate leading-relaxed">
                          {conversation.last_message_preview}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">
                          {conversation.hasAccess ? 'Start a conversation...' : 'Chat access required'}
                        </p>
                      )}
                      
                      <div className="flex items-center justify-between mt-2">
                        {!conversation.hasAccess && conversation.accessStatus === 'expired' && (
                          <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800">
                            Access expired
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
