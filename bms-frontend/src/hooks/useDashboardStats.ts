'use client';

import { useState, useEffect } from 'react';

interface DashboardStats {
  totalBuildings?: number;
  totalUnits?: number;
  occupiedUnits?: number;
  vacancyRate?: number;
  totalRevenue?: number;
  outstandingReceivables?: number;
  pendingComplaints?: number;
  totalOrganizations?: number;
  totalTenants?: number;
  systemHealth?: string;
  [key: string]: unknown;
}

interface UseDashboardStatsReturn {
  data: DashboardStats | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useDashboardStats(): UseDashboardStatsReturn {
  const [data, setData] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/dashboard/stats');
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard stats');
      }
      const result = await response.json();
      setData(result.stats || result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return {
    data,
    loading,
    error,
    refetch: fetchStats,
  };
}

