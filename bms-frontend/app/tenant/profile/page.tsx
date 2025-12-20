'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MobileCard } from '@/lib/components/tenant/MobileCard';
import { MobileForm, MobileFormField } from '@/lib/components/tenant/MobileForm';
import { Button } from '@/lib/components/ui/button';
import {
  LogOut,
  Loader2,
  Bell,
  Mail,
  MessageSquare,
  Smartphone,
  Shield,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { Switch } from '@/lib/components/ui/switch';
import { Checkbox } from '@/lib/components/ui/checkbox';
import { Badge } from '@/lib/components/ui/badge';

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
  const [logoutAllLoading, setLogoutAllLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [loginHistory, setLoginHistory] = useState<
    {
      id?: string;
      action: string;
      createdAt: string;
      ipAddress?: string | null;
      userAgent?: string | null;
    }[]
  >([]);
  const [profile, setProfile] = useState<TenantProfile | null>(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    language: 'en',
    preferredContactMethod: 'in_app',
    quietHoursStart: '',
    quietHoursEnd: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelation: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fetchProfile = useCallback(async () => {
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
          preferredContactMethod: data.preferredContactMethod || 'in_app',
          quietHoursStart: data.quietHoursStart || '',
          quietHoursEnd: data.quietHoursEnd || '',
          emergencyContactName: data.emergencyContactName || '',
          emergencyContactPhone: data.emergencyContactPhone || '',
          emergencyContactRelation: data.emergencyContactRelation || '',
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
  }, []);

  const fetchLoginHistory = useCallback(async () => {
    try {
      setHistoryLoading(true);
      setHistoryError(null);
      const res = await fetch('/api/tenant/login-history?limit=20');
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to load login history');
      }
      const data = await res.json();
      setLoginHistory(data.logs || []);
    } catch (err) {
      console.error('Failed to fetch login history:', err);
      setHistoryError(err instanceof Error ? err.message : 'Failed to load login history');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
    fetchLoginHistory();
  }, [fetchProfile, fetchLoginHistory]);

  const parseUserAgent = (userAgent: string) => {
    // Simple user agent parsing
    let device = 'Unknown Device';
    let browser = 'Unknown Browser';

    if (
      userAgent.includes('Mobile') ||
      userAgent.includes('Android') ||
      userAgent.includes('iPhone')
    ) {
      device = 'Mobile Device';
    } else if (userAgent.includes('Tablet') || userAgent.includes('iPad')) {
      device = 'Tablet';
    } else {
      device = 'Desktop';
    }

    if (userAgent.includes('Chrome')) browser = 'Chrome';
    else if (userAgent.includes('Firefox')) browser = 'Firefox';
    else if (userAgent.includes('Safari')) browser = 'Safari';
    else if (userAgent.includes('Edge')) browser = 'Edge';

    return { device, browser };
  };

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
          preferredContactMethod: formData.preferredContactMethod,
          quietHoursStart: formData.quietHoursStart || null,
          quietHoursEnd: formData.quietHoursEnd || null,
          emergencyContactName: formData.emergencyContactName.trim() || null,
          emergencyContactPhone: formData.emergencyContactPhone.trim() || null,
          emergencyContactRelation: formData.emergencyContactRelation.trim() || null,
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

  const handleChangePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});

    const formData = new FormData(e.currentTarget);
    const currentPassword = formData.get('currentPassword')?.toString() || '';
    const newPassword = formData.get('newPassword')?.toString() || '';
    const confirmPassword = formData.get('confirmPassword')?.toString() || '';

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      setErrors({ password: 'All password fields are required' });
      setSaving(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrors({ password: 'New passwords do not match' });
      setSaving(false);
      return;
    }

    if (newPassword.length < 8) {
      setErrors({ password: 'Password must be at least 8 characters long' });
      setSaving(false);
      return;
    }

    try {
      const response = await fetch('/api/tenant/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      if (response.ok) {
        alert('Password changed successfully');
        (e.target as HTMLFormElement).reset();
      } else {
        const data = await response.json();
        setErrors({ password: data.error || 'Failed to change password' });
      }
    } catch (error) {
      console.error('Failed to change password:', error);
      setErrors({ password: 'Failed to change password. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePhone = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});

    const formData = new FormData(e.currentTarget);
    const newPhone = formData.get('newPhone')?.toString() || '';
    const password = formData.get('phonePassword')?.toString() || '';

    // Validation
    if (!newPhone || !password) {
      setErrors({ phone: 'Phone number and password are required' });
      setSaving(false);
      return;
    }

    try {
      const response = await fetch('/api/tenant/change-phone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          newPhone,
          password,
        }),
      });

      if (response.ok) {
        alert('Phone number changed successfully. Please log in again.');
        router.push('/tenant/login');
      } else {
        const data = await response.json();
        setErrors({ phone: data.error || 'Failed to change phone number' });
      }
    } catch (error) {
      console.error('Failed to change phone:', error);
      setErrors({ phone: 'Failed to change phone number. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/tenant/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleLogoutAll = async () => {
    try {
      setLogoutAllLoading(true);
      await fetch('/api/tenant/logout-all', { method: 'POST' });
      router.push('/tenant/login');
    } catch (error) {
      console.error('Logout-all failed:', error);
    } finally {
      setLogoutAllLoading(false);
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

      {/* Communication Preferences Card */}
      <MobileCard>
        <h2 className="text-lg font-semibold mb-4">Communication Preferences</h2>
        <MobileForm
          onSubmit={handleProfileSubmit}
          isLoading={saving}
          submitLabel="Save Preferences"
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="preferredContactMethod" className="text-base font-medium">
                Preferred Contact Method
              </label>
              <select
                id="preferredContactMethod"
                name="preferredContactMethod"
                value={formData.preferredContactMethod}
                onChange={(e) =>
                  setFormData({ ...formData, preferredContactMethod: e.target.value })
                }
                className="flex h-12 w-full rounded-md border border-input bg-background px-4 py-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="in_app">In-App</option>
                <option value="phone">Phone</option>
                <option value="email">Email</option>
              </select>
              <p className="text-xs text-muted-foreground">
                How you prefer to receive important communications
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-base font-medium">Quiet Hours (Optional)</label>
              <p className="text-xs text-muted-foreground mb-2">
                Set times when you prefer not to receive non-urgent notifications
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="quietHoursStart" className="text-xs text-muted-foreground">
                    Start Time
                  </label>
                  <input
                    id="quietHoursStart"
                    name="quietHoursStart"
                    type="time"
                    value={formData.quietHoursStart}
                    onChange={(e) => setFormData({ ...formData, quietHoursStart: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="quietHoursEnd" className="text-xs text-muted-foreground">
                    End Time
                  </label>
                  <input
                    id="quietHoursEnd"
                    name="quietHoursEnd"
                    type="time"
                    value={formData.quietHoursEnd}
                    onChange={(e) => setFormData({ ...formData, quietHoursEnd: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>
          </div>
        </MobileForm>
      </MobileCard>

      {/* Emergency Contact Card */}
      <MobileCard>
        <h2 className="text-lg font-semibold mb-4">Emergency Contact</h2>
        <MobileForm onSubmit={handleProfileSubmit} isLoading={saving} submitLabel="Save Contact">
          <div className="space-y-4">
            <MobileFormField
              label="Contact Name"
              name="emergencyContactName"
              placeholder="Full name"
              value={formData.emergencyContactName}
              onChange={(e) => setFormData({ ...formData, emergencyContactName: e.target.value })}
            />
            <MobileFormField
              label="Contact Phone"
              name="emergencyContactPhone"
              type="tel"
              placeholder="+251912345678"
              value={formData.emergencyContactPhone}
              onChange={(e) => setFormData({ ...formData, emergencyContactPhone: e.target.value })}
            />
            <MobileFormField
              label="Relationship"
              name="emergencyContactRelation"
              placeholder="e.g., Spouse, Parent, Friend"
              value={formData.emergencyContactRelation}
              onChange={(e) =>
                setFormData({ ...formData, emergencyContactRelation: e.target.value })
              }
            />
            <p className="text-xs text-muted-foreground">
              This contact will be used in case of emergencies only
            </p>
          </div>
        </MobileForm>
      </MobileCard>

      {/* Notification Preferences Card */}
      <NotificationPreferencesSection />

      {/* Change Password Card */}
      <MobileCard>
        <h2 className="text-lg font-semibold mb-4">Change Password</h2>
        <MobileForm
          onSubmit={handleChangePassword}
          isLoading={saving}
          submitLabel="Change Password"
        >
          <div className="space-y-4">
            <MobileFormField
              label="Current Password"
              name="currentPassword"
              type="password"
              placeholder="Enter current password"
              required
              {...(errors.password ? { error: errors.password } : {})}
            />
            <MobileFormField
              label="New Password"
              name="newPassword"
              type="password"
              placeholder="Enter new password"
              required
            />
            <MobileFormField
              label="Confirm New Password"
              name="confirmPassword"
              type="password"
              placeholder="Confirm new password"
              required
            />
            <p className="text-xs text-muted-foreground">
              Password must be at least 8 characters and include uppercase, lowercase, number, and
              special character
            </p>
          </div>
        </MobileForm>
      </MobileCard>

      {/* Security Actions */}
      <MobileCard>
        <div className="flex items-center gap-2 mb-3">
          <Shield className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Security</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Manage your active sessions and devices. You can revoke access from any device at any
          time.
        </p>
        <div className="flex flex-col gap-3">
          <Button variant="outline" onClick={handleLogout} className="w-full">
            <LogOut className="mr-2 h-4 w-4" />
            Logout (this session)
          </Button>
          <Button
            variant="destructive"
            onClick={handleLogoutAll}
            disabled={logoutAllLoading}
            className="w-full"
          >
            {logoutAllLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Logging out...
              </>
            ) : (
              <>
                <LogOut className="mr-2 h-4 w-4" />
                Logout all sessions
              </>
            )}
          </Button>
        </div>
      </MobileCard>

      {/* Active Sessions / Device Management */}
      <MobileCard>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Active Sessions</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchLoginHistory} disabled={historyLoading}>
            <RefreshCw className={`h-4 w-4 ${historyLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        {historyLoading ? (
          <div className="flex items-center justify-center py-4 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading sessions...
          </div>
        ) : historyError ? (
          <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
            {historyError}
          </div>
        ) : loginHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active sessions found.</p>
        ) : (
          <div className="space-y-3">
            {loginHistory.slice(0, 5).map((log, index) => {
              const isCurrentSession = index === 0; // Assume most recent is current
              const deviceInfo = log.userAgent
                ? parseUserAgent(log.userAgent)
                : { device: 'Unknown Device', browser: 'Unknown Browser' };

              return (
                <div
                  key={log.id || log.createdAt}
                  className={`p-3 rounded-lg border ${isCurrentSession ? 'border-primary bg-primary/5' : ''}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{deviceInfo.device}</span>
                        {isCurrentSession && (
                          <Badge variant="default" className="text-xs">
                            Current
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">{deviceInfo.browser}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        IP: {log.ipAddress || 'Unknown'} •{' '}
                        {new Date(log.createdAt).toLocaleString()}
                      </div>
                    </div>
                    {!isCurrentSession && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          // Revoke session functionality
                          if (confirm('Are you sure you want to revoke access from this device?')) {
                            // This would call an API to revoke the session
                            alert('Session revocation feature coming soon');
                          }
                        }}
                        className="text-destructive hover:text-destructive"
                      >
                        Revoke
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </MobileCard>

      {/* Full Login History */}
      {loginHistory.length > 5 && (
        <MobileCard>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Full Login History</h2>
          </div>
          <div className="space-y-3">
            {loginHistory.slice(5).map((log) => (
              <div key={log.id || log.createdAt} className="p-3 rounded-lg border">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium capitalize">{log.action}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  IP: {log.ipAddress || 'Unknown'}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {log.userAgent ? parseUserAgent(log.userAgent).device : 'Unknown Device'}
                </div>
              </div>
            ))}
          </div>
        </MobileCard>
      )}

      {/* Change Phone Number Card */}
      <MobileCard>
        <h2 className="text-lg font-semibold mb-4">Change Phone Number</h2>
        <MobileForm onSubmit={handleChangePhone} isLoading={saving} submitLabel="Change Phone">
          <div className="space-y-4">
            <MobileFormField
              label="New Phone Number"
              name="newPhone"
              type="tel"
              placeholder="+251912345678"
              required
              {...(errors.phone ? { error: errors.phone } : {})}
            />
            <MobileFormField
              label="Confirm with Password"
              name="phonePassword"
              type="password"
              placeholder="Enter your password"
              required
            />
            <p className="text-xs text-muted-foreground">
              You will need to log in again after changing your phone number
            </p>
          </div>
        </MobileForm>
      </MobileCard>

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
