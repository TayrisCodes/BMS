'use client';

import { useState, useEffect, useCallback } from 'react';

interface QueuedAction {
  id: string;
  type: 'complaint' | 'payment';
  data: unknown;
  timestamp: number;
  retries: number;
}

const MAX_RETRIES = 3;
const QUEUE_STORAGE_KEY = 'bms_offline_queue';

/**
 * Hook for managing offline action queue
 * Stores actions in localStorage when offline and syncs when online
 */
export function useOfflineQueue() {
  const [isOnline, setIsOnline] = useState(true);
  const [queuedActions, setQueuedActions] = useState<QueuedAction[]>([]);

  // Load queued actions from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(QUEUE_STORAGE_KEY);
      if (stored) {
        const actions = JSON.parse(stored) as QueuedAction[];
        setQueuedActions(actions);
      }
    } catch (error) {
      console.error('Failed to load queued actions:', error);
    }
  }, []);

  // Monitor online/offline status
  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Save queued actions to localStorage
  const saveQueue = useCallback((actions: QueuedAction[]) => {
    try {
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(actions));
      setQueuedActions(actions);
    } catch (error) {
      console.error('Failed to save queued actions:', error);
    }
  }, []);

  // Queue an action for later sync
  const queueAction = useCallback(
    (type: 'complaint' | 'payment', data: unknown) => {
      const action: QueuedAction = {
        id: `${type}-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        type,
        data,
        timestamp: Date.now(),
        retries: 0,
      };

      const updated = [...queuedActions, action];
      saveQueue(updated);
      return action.id;
    },
    [queuedActions, saveQueue],
  );

  // Remove an action from queue
  const removeQueuedAction = useCallback(
    (id: string) => {
      const updated = queuedActions.filter((action) => action.id !== id);
      saveQueue(updated);
    },
    [queuedActions, saveQueue],
  );

  // Sync queued actions when online
  const syncQueuedActions = useCallback(async () => {
    if (!isOnline || queuedActions.length === 0) {
      return;
    }

    const actionsToSync = [...queuedActions];
    const synced: string[] = [];
    const failed: QueuedAction[] = [];

    for (const action of actionsToSync) {
      try {
        let success = false;

        if (action.type === 'complaint') {
          const response = await fetch('/api/tenant/complaints', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(action.data),
          });
          success = response.ok;
        } else if (action.type === 'payment') {
          const response = await fetch('/api/tenant/payments/intent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(action.data),
          });
          success = response.ok;
        }

        if (success) {
          synced.push(action.id);
        } else {
          // Increment retry count
          if (action.retries < MAX_RETRIES) {
            failed.push({ ...action, retries: action.retries + 1 });
          }
        }
      } catch (error) {
        console.error(`Failed to sync action ${action.id}:`, error);
        // Increment retry count
        if (action.retries < MAX_RETRIES) {
          failed.push({ ...action, retries: action.retries + 1 });
        }
      }
    }

    // Remove synced actions, keep failed ones for retry
    const remaining = queuedActions.filter((action) => !synced.includes(action.id));
    const updated = [...remaining, ...failed];
    saveQueue(updated);

    if (synced.length > 0) {
      console.log(`Synced ${synced.length} queued actions`);
    }
  }, [isOnline, queuedActions, saveQueue]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && queuedActions.length > 0) {
      syncQueuedActions();
    }
  }, [isOnline, queuedActions.length, syncQueuedActions]);

  return {
    isOnline,
    queuedActions,
    queueAction,
    removeQueuedAction,
    syncQueuedActions,
  };
}
