'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/lib/components/ui/button';
import { Input } from '@/lib/components/ui/input';
import { Label } from '@/lib/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { apiGet, apiPut } from '@/lib/utils/api-client';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import { Save, Bell, AlertCircle } from 'lucide-react';
import { Checkbox } from '@/lib/components/ui/checkbox';

export default function BillingSettingsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [daysBeforeDue, setDaysBeforeDue] = useState<string>('7,3,0');
  const [daysAfterDue, setDaysAfterDue] = useState<string>('3,7,14,30');
  const [escalationEnabled, setEscalationEnabled] = useState(true);
  const [reminderChannels, setReminderChannels] = useState<{
    in_app: boolean;
    email: boolean;
    sms: boolean;
  }>({
    in_app: true,
    email: true,
    sms: true,
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      setIsLoading(true);
      const data = await apiGet<{
        settings: {
          daysBeforeDue: number[];
          daysAfterDue: number[];
          escalationEnabled: boolean;
          reminderChannels: ('in_app' | 'email' | 'sms')[];
        };
      }>('/api/settings/billing');

      const settings = data.settings;
      setDaysBeforeDue(settings.daysBeforeDue.join(','));
      setDaysAfterDue(settings.daysAfterDue.join(','));
      setEscalationEnabled(settings.escalationEnabled);
      setReminderChannels({
        in_app: settings.reminderChannels.includes('in_app'),
        email: settings.reminderChannels.includes('email'),
        sms: settings.reminderChannels.includes('sms'),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const channels: ('in_app' | 'email' | 'sms')[] = [];
      if (reminderChannels.in_app) channels.push('in_app');
      if (reminderChannels.email) channels.push('email');
      if (reminderChannels.sms) channels.push('sms');

      await apiPut('/api/settings/billing', {
        daysBeforeDue: daysBeforeDue
          .split(',')
          .map((d) => parseInt(d.trim(), 10))
          .filter((d) => !isNaN(d)),
        daysAfterDue: daysAfterDue
          .split(',')
          .map((d) => parseInt(d.trim(), 10))
          .filter((d) => !isNaN(d)),
        escalationEnabled,
        reminderChannels: channels,
      });

      setSuccess('Billing settings updated successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update settings');
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <DashboardPage>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </DashboardPage>
    );
  }

  return (
    <DashboardPage>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Billing Settings</h1>
          <p className="text-muted-foreground">Configure payment reminder schedules</p>
        </div>

        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {success && (
          <Card className="border-green-500">
            <CardContent className="pt-6">
              <div className="text-green-600">{success}</div>
            </CardContent>
          </Card>
        )}

        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Payment Reminder Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="daysBeforeDue">Reminder Days Before Due Date</Label>
                <Input
                  id="daysBeforeDue"
                  value={daysBeforeDue}
                  onChange={(e) => setDaysBeforeDue(e.target.value)}
                  placeholder="7,3,0"
                />
                <p className="text-sm text-muted-foreground">
                  Comma-separated list of days before due date to send reminders (e.g., 7,3,0)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="daysAfterDue">Reminder Days After Due Date</Label>
                <Input
                  id="daysAfterDue"
                  value={daysAfterDue}
                  onChange={(e) => setDaysAfterDue(e.target.value)}
                  placeholder="3,7,14,30"
                />
                <p className="text-sm text-muted-foreground">
                  Comma-separated list of days after due date to send reminders (e.g., 3,7,14,30)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="escalationEnabled">Escalation</Label>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="escalationEnabled"
                    checked={escalationEnabled}
                    onCheckedChange={(checked) => setEscalationEnabled(checked === true)}
                  />
                  <Label htmlFor="escalationEnabled" className="cursor-pointer">
                    Enable daily reminders for overdue invoices
                  </Label>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Reminder Channels</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="channel_in_app"
                      checked={reminderChannels.in_app}
                      onCheckedChange={(checked) =>
                        setReminderChannels({ ...reminderChannels, in_app: checked === true })
                      }
                    />
                    <Label htmlFor="channel_in_app" className="cursor-pointer">
                      In-App Notifications
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="channel_email"
                      checked={reminderChannels.email}
                      onCheckedChange={(checked) =>
                        setReminderChannels({ ...reminderChannels, email: checked === true })
                      }
                    />
                    <Label htmlFor="channel_email" className="cursor-pointer">
                      Email
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="channel_sms"
                      checked={reminderChannels.sms}
                      onCheckedChange={(checked) =>
                        setReminderChannels({ ...reminderChannels, sms: checked === true })
                      }
                    />
                    <Label htmlFor="channel_sms" className="cursor-pointer">
                      SMS
                    </Label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                <>
                  <Save className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Settings
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </DashboardPage>
  );
}
