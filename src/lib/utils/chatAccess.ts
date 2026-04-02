import type { SupabaseClient } from '@supabase/supabase-js';
import type { ChatAccess } from '@/lib/types/database';

export interface ChatAccessStatus {
  hasAccess: boolean;
  accessUntil: Date | null;
  isExpired: boolean;
  timeRemaining: number | null; // milliseconds until expiry
  daysRemaining: number | null;
  hoursRemaining: number | null;
  minutesRemaining: number | null;
  lastQualifyingPurchaseId: string | null;
}

export interface ChatAccessValidationResult {
  status: ChatAccessStatus;
  error?: string;
}

/**
 * Check if a fan has active chat access with a creator
 */
export async function checkChatAccess(
  creatorId: string, 
  fanId: string,
  retryCount: number = 0,
  signal?: AbortSignal
): Promise<ChatAccessValidationResult> {
  // Merge caller signal with a 15s timeout so requests don't hang
  const timeoutCtrl = typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal
    ? AbortSignal.timeout(15000)
    : undefined;
  const controller = new AbortController();
  const composite = signal
    ? new AbortController()
    : controller;
  if (signal) signal.addEventListener('abort', () => composite.abort(), { once: true });
  if (timeoutCtrl) timeoutCtrl.addEventListener('abort', () => composite.abort(), { once: true });

  try {
    // Validate UUIDs before making API call
    const uuidRx = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRx.test(creatorId) || !uuidRx.test(fanId)) {
      return {
        status: createEmptyAccessStatus(),
        error: 'Invalid IDs'
      };
    }

    // Use API endpoint instead of direct database queries to avoid RLS issues
    const response = await fetch(`/api/chat/access/${creatorId}/${fanId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: (composite as AbortController | undefined)?.signal ?? signal,
      cache: 'no-store', // avoid any intermediary caching of access state
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      
      // Handle authorization errors specifically (don't log as errors since they're expected)
      if (response.status === 403) {
        console.log('🔒 Chat access denied (expected for unauthorized users)');
        return {
          status: createEmptyAccessStatus(),

          error: 'unauthorized'
        };
      }
      
      // Only log actual errors (not expected authorization failures)
      console.error('Chat access API error:', errorData);
      
      // Retry on server errors (5xx) but not client errors (4xx)
      if (response.status >= 500 && retryCount < 2) {
        console.log(`Retrying chat access check (attempt ${retryCount + 1})`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Progressive delay
        return checkChatAccess(creatorId, fanId, retryCount + 1, signal);
      }
      
      return {
        status: createEmptyAccessStatus(),
        error: errorData.error || 'Failed to check chat access'
      };
    }

    const data = await response.json();
    const status = coerceStatusFromApi(data.status);
    return {
      status,
      error: data.error
    };
  } catch (error) {
    // Filter out AbortErrors which are usually from navigation/browser cancellations
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('⏹️ Chat access request aborted (likely due to navigation)');
      return {
        status: createEmptyAccessStatus(),
        error: 'Request aborted'
      };
    }
    
    console.error('Error in checkChatAccess:', error);
    
    // Retry on network errors
    if (retryCount < 2) {
      console.log(`Retrying chat access check after network error (attempt ${retryCount + 1})`);
      await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Progressive delay
      return checkChatAccess(creatorId, fanId, retryCount + 1, signal);
    }
    
    return {
      status: createEmptyAccessStatus(),
      error: 'Network error checking chat access'
    };
  }
}

/**
 * Coerce API response to proper ChatAccessStatus type with defensive normalization
 */
function coerceStatusFromApi(raw: unknown): ChatAccessStatus {
  // Defensive normalization; tolerate missing fields
  const rawObj = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const hasAccess = !!rawObj?.hasAccess;
  const accessUntil = rawObj?.accessUntil ? new Date(rawObj.accessUntil as string) : null;
  const isExpired = rawObj?.isExpired !== undefined ? !!rawObj.isExpired : (accessUntil ? Date.now() > accessUntil.getTime() : true);
  const timeRemaining = typeof rawObj?.timeRemaining === 'number'
    ? rawObj.timeRemaining
    : accessUntil ? Math.max(0, accessUntil.getTime() - Date.now()) : null;
  const daysRemaining = Number.isFinite(rawObj?.daysRemaining)
    ? (rawObj.daysRemaining as number)
    : timeRemaining != null ? Math.floor(timeRemaining / 86_400_000) : null;
  const hoursRemaining = Number.isFinite(rawObj?.hoursRemaining)
    ? (rawObj.hoursRemaining as number)
    : timeRemaining != null ? Math.floor((timeRemaining % 86_400_000) / 3_600_000) : null;
  const minutesRemaining = Number.isFinite(rawObj?.minutesRemaining)
    ? (rawObj.minutesRemaining as number)
    : timeRemaining != null ? Math.floor((timeRemaining % 3_600_000) / 60_000) : null;
  return {
    hasAccess,
    accessUntil,
    isExpired,
    timeRemaining,
    daysRemaining,
    hoursRemaining,
    minutesRemaining,
    lastQualifyingPurchaseId: typeof (raw as Record<string, unknown>)?.lastQualifyingPurchaseId === 'string' 
      ? (raw as Record<string, unknown>).lastQualifyingPurchaseId as string
      : null,
  };
}

/**
 * Calculate access status from a chat access record
 */
export function calculateAccessStatus(accessRecord: ChatAccess | null): ChatAccessStatus {
  if (!accessRecord) {
    return createEmptyAccessStatus();
  }

  // Access is purely controlled by recalculate_vip_access — state='granted' means active
  const isExpired = accessRecord.state !== 'granted';
  const hasAccess = accessRecord.state === 'granted';

  return {
    hasAccess,
    accessUntil: null,
    isExpired,
    timeRemaining: null,
    daysRemaining: null,
    hoursRemaining: null,
    minutesRemaining: null,
    lastQualifyingPurchaseId: accessRecord.last_qualifying_purchase_id
  };
}

/**
 * Create an empty access status for users with no access
 */
function createEmptyAccessStatus(): ChatAccessStatus {
  return {
    hasAccess: false,
    accessUntil: null,
    isExpired: true,
    timeRemaining: null,
    daysRemaining: null,
    hoursRemaining: null,
    minutesRemaining: null,
    lastQualifyingPurchaseId: null
  };
}

/**
 * Get all chat access records for a user (either as creator or fan)
 * 
 * Note: For optimal performance, ensure these database indexes exist:
 * - CREATE INDEX IF NOT EXISTS chat_access_creator_updated_idx ON chat_access (creator_id, updated_at DESC);
 * - CREATE INDEX IF NOT EXISTS chat_access_fan_updated_idx ON chat_access (fan_id, updated_at DESC);
 */
export async function getUserChatAccess(
  supabase: SupabaseClient,         // 👈 use the caller's client
  userId: string,
  userType: 'CREATOR' | 'FAN',
  opts: { limit?: number; offset?: number; signal?: AbortSignal } = {}
) {
  const startTime = performance.now();
  try {
    const { limit = 50, offset = 0, signal } = opts;

    if (userType === 'CREATOR') {
      // Get all fans with access to this creator
      // Removed profile joins for better performance - caller already has profile data
      console.log('🔍 getUserChatAccess: Querying for CREATOR:', userId);
      let q = supabase
        .from('chat_access')
        .select('*')
        .eq('creator_id', userId)
        .order('updated_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (signal) q = q.abortSignal(signal);
      
      const { data, error } = await q;
      const duration = performance.now() - startTime;
      
      if (error) {
        console.error(`❌ Error fetching creator chat access (${duration.toFixed(0)}ms):`, error);
        return { data: [], error: error.message };
      }

      console.log(`✅ getUserChatAccess completed in ${duration.toFixed(0)}ms, found ${data?.length || 0} records`);
      return { data: data || [], error: null };
    } else {
      // Get all creators this fan has access to
      // Removed profile joins for better performance - caller already has profile data
      console.log('🔍 getUserChatAccess: Querying for FAN:', userId);
      let q = supabase
        .from('chat_access')
        .select('*')
        .eq('fan_id', userId)
        .order('updated_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (signal) q = q.abortSignal(signal);
      
      const { data, error } = await q;
      const duration = performance.now() - startTime;

      if (error) {
        console.error(`❌ Error fetching fan chat access (${duration.toFixed(0)}ms):`, error);
        return { data: [], error: error.message };
      }

      console.log(`✅ getUserChatAccess completed in ${duration.toFixed(0)}ms, found ${data?.length || 0} records`);
      return { data: data || [], error: null };
    }
  } catch (error) {
    const duration = performance.now() - startTime;
    console.error(`❌ Error in getUserChatAccess (${duration.toFixed(0)}ms):`, error);
    return { data: [], error: 'Unexpected error fetching chat access' };
  }
}

/**
 * Format time left in a human-readable way
 */
export function formatTimeRemaining(status: ChatAccessStatus): string {
  if (!status.hasAccess) {
    return 'No access';
  }
  
  // If we have access but timeRemaining is null, fall back to daysRemaining
  if (status.timeRemaining === null && status.daysRemaining !== null) {
    if (status.daysRemaining === 1) {
      return `${status.daysRemaining} day left`;
    }
    return `${status.daysRemaining} days left`;
  }
  
  if (status.timeRemaining === null) {
    return 'Active access';
  }

  const { daysRemaining, hoursRemaining, minutesRemaining } = status;

  if (daysRemaining !== null && daysRemaining > 0) {
    if (daysRemaining === 1) {
      return `${daysRemaining} day left`;
    }
    return `${daysRemaining} days left`;
  }

  if (hoursRemaining !== null && hoursRemaining > 0) {
    if (hoursRemaining === 1) {
      return `${hoursRemaining} hour left`;
    }
    return `${hoursRemaining} hours left`;
  }

  if (minutesRemaining !== null && minutesRemaining >= 0) {
    if (minutesRemaining === 0) {
      return 'Less than a minute left';
    }
    if (minutesRemaining === 1) {
      return `${minutesRemaining} minute left`;
    }
    return `${minutesRemaining} minutes left`;
  }

  return 'Less than a minute left';
}
