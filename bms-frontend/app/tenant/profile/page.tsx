'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MobileCard } from '@/lib/components/tenant/MobileCard';
import { MobileForm, MobileFormField } from '@/lib/components/tenant/MobileForm';
import { Button } from '@/lib/components/ui/button';
import { LogOut, Loader2, Bell, Mail, MessageSquare, Smartphone } from 'lucide-react';
import { Switch } from '@/lib/components/ui/switch';
import { Checkbox } from '@/lib/components/ui/checkbox';

interface TenantProfile {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  phone: string;
  email?: string | null;
  language: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

export default function TenantProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<TenantProfile | null>(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    language: 'en',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    async function fetchProfile() {
      try {
        setLoading(true);
        const response = await fetch('/api/tenant/profile');
        if (response.ok) {
          const data = await response.json();
          setProfile(data);
          setFormData({
            firstName: data.firstName || '',
            lastName: data.lastName || '',
            email: data.email || '',
            language: data.language || 'en',
          });
        } else {
          const errorData = await response.json();
          setErrors({ fetch: errorData.error || 'Failed to load profile' });
        }
      } catch (error) {
        console.error('Failed to fetch profile:', error);
        setErrors({ fetch: 'Failed to load profile. Please try again.' });
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, []);

  const handleProfileSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});

