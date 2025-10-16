/**
 * Utility functions for handling conversation IDs and chat-related operations
 */

/**
 * Generate a deterministic conversation ID from creator and fan IDs
 * This matches the server-side logic in the database migration
 * 
 * Note: This is a simplified client-side version. The server uses uuid_generate_v5
 * for true deterministic UUIDs, but this provides consistent sorting for channel names.
 */
export function generateConversationId(creatorId: string, fanId: string): string {
    // Sort IDs to ensure deterministic result regardless of parameter order
    const sortedIds = [creatorId, fanId].sort();
    return `${sortedIds[0]}_${sortedIds[1]}`;
  }
  
  /**
   * Generate a conversation-based channel name for Supabase Realtime
   */
  export function generateChannelName(creatorId: string, fanId: string, conversationId?: string): string {
    const effectiveId = conversationId || generateConversationId(creatorId, fanId);
    return `chat_${effectiveId}`;
  }
  
  /**
   * Check if two user IDs represent the same conversation
   */
  export function isSameConversation(
    creatorId1: string, 
    fanId1: string, 
    creatorId2: string, 
    fanId2: string
  ): boolean {
    const conv1 = generateConversationId(creatorId1, fanId1);
    const conv2 = generateConversationId(creatorId2, fanId2);
    return conv1 === conv2;
  }
  
  /**
   * Extract creator and fan IDs from a conversation ID (if using simple format)
   * Returns null if the conversation ID doesn't follow the expected format
   */
  export function parseConversationId(conversationId: string): { creatorId: string; fanId: string } | null {
    const parts = conversationId.split('_');
    if (parts.length === 2) {
      return {
        creatorId: parts[0],
        fanId: parts[1]
      };
    }
    return null;
  }
  
  /**
   * Validate that a user is part of a conversation
   */
  export function isUserInConversation(userId: string, creatorId: string, fanId: string): boolean {
    return userId === creatorId || userId === fanId;
  }
  
  /**
   * Get the other participant in a conversation
   */
  export function getOtherParticipant(currentUserId: string, creatorId: string, fanId: string): string | null {
    if (currentUserId === creatorId) {
      return fanId;
    } else if (currentUserId === fanId) {
      return creatorId;
    }
    return null;
  }
  
  /**
   * Format conversation participants for display
   */
  export function formatConversationTitle(
    currentUserId: string, 
    creatorProfile: { id: string; display_name?: string; email: string }, 
    fanProfile: { id: string; display_name?: string; email: string }
  ): string {
    const otherProfile = currentUserId === creatorProfile.id ? fanProfile : creatorProfile;
    return otherProfile.display_name || otherProfile.email || 'Unknown User';
  }
