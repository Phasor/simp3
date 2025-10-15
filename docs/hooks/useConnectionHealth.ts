'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface ConnectionHealthMetrics {
  isOnline: boolean;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'offline';
  latency: number | null;
  reconnectCount: number;
  lastDisconnect: Date | null;
  uptime: number; // percentage
}

interface UseConnectionHealthOptions {
  enabled?: boolean;
  pingInterval?: number; // milliseconds
  qualityThresholds?: {
    excellent: number;
    good: number;
    poor: number;
  };
}

interface UseConnectionHealthReturn {
  metrics: ConnectionHealthMetrics;
  ping: () => Promise<number>;
  resetMetrics: () => void;
}

const DEFAULT_PING_INTERVAL = 30000; // 30 seconds
const DEFAULT_THRESHOLDS = {
  excellent: 100, // < 100ms
  good: 300,      // < 300ms
  poor: 1000      // < 1000ms
};

// SSR-safe navigator check
const getNavigatorOnline = () => typeof navigator !== 'undefined' ? navigator.onLine : true;

export function useConnectionHealth({
  enabled = true,
  pingInterval = DEFAULT_PING_INTERVAL,
  qualityThresholds = DEFAULT_THRESHOLDS
}: UseConnectionHealthOptions = {}): UseConnectionHealthReturn {
  const [metrics, setMetrics] = useState<ConnectionHealthMetrics>({
    isOnline: getNavigatorOnline(),
    connectionQuality: 'good',
    latency: null,
    reconnectCount: 0,
    lastDisconnect: null,
    uptime: 100
  });

  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const totalDowntimeRef = useRef<number>(0);
  const lastOfflineTimeRef = useRef<number | null>(null);

  // Ping function to measure latency
  const ping = useCallback(async (): Promise<number> => {
    const start = performance.now();
    
    try {
      // Use a lightweight endpoint or create a simple ping endpoint
      const signal = typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal
        ? AbortSignal.timeout(5000)
        : undefined;
      const response = await fetch('/api/health', {
        method: 'GET',
        cache: 'no-store',
        signal
      });
      
      const end = performance.now();
      const latency = end - start;
      
      if (response.ok) {
        return latency;
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.warn('Ping failed:', error);
      return -1; // Indicate failure
    }
  }, []);

  // Determine connection quality based on latency
  const getConnectionQuality = useCallback((latency: number | null): ConnectionHealthMetrics['connectionQuality'] => {
    const online = getNavigatorOnline();
    if (!online || latency === null || latency < 0) {
      return 'offline';
    }
    
    if (latency < qualityThresholds.excellent) return 'excellent';
    if (latency < qualityThresholds.good) return 'good';
    if (latency < qualityThresholds.poor) return 'poor';
    return 'poor';
  }, [qualityThresholds]);

  // Calculate uptime percentage
  const calculateUptime = useCallback((): number => {
    const online = getNavigatorOnline();
    const totalTime = Date.now() - startTimeRef.current;
    if (totalTime === 0) return 100;
    
    let currentDowntime = totalDowntimeRef.current;
    
    // Add current offline time if currently offline
    if (!online && lastOfflineTimeRef.current) {
      currentDowntime += Date.now() - lastOfflineTimeRef.current;
    }
    
    const uptime = ((totalTime - currentDowntime) / totalTime) * 100;
    return Math.max(0, Math.min(100, uptime));
  }, []);

  // Perform health check
  const performHealthCheck = useCallback(async () => {
    if (!enabled) return;

    const latency = await ping();
    const quality = getConnectionQuality(latency);
    const uptime = calculateUptime();

    setMetrics(prev => ({
      ...prev,
      latency: latency >= 0 ? latency : prev.latency,
      connectionQuality: quality,
      uptime
    }));
  }, [enabled, ping, getConnectionQuality, calculateUptime]);

  // Handle online/offline events
  useEffect(() => {
    if (!enabled) return;

    const handleOnline = () => {
      console.log('📶 Connection restored');
      
      // Calculate downtime
      if (lastOfflineTimeRef.current) {
        const downtime = Date.now() - lastOfflineTimeRef.current;
        totalDowntimeRef.current += downtime;
        lastOfflineTimeRef.current = null;
      }

      setMetrics(prev => ({
        ...prev,
        isOnline: true,
        reconnectCount: prev.reconnectCount + 1,
        uptime: calculateUptime()
      }));

      // Immediate health check when coming back online
      performHealthCheck();
    };

    const handleOffline = () => {
      console.log('📵 Connection lost');
      
      lastOfflineTimeRef.current = Date.now();
      
      setMetrics(prev => ({
        ...prev,
        isOnline: false,
        connectionQuality: 'offline',
        lastDisconnect: new Date()
      }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [enabled, calculateUptime, performHealthCheck]);

  // Set up periodic health checks
  useEffect(() => {
    if (!enabled) return;

    // Initial health check
    performHealthCheck();

    // Set up interval
    pingIntervalRef.current = setInterval(performHealthCheck, pingInterval);

    return () => {
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
    };
  }, [enabled, pingInterval, performHealthCheck]);

  // Reset metrics function
  const resetMetrics = useCallback(() => {
    startTimeRef.current = Date.now();
    totalDowntimeRef.current = 0;
    lastOfflineTimeRef.current = null;
    
    setMetrics({
      isOnline: getNavigatorOnline(),
      connectionQuality: 'good',
      latency: null,
      reconnectCount: 0,
      lastDisconnect: null,
      uptime: 100
    });
  }, []);

  return {
    metrics,
    ping,
    resetMetrics
  };
}

/**
 * Hook for monitoring Supabase realtime connection health
 */
interface UseRealtimeHealthOptions {
  enabled?: boolean;
  onQualityChange?: (quality: ConnectionHealthMetrics['connectionQuality']) => void;
  onReconnect?: () => void;
}

export function useRealtimeHealth({
  enabled = true,
  onQualityChange,
  onReconnect
}: UseRealtimeHealthOptions = {}) {
  const { metrics, ping, resetMetrics } = useConnectionHealth({ enabled });
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [realtimeLatency, setRealtimeLatency] = useState<number | null>(null);
  
  const lastQualityRef = useRef<ConnectionHealthMetrics['connectionQuality']>('good');

  // Monitor quality changes
  useEffect(() => {
    if (metrics.connectionQuality !== lastQualityRef.current) {
      console.log(`📊 Connection quality changed: ${lastQualityRef.current} → ${metrics.connectionQuality}`);
      lastQualityRef.current = metrics.connectionQuality;
      onQualityChange?.(metrics.connectionQuality);
    }
  }, [metrics.connectionQuality, onQualityChange]);

  // Monitor reconnections
  useEffect(() => {
    if (metrics.reconnectCount > 0 && metrics.isOnline) {
      onReconnect?.();
    }
  }, [metrics.reconnectCount, metrics.isOnline, onReconnect]);

  // Realtime-specific ping function
  const pingRealtime = useCallback(async (): Promise<number> => {
    // This would ideally ping the Supabase realtime endpoint
    // For now, use the general ping function
    const ms = await ping();
    setRealtimeLatency(ms >= 0 ? ms : null);
    setRealtimeConnected(ms >= 0);
    return ms;
  }, [ping]);

  return {
    ...metrics,
    realtimeConnected,
    realtimeLatency,
    pingRealtime,
    resetMetrics,
    // Helper functions
    isHealthy: metrics.connectionQuality !== 'offline' && metrics.connectionQuality !== 'poor',
    shouldReconnect: metrics.connectionQuality === 'offline' || ((metrics.latency ?? -1) > 5000)
  };
}
