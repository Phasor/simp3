// Shared types for chat functionality
import type { ChatAccessStatus } from '@/lib/utils/chatAccess';
import type * as DB from '@/lib/types/database';

// What your UI ultimately needs
export interface ConversationItem {
  id: string;
  creatorId: string;
  fanId: string;
  creator: DB.Profile;
  fan: DB.Profile;
  lastMessage?: DB.ChatMessage;
  lastMessageAt: string;
  unreadCount: number;
  accessStatus?: ChatAccessStatus;
}

/** The "nested objects" server shape */
export interface ConversationNested {
  id: string;
  creator_id: string;
  fan_id: string;
  created_at: string;
  creator?: DB.Profile | null;
  fan?: DB.Profile | null;
  // sometimes present in nested shape
  lastMessage?: DB.ChatMessage | null;
  last_message_at?: string | null;
}

/** The "optimized join" flattened server shape */
export interface ConversationOptimized {
  id: string;
  creator_id: string;
  fan_id: string;
  created_at: string;

  // joined creator fields
  creator_id_join: string;
  creator_email: string | null;
  creator_display_name: string | null;
  creator_user_type: string | null;
  creator_ppu: string | null;

  // joined fan fields
  fan_id_join: string;
  fan_email: string | null;
  fan_display_name: string | null;
  fan_user_type: string | null;
  fan_ppu: string | null;

  // last message fields (may be missing)
  last_message_id?: string;
  last_message_sender_id?: string;
  last_message_content?: string | null;
  last_message_created_at?: string;
  last_message_at?: string | null;
}

export type ConversationServer = ConversationNested | ConversationOptimized;

// Type guard
export function isOptimizedConversation(
  conv: unknown
): conv is ConversationOptimized {
  return !!conv && typeof conv === 'object' && 'creator_id_join' in (conv as ConversationOptimized);
}

// Normalizer
export function toConversationItem(conv: ConversationServer): ConversationItem {
  if (isOptimizedConversation(conv)) {
    const lastMessage: DB.ChatMessage | undefined =
      conv.last_message_id
        ? {
            id: conv.last_message_id,
            sender_id: conv.last_message_sender_id ?? '',
            content: conv.last_message_content ?? '',
            created_at: conv.last_message_created_at ?? conv.created_at,
            creator_id: conv.creator_id,
            fan_id: conv.fan_id,
            is_locked: false,
            ppv_price_cents: null,
            media_id: null,
            comped_by_creator: null,
          }
        : undefined;

    return {
      id: conv.id,
      creatorId: conv.creator_id,
      fanId: conv.fan_id,
      creator: {
        id: conv.creator_id_join,
        auth_user_id: '',
        email: conv.creator_email ?? '',
        created_at: conv.created_at,
        user_type: (conv.creator_user_type as 'CREATOR' | 'FAN') ?? 'CREATOR',
        onboarding_completed: true,
        display_name: conv.creator_display_name,
        profile_picture_url: conv.creator_ppu,
        banner_image_url: null,
        about_text: null,
        handle: null, wallet_address: null, age_verified: null, age_verified_at: null,
        tribute_alias: null, vip_cta_text: null, tagline: null, kyc_status: null,
      },
      fan: {
        id: conv.fan_id_join,
        auth_user_id: '',
        email: conv.fan_email ?? '',
        created_at: conv.created_at,
        user_type: (conv.fan_user_type as 'CREATOR' | 'FAN') ?? 'FAN',
        onboarding_completed: true,
        display_name: conv.fan_display_name,
        profile_picture_url: conv.fan_ppu,
        banner_image_url: null,
        about_text: null,
        handle: null, wallet_address: null, age_verified: null, age_verified_at: null,
        tribute_alias: null, vip_cta_text: null, tagline: null, kyc_status: null,
      },
      lastMessage,
      lastMessageAt: (conv.last_message_at ?? conv.created_at),
      unreadCount: 0,
      accessStatus: undefined,
    };
  }

  // Nested variant
  return {
    id: conv.id,
    creatorId: conv.creator_id,
    fanId: conv.fan_id,
    creator: conv.creator ?? ({} as DB.Profile),
    fan: conv.fan ?? ({} as DB.Profile),
    lastMessage: conv.lastMessage ?? undefined,
    lastMessageAt: (conv.last_message_at ?? conv.created_at),
    unreadCount: 0,
    accessStatus: undefined,
  };
}