    // Validation
    const newErrors: Record<string, string> = {};
    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }
    if (formData.email && formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        newErrors.email = 'Invalid email format';
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setSaving(false);
      return;
    }

    try {
      const response = await fetch('/api/tenant/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          email: formData.email.trim() || null,
          language: formData.language,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setProfile(data);
        // Show success message
        alert('Profile updated successfully');
      } else {
        const data = await response.json();
        setErrors({ submit: data.error || 'Failed to update profile' });
      }
    } catch (error) {
      console.error('Failed to update profile:', error);
      setErrors({ submit: 'Failed to update profile. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  // Note: Password change is not implemented for tenants as they use OTP-based authentication
  // This section can be added later if password auth is implemented for tenants

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/tenant/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (errors.fetch) {
    return (
      <div className="space-y-4">
        <div className="p-4 rounded-md bg-destructive/10 text-destructive">{errors.fetch}</div>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Profile not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Profile Information */}
      <div>
        <h1 className="text-2xl font-bold mb-2">Profile & Settings</h1>
        <p className="text-muted-foreground">Update your personal information and preferences.</p>
      </div>

      {/* Personal Information Card */}
      <MobileCard>
        <h2 className="text-lg font-semibold mb-4">Personal Information</h2>
        <MobileForm onSubmit={handleProfileSubmit} isLoading={saving} submitLabel="Save Changes">
          <div className="space-y-4">
            <MobileFormField
              label="First Name"
              name="firstName"
              placeholder="Enter your first name"
              required
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              {...(errors.firstName ? { error: errors.firstName } : {})}
            />

            <MobileFormField
              label="Last Name"
              name="lastName"
              placeholder="Enter your last name"
              required
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              {...(errors.lastName ? { error: errors.lastName } : {})}
            />

            <div className="space-y-2">
              <label htmlFor="phone" className="text-base font-medium">
                Phone Number
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                value={profile.phone}
                disabled
                className="flex h-12 w-full rounded-md border border-input bg-muted px-4 py-3 text-base text-muted-foreground cursor-not-allowed"
              />
              <p className="text-xs text-muted-foreground">
                Phone number cannot be changed. Contact your building manager to update.
              </p>
            </div>

            <MobileFormField
              label="Email"
              name="email"
              type="email"
              placeholder="Enter your email (optional)"
              value={formData.email || ''}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              {...(errors.email ? { error: errors.email } : {})}
            />

            <div className="space-y-2">
              <label htmlFor="language" className="text-base font-medium">
                Preferred Language
              </label>
              <select
                id="language"
                name="language"
                value={formData.language}
                onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                className="flex h-12 w-full rounded-md border border-input bg-background px-4 py-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="en">English</option>
                <option value="am">አማርኛ (Amharic)</option>
                <option value="om">Afaan Oromoo</option>
                <option value="ti">ትግርኛ (Tigrigna)</option>
              </select>
              <p className="text-xs text-muted-foreground">
                This will be used for all communications and notifications.
              </p>
            </div>

            {errors.submit && (
              <div className="p-4 rounded-md bg-destructive/10 text-destructive text-sm">
                {errors.submit}
              </div>
            )}
          </div>
        </MobileForm>
      </MobileCard>

      {/* Notification Preferences Card */}
      <NotificationPreferencesSection />

      {/* Account Information Card */}
      <MobileCard>
        <h2 className="text-lg font-semibold mb-4">Account Information</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status:</span>
            <span className="font-medium capitalize">{profile.status}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Member since:</span>
            <span className="font-medium">
              {new Date(profile.createdAt || Date.now()).toLocaleDateString()}
            </span>
          </div>
        </div>
      </MobileCard>

      {/* Logout */}
      <Button variant="destructive" className="w-full h-12" onClick={handleLogout}>
        <LogOut className="mr-2 h-4 w-4" />
        Logout
      </Button>
    </div>
  );
}

// Notification Preferences Component
function NotificationPreferencesSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState({
    emailEnabled: true,
    smsEnabled: true,
    inAppEnabled: true,
    emailTypes: [] as string[],
    smsTypes: [] as string[],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const notificationTypes = [
    { value: 'invoice_created', label: 'Invoice Created' },
    { value: 'payment_due', label: 'Payment Due' },
    { value: 'payment_received', label: 'Payment Received' },
    { value: 'complaint_status_changed', label: 'Complaint Status Changed' },
    { value: 'work_order_assigned', label: 'Work Order Assigned' },
    { value: 'work_order_completed', label: 'Work Order Completed' },
    { value: 'lease_expiring', label: 'Lease Expiring' },
  ];

  useEffect(() => {
    async function fetchPreferences() {
      try {
        setLoading(true);
        const response = await fetch('/api/notifications/preferences');
        if (response.ok) {
          const data = await response.json();
          setPreferences(data.preferences);
        } else {
          console.error('Failed to load notification preferences');
        }
      } catch (error) {
        console.error('Failed to fetch preferences:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchPreferences();
  }, []);

  const handleSavePreferences = async () => {
    setSaving(true);
    setErrors({});

    try {
      const response = await fetch('/api/notifications/preferences', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(preferences),
      });

      if (response.ok) {
        alert('Notification preferences updated successfully');
      } else {
        const data = await response.json();
        setErrors({ submit: data.error || 'Failed to update preferences' });
      }
    } catch (error) {
      console.error('Failed to update preferences:', error);
      setErrors({ submit: 'Failed to update preferences. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const toggleType = (type: string, channel: 'emailTypes' | 'smsTypes') => {
    setPreferences((prev) => {
      const types = prev[channel];
      const newTypes = types.includes(type) ? types.filter((t) => t !== type) : [...types, type];
      return { ...prev, [channel]: newTypes };
    });
  };

  if (loading) {
    return (
      <MobileCard>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </MobileCard>
    );
  }

  return (
    <MobileCard>
      <div className="flex items-center gap-2 mb-4">
        <Bell className="h-5 w-5" />
        <h2 className="text-lg font-semibold">Notification Preferences</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Choose how you want to receive notifications
      </p>

      <div className="space-y-6">
        {/* Channel Toggles */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-muted-foreground" />
              <span className="text-base font-medium">In-App Notifications</span>
            </div>
            <Switch
              checked={preferences.inAppEnabled}
              onCheckedChange={(checked) =>
                setPreferences({ ...preferences, inAppEnabled: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-base font-medium">Email Notifications</span>
            </div>
            <Switch
              checked={preferences.emailEnabled}
              onCheckedChange={(checked) =>
                setPreferences({ ...preferences, emailEnabled: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <span className="text-base font-medium">WhatsApp/SMS Notifications</span>
            </div>
            <Switch
              checked={preferences.smsEnabled}
              onCheckedChange={(checked) => setPreferences({ ...preferences, smsEnabled: checked })}
            />
          </div>
        </div>

        {/* Email Types Selection */}
        {preferences.emailEnabled && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Email Notification Types</h3>
            <p className="text-xs text-muted-foreground">
              Select which notifications you want to receive via email
            </p>
            <div className="space-y-2">
              {notificationTypes.map((type) => (
                <div key={type.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`email-${type.value}`}
                    checked={preferences.emailTypes.includes(type.value)}
                    onCheckedChange={() => toggleType(type.value, 'emailTypes')}
                  />
                  <label
                    htmlFor={`email-${type.value}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    {type.label}
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SMS Types Selection */}
        {preferences.smsEnabled && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">WhatsApp/SMS Notification Types</h3>
            <p className="text-xs text-muted-foreground">
              Select which notifications you want to receive via WhatsApp/SMS
            </p>
            <div className="space-y-2">
              {notificationTypes.map((type) => (
                <div key={type.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`sms-${type.value}`}
                    checked={preferences.smsTypes.includes(type.value)}
                    onCheckedChange={() => toggleType(type.value, 'smsTypes')}
                  />
                  <label
                    htmlFor={`sms-${type.value}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    {type.label}
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}

        {errors.submit && (
          <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
            {errors.submit}
          </div>
        )}

        <Button onClick={handleSavePreferences} disabled={saving} className="w-full h-12">
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Preferences'
          )}
        </Button>
      </div>
    </MobileCard>
  );
}
