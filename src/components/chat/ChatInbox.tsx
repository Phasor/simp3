'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { MessageCircle, ChevronDown, Unlock } from 'lucide-react';
import { getBunnyStorageUrl } from '@/lib/utils/bunnynet';
import { ChatAccessStatusBadge } from './ChatAccessStatus';
import { useAuth } from '@/lib/contexts/AuthContext';
import { formatConversationTitle } from '@/lib/utils/conversationUtils';
import type { Profile } from '@/lib/types/database';
import type { ConversationItem, ConversationServer } from '@/lib/types/chat';
import { toConversationItem } from '@/lib/types/chat';

const INBOX_CACHE_KEY = 'chat:inbox:conversations-cache';
const DEBUG = process.env.NEXT_PUBLIC_DEBUG === '1';

interface ChatInboxProps {
  onSelectConversation?: (creatorId: string, fanId: string, creatorProfile: Profile, fanProfile: Profile) => void;
  selectedConversationId?: string;
  className?: string;
  initialConversations?: ConversationServer[];
  initialUserId?: string;
}

export function ChatInbox({
  onSelectConversation,
  selectedConversationId,
  className = '',
  initialConversations = [],
  initialUserId,
}: ChatInboxProps) {
  const { profile: currentProfile, loading: authLoading, resolved: authResolved, supabase } = useAuth();

  // Use the server-provided profileId as an immediate fallback — avoids spinning
  // while the async client-side profile fetch is in flight
  const profileId = currentProfile?.id ?? initialUserId;

  // --- state ---
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [vipDoms, setVipDoms] = useState<Profile[]>([]);
  const [startingDomId, setStartingDomId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeOpen, setActiveOpen] = useState(true);
  const [expiredOpen, setExpiredOpen] = useState(false);

  // --- refs ---
  const mountedRef = useRef(false);
  const requestIdRef = useRef(0);

  // Map server row to ConversationItem with access status already included
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRowToItem = useCallback((row: any): ConversationItem => {
    // Debug: log raw row to see what fields we have
    if (DEBUG) {
      console.log('[ChatInbox] Raw row:', {
        id: row.id,
        last_message_preview: row.last_message_preview,
        last_message_at: row.last_message_at,
        has_access: row.has_access,
        seconds_remaining: row.seconds_remaining
      });
    }
    
    const item = toConversationItem(row);
    
    // If toConversationItem didn't find a lastMessage but we have last_message_preview, create one
    if (!item.lastMessage && row.last_message_preview) {
      item.lastMessage = {
        id: row.last_message_id ?? '',
        sender_id: '', // Not available in preview
        content: row.last_message_preview,
        created_at: row.last_message_at ?? row.created_at,
        creator_id: row.creator_id,
        fan_id: row.fan_id,
        is_locked: false,
        ppv_price_cents: null,
        media_id: null,
        comped_by_creator: null,
      };
    }
    
    const secondsRemaining = Math.max(Number(row.seconds_remaining ?? 0), 0);
    const daysRemaining = Math.floor(secondsRemaining / 86400);
    const hoursRemaining = Math.floor((secondsRemaining % 86400) / 3600);
    const minutesRemaining = Math.floor((secondsRemaining % 3600) / 60);
    
    item.accessStatus = {
      hasAccess: !!row.has_access,
      accessUntil: row.access_until ?? null,
      isExpired: !row.has_access,
      timeRemaining: secondsRemaining,
      daysRemaining,
      hoursRemaining,
      minutesRemaining,
      lastQualifyingPurchaseId: null,
    };
    return item;
  }, []);

  // 1) Mount tracking
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // 2) Seed from SSR immediately (access status already included!)
  useEffect(() => {
    if (!authResolved || !profileId) return;
    if (conversations.length > 0) return; // Already seeded

    if (initialConversations.length) {
      console.log('[ChatInbox] 🌱 SSR seed - raw data sample:', initialConversations[0]);
      const items = initialConversations.map(mapRowToItem);
      try {
        sessionStorage.setItem(INBOX_CACHE_KEY, JSON.stringify({ userId: profileId, items }));
      } catch {}
      setConversations(items);
      console.log('🪄 Seeded from SSR:', items.length, 'conversations');
    }

    // Always mark ready once auth resolves — background fetch will populate if needed
    setIsReady(true);
  }, [authResolved, profileId, initialConversations, conversations.length, mapRowToItem]);

  // 3) Background revalidate with request deduplication
  const loadConversations = useCallback(async () => {
    if (!authResolved || !profileId) return;

    const thisRequestId = ++requestIdRef.current;
    DEBUG && console.log(`[ChatInbox] 🔄 Starting revalidate (request #${thisRequestId})`);

    try {
      // Fetch from view - single query with access status!
      const { data, error } = await supabase
        .from('conversations_inbox')
        .select(`*,
          creator:profiles!conversations_creator_id_fkey(*),
          fan:profiles!conversations_fan_id_fkey(*)
        `)
        .or(`creator_id.eq.${profileId},fan_id.eq.${profileId}`)
        .order('created_at', { ascending: false });

      // Ignore stale responses
      if (requestIdRef.current !== thisRequestId) {
        DEBUG && console.log(`[ChatInbox] ⏭️ Ignoring stale response (request #${thisRequestId})`);
        return;
      }

      if (error) throw error;
      if (!mountedRef.current) return;

      const rows = data ?? [];
      const items = rows.map(mapRowToItem);

      // Write cache BEFORE state
      try {
        sessionStorage.setItem(INBOX_CACHE_KEY, JSON.stringify({ userId: profileId, items }));
      } catch {}

      if (!mountedRef.current) return;
      setConversations(items);
      setIsReady(true);
      DEBUG && console.log('✅ Revalidate complete:', items.length, 'conversations');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      if (!mountedRef.current) return;
      console.error('[ChatInbox] Revalidate error:', e);
      setError(e?.message ?? 'Failed to load conversations');
      setIsReady(true); // fail-open
    }
  }, [authResolved, profileId, supabase, mapRowToItem]);

  // 4) Trigger background revalidate when ready
  useEffect(() => {
    if (!authResolved || !profileId) return;

    DEBUG && console.log('[ChatInbox] Triggering background revalidate');
    loadConversations();
  }, [authResolved, profileId, loadConversations]);

  // 5) Fetch VIP-accessible doms via API (service role — no RLS timing issues)
  const loadVipDoms = useCallback(async () => {
    if (!authResolved || !profileId) return;
    try {
      const res = await fetch('/api/chat/vip-doms');
      const json = await res.json();
      setVipDoms(json.doms ?? []);
    } catch (err) {
      console.error('[ChatInbox] loadVipDoms error:', err);
    }
  }, [authResolved, profileId]);

  useEffect(() => {
    loadVipDoms();
  }, [loadVipDoms]);

  // Start a conversation with a VIP-accessible dom
  const handleStartChat = useCallback(async (dom: Profile) => {
    setStartingDomId(dom.id);
    try {
      const res = await fetch('/api/chat/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domId: dom.id }),
      });
      const json = await res.json();
      if (!res.ok) {
        console.error('[ChatInbox] handleStartChat API error:', json);
        throw new Error(json.error ?? 'Failed to start conversation');
      }

      // Open the conversation — use currentProfile for fan (already loaded, no extra query)
      onSelectConversation?.(dom.id, profileId!, dom, currentProfile ?? dom);
    } catch (err) {
      console.error('[ChatInbox] handleStartChat error:', err);
    } finally {
      setStartingDomId(null);
    }
  }, [profileId, supabase, onSelectConversation]);

  // Derive VIP doms that don't yet have a conversation — computed at render time
  const existingDomIds = new Set(conversations.map(c => c.creatorId));
  const vipDomsWithoutConversation = vipDoms.filter(p => !existingDomIds.has(p.id));

  // Filter conversations
  const filteredConversations = conversations.filter((conv) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const otherProfile = profileId === conv.creatorId ? conv.fan : conv.creator;
    const searchText = [
      otherProfile.display_name,
      otherProfile.email,
      conv.lastMessage?.content
    ].filter(Boolean).join(' ').toLowerCase();
    return searchText.includes(query);
  });

  // Group by access
  const activeConversations = filteredConversations.filter(c => c.accessStatus?.hasAccess);
  const expiredConversations = filteredConversations.filter(c => !c.accessStatus?.hasAccess);

  // 4) render branch: fail-open on conversations present
  const ready = isReady || conversations.length > 0;
  if (authLoading || !authResolved) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  if (!ready) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show error
  if (error && conversations.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center h-full ${className} p-4`}>
        <p className="text-red-600 mb-2">Failed to load conversations</p>
        <p className="text-gray-500 text-sm">{error}</p>
      </div>
    );
  }

  // Show empty state (but may still have VIP doms to start conversations with)
  if (filteredConversations.length === 0) {
    return (
      <div className={`flex flex-col h-full bg-white ${className}`}>
        <div className="p-3">
          <input
            type="search"
            placeholder="Search chats…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 typ-body-sm outline-none focus:ring-2 focus:ring-black/10"
          />
        </div>
        {vipDomsWithoutConversation.length > 0 ? (
          <VipDomsSection vipDoms={vipDomsWithoutConversation} startingDomId={startingDomId} onStart={handleStartChat} />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-sm p-4">
              <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="font-semibold mb-2">
                {searchQuery ? 'No matching conversations' : 'No chats yet'}
              </h3>
              <p className="text-gray-500 typ-body-sm">
                {searchQuery
                  ? 'Try adjusting your search terms'
                  : currentProfile?.user_type === 'CREATOR'
                  ? 'Conversations will appear here when subs with chat access message you.'
                  : 'Complete tasks to earn VIP chat access.'
                }
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Show conversations!
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

      {/* VIP doms without a conversation yet */}
      {vipDomsWithoutConversation.length > 0 && (
        <VipDomsSection vipDoms={vipDomsWithoutConversation} startingDomId={startingDomId} onStart={handleStartChat} />
      )}

      {/* Conversations */}
      <div className="flex-1 overflow-auto px-2 nice-scrollbar">
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
                        currentProfileId={profileId ?? ''}
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
                        currentProfileId={profileId ?? ''}
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
      </div>
    </div>
  );
}

// ---------- VIP Doms Section ----------

interface VipDomsSectionProps {
  vipDoms: Profile[];
  startingDomId: string | null;
  onStart: (dom: Profile) => void;
}

function VipDomsSection({ vipDoms, startingDomId, onStart }: VipDomsSectionProps) {
  return (
    <div className="border-b">
      <div className="flex items-center gap-2 px-4 py-3">
        <Unlock className="h-4 w-4 text-amber-500" />
        <span className="typ-ui font-semibold text-gray-900">VIP Access</span>
        <span className="typ-caption rounded-full bg-amber-100 text-amber-700 px-2 py-0.5">{vipDoms.length}</span>
      </div>
      <ul className="pb-2 space-y-1 px-2">
        {vipDoms.map((dom) => {
          const isStarting = startingDomId === dom.id;
          return (
            <li key={dom.id}>
              <button
                onClick={() => onStart(dom)}
                disabled={isStarting}
                className="flex items-center gap-3 rounded-xl px-2 py-2 w-full text-left hover:bg-amber-50 border-2 border-transparent hover:border-amber-200 transition-colors disabled:opacity-60"
              >
                <div className="relative h-8 w-8 rounded-full bg-amber-100 flex-shrink-0 flex items-center justify-center">
                  {dom.profile_picture_url ? (
                    <img
                      src={getBunnyStorageUrl(dom.profile_picture_url)}
                      alt={dom.display_name || dom.email}
                      className="h-8 w-8 rounded-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <span className="typ-body-sm text-amber-700 font-semibold">
                      {(dom.display_name || dom.email)?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="typ-ui text-gray-900 leading-tight">{dom.display_name || dom.handle || dom.email}</p>
                  <p className="typ-caption text-amber-600">{isStarting ? 'Opening…' : 'Tap to start chatting'}</p>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------- Conversation List Item ----------

interface ConversationListItemProps {
  conversation: ConversationItem;
  currentProfileId: string;
  isSelected: boolean;
  onClick: () => void;
}

function ConversationListItem({
  conversation,
  currentProfileId,
  isSelected,
  onClick
}: ConversationListItemProps) {
  const otherProfile = currentProfileId === conversation.creatorId
    ? conversation.fan
    : conversation.creator;

  const conversationTitle = formatConversationTitle(
    currentProfileId,
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
            {conversation.lastMessage.sender_id === currentProfileId ? 'You: ' : ''}
            {conversation.lastMessage.content}
          </p>
        ) : (
          <p className="truncate typ-caption text-gray-500">No messages yet</p>
        )}
      </div>
    </button>
  );
}
