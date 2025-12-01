'use client';

import { useState, useEffect } from 'react';

interface Activity {
  id: string;
  type: string;
  title: string;
  description?: string;
  timestamp: string;
  user?: string;
  link?: string;
}

interface UseRecentActivityReturn {
  activities: Activity[];
  loading: boolean;
  error: string | null;
}

export function useRecentActivity(): UseRecentActivityReturn {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchActivities() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch('/api/dashboard/activity');
        if (!response.ok) {
          throw new Error('Failed to fetch recent activities');
        }
        const result = await response.json();
        setActivities(result.activities || result || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        setActivities([]);
      } finally {
        setLoading(false);
      }
    }

    fetchActivities();
  }, []);

  return {
    activities,
    loading,
    error,
  };
}
