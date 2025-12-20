'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/lib/components/ui/button';
import { Bell, BellOff, X } from 'lucide-react';
import { usePushNotifications } from '@/lib/hooks/usePushNotifications';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';

export function PushNotificationPrompt() {
  const { isSupported, isSubscribed, permission, subscribe, unsubscribe } = usePushNotifications();
  const [isTenant, setIsTenant] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);

  // Check if user is a tenant
  useEffect(() => {
    const checkTenantRole = async () => {
      try {
        const response = await fetch('/api/me', { credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          if (data.auth?.roles?.includes('TENANT')) {
            setIsTenant(true);
          }
        }
      } catch (error) {
        console.error('Failed to check user role:', error);
      }
    };

    checkTenantRole();

    // Check if already dismissed
    const dismissedValue = localStorage.getItem('push-notification-dismissed');
    if (dismissedValue) {
      setDismissed(true);
    }
  }, []);

  // Don't show if not tenant, not supported, already subscribed, or dismissed
  if (!isTenant || !isSupported || isSubscribed || dismissed || permission === 'denied') {
    return null;
  }

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      await subscribe();
    } catch (error: any) {
      alert(error.message || 'Failed to enable push notifications');
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('push-notification-dismissed', Date.now().toString());
  };

  return (
    <Card className="fixed bottom-4 left-4 right-4 z-40 md:max-w-md md:left-auto shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <CardTitle className="text-sm">Enable Push Notifications</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleDismiss}
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Get instant notifications about new messages, payment reminders, and important updates.
        </p>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSubscribe} disabled={loading} className="flex-1">
            {loading ? (
              'Enabling...'
            ) : (
              <>
                <Bell className="mr-2 h-4 w-4" />
                Enable
              </>
            )}
          </Button>
          <Button size="sm" variant="outline" onClick={handleDismiss}>
            Later
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

