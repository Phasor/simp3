import type { ChatMessage } from '@/lib/types/database';

export interface SendMessageRequest {
  creatorId: string;
  fanId: string;
  content: string;
}

export interface SendMessageResponse {
  success: boolean;
  message?: ChatMessage;
  error?: string;
}

export interface FetchMessagesResponse {
  messages: ChatMessage[];
  pagination: {
    hasMore: boolean;
    nextCursor: string | null;
  };
}

/**
 * Send a message in a chat conversation
 */
export async function sendMessage(
  { creatorId, fanId, content }: SendMessageRequest,
  opts?: { signal?: AbortSignal }
): Promise<SendMessageResponse> {
  const check = validateMessageContent(content);
  if (!check.valid) {
    return { success: false, error: check.error || 'Invalid message' };
  }
  
  try {
    const timeoutSignal =
      typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(7000) : undefined;
    const signal = opts?.signal ?? timeoutSignal;
    
    const response = await fetch('/api/chat/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        creatorId,
        fanId,
        content
      }),
      signal,
      cache: 'no-store',
    });

    let data: unknown = {};
    try { data = await response.json(); } catch { /* non-JSON error body */ }

    if (!response.ok) {
      return {
        success: false,
        error: data.error || 'Failed to send message'
      };
    }

    return {
      success: true,
      message: data.message
    };
  } catch (error) {
    console.error('Error sending message:', error);
    return {
      success: false,
      error: 'Network error occurred'
    };
  }
}

/**
 * Fetch messages for a conversation
 */
export async function fetchMessages(
  creatorId: string,
  fanId: string,
  options: {
    limit?: number;
    before?: string;
    signal?: AbortSignal;
  } = {}
): Promise<FetchMessagesResponse> {
  try {
    const params = new URLSearchParams();
    
    if (options.limit) {
      params.set('limit', options.limit.toString());
    }
    
    if (options.before) {
      params.set('before', options.before);
    }

    const url = `/api/chat/messages/${creatorId}/${fanId}${params.toString() ? `?${params.toString()}` : ''}`;
    
    const response = await fetch(url, {
      signal: options.signal ?? (typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(7000) : undefined),
      cache: 'no-store',
    });
    
    let data: unknown = {};
    try { data = await response.json(); } catch { /* ignore */ }

    if (!response.ok) {
      const errorMessage = data.error || 'Failed to fetch messages';
      
      // Handle authorization errors specifically
      if (response.status === 403 || errorMessage.includes('Not authorized')) {
        throw new Error('Not authorized to view this conversation');
      }
      
      throw new Error(errorMessage);
    }

    return data;
  } catch (error) {
    // Don't log authorization errors as they're expected
    if (error instanceof Error && error.message.includes('Not authorized')) {
      console.log('🔒 Message fetch denied (expected for unauthorized users)');
    } else {
      console.error('Error fetching messages:', error);
    }
    throw error;
  }
}

/**
 * Validate message content before sending
 */
export function validateMessageContent(content: string): { valid: boolean; error?: string } {
  const trimmed = content.trim();
  
  if (!trimmed) {
    return { valid: false, error: 'Message cannot be empty' };
  }
  
  if (trimmed.length > 1000) {
    return { valid: false, error: 'Message too long (max 1000 characters)' };
  }
  
  // Check for potentially harmful content
  const suspiciousPatterns = [
    /<script/i,     // tags
    /javascript:/i, // URL handlers
  ];
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(trimmed)) {
      return { valid: false, error: 'Message contains invalid content' };
    }
  }
  
  return { valid: true };
}

/**
 * Sanitize message content for display
 */
export function sanitizeMessageContent(content: string): string {
  // Basic HTML escaping
  return content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim();
}

/**
 * Create optimistic message for immediate UI updates
 */
export function createOptimisticMessage({
  creatorId,
  fanId,
  senderId,
  content
}: {
  creatorId: string;
  fanId: string;
  senderId: string;
  content: string;
}): ChatMessage {
  return {
    id:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? `optimistic-${crypto.randomUUID()}`
        : `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    creator_id: creatorId,
    fan_id: fanId,
    sender_id: senderId,
    content: content, // React will escape on render
    created_at: new Date().toISOString(),
    is_locked: false,
    ppv_price_cents: null,
    media_id: null,
    comped_by_creator: null
  };
}

/**
 * Check if a message is optimistic (not yet persisted)
 */
export function isOptimisticMessage(message: ChatMessage): boolean {
  return message.id.startsWith('optimistic-');
}

/**
 * Format message content for display (handle line breaks, etc.)
 */
export function formatMessageContent(content: string): string {
  // Prefer CSS: white-space: pre-wrap; in the message bubble.
  return content;
}

/**
 * Group messages by sender and time proximity
 */
export function groupMessages(
  messages: ChatMessage[],
  maxGapMinutes: number = 5
): Array<{
  senderId: string;
  messages: ChatMessage[];
  timestamp: string;
}> {
  if (messages.length === 0) return [];
  
  const msgs = [...messages].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const groups: Array<{
    senderId: string;
    messages: ChatMessage[];
    timestamp: string;
  }> = [];

  let currentGroup: ChatMessage[] = [msgs[0]];
  let currentSenderId = msgs[0].sender_id;

  for (let i = 1; i < msgs.length; i++) {
    const message = msgs[i];
    const prevMessage = msgs[i - 1];
    
    const timeDiff = new Date(message.created_at).getTime() - new Date(prevMessage.created_at).getTime();
    const minutesDiff = timeDiff / (1000 * 60);
    
    // Same sender and within time gap
    if (message.sender_id === currentSenderId && minutesDiff <= maxGapMinutes) {
      currentGroup.push(message);
    } else {
      // Finish current group and start new one
      groups.push({
        senderId: currentSenderId,
        messages: [...currentGroup],
        timestamp: currentGroup[0].created_at
      });
      
      currentGroup = [message];
      currentSenderId = message.sender_id;
    }
  }
  
  // Add the last group
  if (currentGroup.length > 0) {
    groups.push({
      senderId: currentSenderId,
      messages: currentGroup,
      timestamp: currentGroup[0].created_at
    });
  }
  
  return groups;
}
