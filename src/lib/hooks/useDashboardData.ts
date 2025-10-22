'use client';

import { useState, useEffect } from 'react';

export interface DashboardStats {
  totalEarnings: number;
  monthlyEarnings: number;
  chatUnlocks: number;
  activeFans: number;
  avgPerUnlock: number;
  returningFans: number;
  newFans: number;
  topFans: Array<{
    id: string;
    username: string;
    unlocks: number;
    lastActive: string;
    totalSpent: number;
    rank: number;
  }>;
  chartData: number[];
}

export function useDashboardData() {
  const [data, setData] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/dashboard/stats');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch dashboard data: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      
      setData(result);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return {
    data,
    loading,
    error,
    refetch: fetchData
  };
}
