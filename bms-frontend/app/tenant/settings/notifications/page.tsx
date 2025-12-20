'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/lib/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { Label } from '@/lib/components/ui/label';
import { Input } from '@/lib/components/ui/input';
import { Switch } from '@/lib/components/ui/switch';
import { apiGet, apiPatch } from '@/lib/utils/api-client';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import { Bell, Save } from 'lucide-react';
import {
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  getPushNotificationStatus,
} from '@/lib/utils/push-notifications';

interface NotificationPreferences {
  emailEnabled: boolean;
  smsEnabled: boolean;
  inAppEnabled: boolean;
  pushEnabled?: boolean;
  emailTypes: string[];
  smsTypes: string[];
  pushTypes?: string[];
  quietHoursEnabled?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  doNotDisturbEnabled?: boolean;
  doNotDisturbUntil?: Date | null;
  preferredLanguage?: string;
}

const notificationTypes = [
  'invoice_created',
  'payment_due',
  'payment_received',
  'complaint_status_changed',
  'work_order_assigned',
  'work_order_completed',
  'lease_expiring',
  'visitor_arrived',
  'system',
];

const languages = [
  { code: 'en', name: 'English' },
  { code: 'am', name: 'Amharic' },
  { code: 'om', name: 'Afaan Oromo' },
  { code: 'ti', name: 'Tigrigna' },
];

