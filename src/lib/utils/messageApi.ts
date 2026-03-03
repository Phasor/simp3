import type { ChatMessage } from '@/lib/types/database';

// Helpers for safe narrowing
function pickApiError(x: unknown, fallback = 'Failed to send message'): string {
  if (typeof x === 'string') return x;
  if (x && typeof x === 'object') {
    const o = x as Record<string, unknown>;
    if (typeof o.error === 'string') return o.error;
    if (typeof o.message === 'string') return o.message;
  }
  return fallback;
}

function isSendOk<T extends object = object>(x: unknown): x is T {
  return !!x && typeof x === 'object';
}

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
      typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(15000) : undefined;
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

    // `unknown` until we parse & narrow
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      // some endpoints return no JSON on error
      body = undefined;
    }

    if (!response.ok) {
      return {
        success: false,
        error: pickApiError(body, 'Failed to send message'),
      };
    }

    // success path — narrow before using
    if (!isSendOk(body)) {
      return { success: false, error: 'Malformed response from server' };
    }

    type SendMessageSuccess = {
      message: ChatMessage;
    };

    const data = body as SendMessageSuccess;

    return {
      success: true,
      message: data.message,
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
      signal: options.signal ?? (typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(15000) : undefined),
      cache: 'no-store',
    });
    
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = undefined;
    }

    if (!response.ok) {
      const errorMessage = pickApiError(body, 'Failed to fetch messages');
      
      // Handle authorization errors specifically
      if (response.status === 403 || errorMessage.includes('Not authorized')) {
        throw new Error('Not authorized to view this conversation');
      }
      
      throw new Error(errorMessage);
    }

    // Narrow the success response
    if (!isSendOk<FetchMessagesResponse>(body)) {
      throw new Error('Malformed response from server');
    }

    return body;
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

