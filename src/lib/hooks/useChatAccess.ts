import { useState, useEffect, useCallback, useRef } from 'react';
import { checkChatAccess, getUserChatAccess, type ChatAccessValidationResult, type ChatAccessStatus } from '@/lib/utils/chatAccess';
import { useAuth } from '@/lib/contexts/AuthContext';

interface UseChatAccessOptions {
  creatorId?: string;
  fanId?: string;
  autoRefresh?: boolean;
  refreshInterval?: number; // milliseconds
}

interface UseChatAccessReturn {
  accessStatus: ChatAccessStatus | null;
  rules: ChatAccessValidationResult['rules'];
  loading: boolean;
  error: string | null;
  refreshAccess: () => Promise<void>;
  timeUntilRefresh: number | null;
}

/**
 * Hook for checking and monitoring chat access between a creator and fan
 */
export function useChatAccess({
  creatorId,
  fanId,
  autoRefresh = true,
  refreshInterval = 60 * 60 * 1000 // 1 hour default (like real apps)
}: UseChatAccessOptions): UseChatAccessReturn {
  const [accessStatus, setAccessStatus] = useState<ChatAccessStatus | null>(null);
  const [rules, setRules] = useState<ChatAccessValidationResult['rules']>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeUntilRefresh, setTimeUntilRefresh] = useState<number | null>(null);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  const checkAccess = useCallback(async () => {
    if (!creatorId || !fanId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const result = await checkChatAccess(creatorId, fanId);
      
      if (result.error) {
        setError(result.error);
        // Still set the status even if there's an error (for unauthorized cases)
        setAccessStatus(result.status);
        setRules(result.rules);
        
        // Don't log authorization errors as they're expected
        if (result.error !== 'unauthorized') {
          console.error('Chat access check error:', result.error);
        }
      } else {
        setAccessStatus(result.status);
        setRules(result.rules);
      }
    } catch (err) {
      console.error('Error checking chat access:', err);
      setError('Failed to check chat access');
    } finally {
      setLoading(false);
    }
  }, [creatorId, fanId]);

  const refreshAccess = useCallback(async () => {
    await checkAccess();
  }, [checkAccess]);

  // Set up auto-refresh
  useEffect(() => {
    if (!autoRefresh || !creatorId || !fanId) {
      return;
    }

    // Initial check
    checkAccess();

    // Set up periodic refresh
    intervalRef.current = setInterval(() => {
      checkAccess();
    }, refreshInterval);

    // Set up countdown timer
    let countdown = refreshInterval;
    countdownRef.current = setInterval(() => {
      countdown -= 1000;
      setTimeUntilRefresh(countdown);
      
      if (countdown <= 0) {
        countdown = refreshInterval;
      }
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, [autoRefresh, refreshInterval, checkAccess, creatorId, fanId]);

  // Initial check when IDs change
  useEffect(() => {
    if (creatorId && fanId) {
      checkAccess();
    }
  }, [checkAccess]);

  return {
    accessStatus,
    rules,
    loading,
    error,
    refreshAccess,
    timeUntilRefresh
  };
}

interface UseUserChatAccessReturn {
  chatAccess: ChatAccess[];
  loading: boolean;
  error: string | null;
  refreshChatAccess: () => Promise<void>;
}

/**
 * Hook for getting all chat access records for the current user
 */
export function useUserChatAccess(): UseUserChatAccessReturn {
  const { profile } = useAuth();
  const [chatAccess, setChatAccess] = useState<ChatAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchChatAccess = useCallback(async () => {
    if (!profile) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const result = await getUserChatAccess(profile.id, profile.user_type);
      
      if (result.error) {
        setError(result.error);
      } else {
        setChatAccess(result.data);
      }
    } catch (err) {
      console.error('Error fetching user chat access:', err);
      setError('Failed to fetch chat access');
    } finally {
      setLoading(false);
    }
  }, [profile]);

  const refreshChatAccess = useCallback(async () => {
    await fetchChatAccess();
  }, [fetchChatAccess]);

  useEffect(() => {
    fetchChatAccess();
  }, [fetchChatAccess]);

  return {
    chatAccess,
    loading,
    error,
    refreshChatAccess
  };
}

/**
 * Hook for monitoring access expiry and triggering actions
 */
export function useChatAccessMonitor(
  accessStatus: ChatAccessStatus | null,
  onAccessExpired?: () => void,
  onAccessExpiring?: (minutesRemaining: number) => void
) {
  const [hasNotifiedExpiring, setHasNotifiedExpiring] = useState(false);
  const [hasNotifiedExpired, setHasNotifiedExpired] = useState(false);

  useEffect(() => {
    if (!accessStatus) return;

    // Check if access has expired
    if (accessStatus.isExpired && !hasNotifiedExpired) {
      setHasNotifiedExpired(true);
      setHasNotifiedExpiring(false); // Reset expiring notification
      onAccessExpired?.();
      return;
    }

    // Check if access is expiring soon (within 30 minutes)
    if (
      accessStatus.hasAccess && 
      accessStatus.minutesRemaining !== null && 
      accessStatus.minutesRemaining <= 30 && 
      !hasNotifiedExpiring
    ) {
      setHasNotifiedExpiring(true);
      onAccessExpiring?.(accessStatus.minutesRemaining);
    }

    // Reset notifications if access is renewed
    if (accessStatus.hasAccess && accessStatus.daysRemaining && accessStatus.daysRemaining > 0) {
      setHasNotifiedExpiring(false);
      setHasNotifiedExpired(false);
    }
  }, [accessStatus, hasNotifiedExpiring, hasNotifiedExpired, onAccessExpired, onAccessExpiring]);

  return {
    hasNotifiedExpiring,
    hasNotifiedExpired
  };
}