export default function NotificationPreferencesPage() {
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    emailEnabled: true,
    smsEnabled: true,
    inAppEnabled: true,
    pushEnabled: false,
    emailTypes: [],
    smsTypes: [],
    pushTypes: [],
    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',
    doNotDisturbEnabled: false,
    doNotDisturbUntil: null,
    preferredLanguage: 'en',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    async function fetchPreferences() {
      try {
        setIsLoading(true);
        const data = await apiGet<{ preferences: NotificationPreferences }>(
          '/api/notifications/preferences',
        );
        if (data.preferences) {
          setPreferences(data.preferences);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load preferences');
      } finally {
        setIsLoading(false);
      }
    }

    fetchPreferences();

    // Check push notification status
    async function checkPushStatus() {
      const status = await getPushNotificationStatus();
      setPushSupported(status.supported);
      setPushSubscribed(status.subscribed);
      setPushPermission(status.permission);
    }
    checkPushStatus();
  }, []);

  async function handleSave() {
    try {
      setIsSaving(true);
      setError(null);
      setSuccess(false);

      await apiPatch('/api/notifications/preferences', preferences);

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save preferences');
    } finally {
      setIsSaving(false);
    }
  }

  function toggleNotificationType(channel: 'email' | 'sms' | 'push', type: string) {
    const key = `${channel}Types` as 'emailTypes' | 'smsTypes' | 'pushTypes';
    const currentTypes = preferences[key] || [];
    const newTypes = currentTypes.includes(type)
      ? currentTypes.filter((t) => t !== type)
      : [...currentTypes, type];
    setPreferences({ ...preferences, [key]: newTypes });
  }

  if (isLoading) {
    return (
      <DashboardPage title="Notification Preferences" icon={<Bell className="h-5 w-5" />}>
        <div className="text-center py-8">
          <p className="text-muted-foreground">Loading preferences...</p>
        </div>
      </DashboardPage>
    );
  }

  return (
    <DashboardPage
      header={{
        title: 'Notification Preferences',
        description: 'Customize how you receive notifications',
        icon: Bell,
      }}
    >
      <div className="col-span-full space-y-6">
        {error && <div className="bg-destructive/10 text-destructive p-4 rounded-lg">{error}</div>}
        {success && (
          <div className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 p-4 rounded-lg">
            Preferences saved successfully!
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Channel Preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="inAppEnabled">In-App Notifications</Label>
                <p className="text-sm text-muted-foreground">Receive notifications in the app</p>
              </div>
              <Switch
                id="inAppEnabled"
                checked={preferences.inAppEnabled}
                onCheckedChange={(checked) =>
                  setPreferences({ ...preferences, inAppEnabled: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="emailEnabled">Email Notifications</Label>
                <p className="text-sm text-muted-foreground">Receive notifications via email</p>
              </div>
              <Switch
                id="emailEnabled"
                checked={preferences.emailEnabled}
                onCheckedChange={(checked) =>
                  setPreferences({ ...preferences, emailEnabled: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="smsEnabled">SMS/WhatsApp Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive notifications via SMS or WhatsApp
                </p>
              </div>
              <Switch
                id="smsEnabled"
                checked={preferences.smsEnabled}
                onCheckedChange={(checked) =>
                  setPreferences({ ...preferences, smsEnabled: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="pushEnabled">Push Notifications</Label>
                <p className="text-sm text-muted-foreground">Receive push notifications (PWA)</p>
                {!pushSupported && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Push notifications not supported in this browser
                  </p>
                )}
                {pushSupported && pushPermission === 'denied' && (
                  <p className="text-xs text-destructive mt-1">
                    Notification permission denied. Please enable in browser settings.
                  </p>
                )}
              </div>
              <Switch
                id="pushEnabled"
                checked={preferences.pushEnabled || false}
                onCheckedChange={async (checked) => {
                  setPreferences({ ...preferences, pushEnabled: checked });
                  if (checked && pushSupported) {
                    const subscription = await subscribeToPushNotifications();
                    if (subscription) {
                      setPushSubscribed(true);
                    }
                  } else if (!checked) {
                    await unsubscribeFromPushNotifications();
                    setPushSubscribed(false);
                  }
                }}
                disabled={!pushSupported || pushPermission === 'denied'}
              />
            </div>
            {pushSupported && pushSubscribed && (
              <div className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 p-3 rounded-lg text-sm">
                ✓ Push notifications are enabled and active
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notification Types by Channel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label className="mb-3 block">Email Notifications</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {notificationTypes.map((type) => (
                  <label key={type} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.emailTypes.includes(type)}
                      onChange={() => toggleNotificationType('email', type)}
                      className="rounded"
                    />
                    <span className="text-sm capitalize">{type.replace('_', ' ')}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <Label className="mb-3 block">SMS/WhatsApp Notifications</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {notificationTypes.map((type) => (
                  <label key={type} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.smsTypes.includes(type)}
                      onChange={() => toggleNotificationType('sms', type)}
                      className="rounded"
                    />
                    <span className="text-sm capitalize">{type.replace('_', ' ')}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <Label className="mb-3 block">Push Notifications</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {notificationTypes.map((type) => (
                  <label key={type} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(preferences.pushTypes || []).includes(type)}
                      onChange={() => toggleNotificationType('push', type)}
                      className="rounded"
                    />
                    <span className="text-sm capitalize">{type.replace('_', ' ')}</span>
                  </label>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quiet Hours</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="quietHoursEnabled">Enable Quiet Hours</Label>
                <p className="text-sm text-muted-foreground">
                  Don&apos;t send non-urgent notifications during these hours
                </p>
              </div>
              <Switch
                id="quietHoursEnabled"
                checked={preferences.quietHoursEnabled || false}
                onCheckedChange={(checked) =>
                  setPreferences({ ...preferences, quietHoursEnabled: checked })
                }
              />
            </div>

            {preferences.quietHoursEnabled && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quietHoursStart">Start Time</Label>
                  <Input
                    id="quietHoursStart"
                    type="time"
                    value={preferences.quietHoursStart || '22:00'}
                    onChange={(e) =>
                      setPreferences({ ...preferences, quietHoursStart: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quietHoursEnd">End Time</Label>
                  <Input
                    id="quietHoursEnd"
                    type="time"
                    value={preferences.quietHoursEnd || '08:00'}
                    onChange={(e) =>
                      setPreferences({ ...preferences, quietHoursEnd: e.target.value })
                    }
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Do Not Disturb</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="doNotDisturbEnabled">Enable Do Not Disturb</Label>
                <p className="text-sm text-muted-foreground">
                  Temporarily disable all non-urgent notifications
                </p>
              </div>
              <Switch
                id="doNotDisturbEnabled"
                checked={preferences.doNotDisturbEnabled || false}
                onCheckedChange={(checked) =>
                  setPreferences({ ...preferences, doNotDisturbEnabled: checked })
                }
              />
            </div>

            {preferences.doNotDisturbEnabled && (
              <div className="space-y-2">
                <Label htmlFor="doNotDisturbUntil">Until</Label>
                <Input
                  id="doNotDisturbUntil"
                  type="datetime-local"
                  value={
                    preferences.doNotDisturbUntil
                      ? new Date(preferences.doNotDisturbUntil).toISOString().slice(0, 16)
                      : ''
                  }
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      doNotDisturbUntil: e.target.value ? new Date(e.target.value) : null,
                    })
                  }
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Language Preference</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="preferredLanguage">Preferred Language</Label>
              <select
                id="preferredLanguage"
                className="w-full px-3 py-2 border rounded-md"
                value={preferences.preferredLanguage || 'en'}
                onChange={(e) =>
                  setPreferences({ ...preferences, preferredLanguage: e.target.value })
                }
              >
                {languages.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Preferences'}
          </Button>
        </div>
      </div>
    </DashboardPage>
  );
}
