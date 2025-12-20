'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/lib/components/ui/button';
import { Input } from '@/lib/components/ui/input';
import { Label } from '@/lib/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/lib/components/ui/card';
import { Loader2, ArrowLeft, Mail, Phone, UserPlus } from 'lucide-react';
import { apiGet } from '@/lib/utils/api-client';
import type { UserRole } from '@/lib/auth/types';
import { RoleSelector } from '@/components/users/RoleSelector';

interface Organization {
  id: string;
  name: string;
  code: string;
}

export default function InviteUserPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isOrgAdmin, setIsOrgAdmin] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    name: '',
    password: '',
    roles: [] as UserRole[],
    organizationId: '',
    createType: 'invite' as 'invite' | 'direct', // 'invite' = send email, 'direct' = create with password
    emailFrom: '',
    emailFromName: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [invitationToken, setInvitationToken] = useState<string | null>(null);

  // Roles that ORG_ADMIN can assign
  const ORG_ADMIN_ALLOWED_ROLES: UserRole[] = [
    'BUILDING_MANAGER',
    'FACILITY_MANAGER',
    'ACCOUNTANT',
    'SECURITY',
    'TECHNICIAN',
    'AUDITOR',
  ];

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        // Check user roles
        const profile = await apiGet<{ roles: UserRole[] }>('/api/users/me');
        const roles = profile.roles || [];
        const superAdmin = roles.includes('SUPER_ADMIN');
        const orgAdmin = roles.includes('ORG_ADMIN');
        setIsSuperAdmin(superAdmin);
        setIsOrgAdmin(orgAdmin);

        // Load organizations if SUPER_ADMIN
        if (superAdmin) {
          const orgsData = await apiGet<{ organizations: Organization[] }>('/api/organizations');
          setOrganizations(orgsData.organizations || []);
        }
      } catch (err) {
        console.error('Failed to load data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    setSuccessMessage(null);
    setInvitationToken(null);

    // Validation
    const newErrors: Record<string, string> = {};

    if (!formData.phone || !formData.phone.trim()) {
      newErrors.phone = 'Phone is required';
    }

    if (!formData.email && !formData.phone) {
      newErrors.email = 'Either email or phone is required';
    }

    if (formData.email && formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        newErrors.email = 'Invalid email format';
      }
    }

    if (formData.roles.length === 0) {
      newErrors.roles = 'At least one role is required';
    }

    if (isSuperAdmin && !formData.organizationId) {
      newErrors.organizationId = 'Organization is required';
    }

    // If direct creation, password is required
    if (formData.createType === 'direct') {
      if (!formData.password || formData.password.trim().length < 8) {
        newErrors.password = 'Password is required and must be at least 8 characters';
      }
    }

    // If sending invitation, email is required
    if (formData.createType === 'invite' && !formData.email) {
      newErrors.email = 'Email is required to send invitation';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setSaving(false);
      return;
    }

    try {
      const response = await fetch('/api/users/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email.trim() || null,
          phone: formData.phone.trim(),
          name: formData.name.trim() || null,
          password: formData.createType === 'direct' ? formData.password.trim() : undefined,
          roles: formData.roles,
          organizationId: isSuperAdmin ? formData.organizationId : undefined,
          createType: formData.createType,
          emailFrom: formData.emailFrom.trim() || undefined,
          emailFromName: formData.emailFromName.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        if (formData.createType === 'direct') {
          setSuccessMessage('User created successfully!');
        } else {
          setSuccessMessage('User invitation sent successfully!');
          if (data.token) {
            setInvitationToken(data.token);
          }
        }
        // Reset form
        setFormData({
          email: '',
          phone: '',
          name: '',
          password: '',
          roles: [],
          organizationId: '',
          createType: 'invite',
          emailFrom: '',
          emailFromName: '',
        });
      } else {
        setErrors({ submit: data.error || 'Failed to send invitation' });
      }
    } catch (error) {
      console.error('Failed to send invitation:', error);
      setErrors({ submit: 'Failed to send invitation. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/users">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Users
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <UserPlus className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Invite User</h1>
            <p className="text-muted-foreground">Send an invitation to a new user</p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User Information</CardTitle>
          <CardDescription>
            Enter the user&apos;s contact information and select their roles.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name (Optional)</Label>
              <Input
                id="name"
                type="text"
                placeholder="Enter full name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">
                Email <span className="text-muted-foreground">(Optional)</span>
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="pl-10"
                />
              </div>
              {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">
                Phone <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+251911000000"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  required
                  className="pl-10"
                />
              </div>
              {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="createType">User Creation Method</Label>
              <select
                id="createType"
                value={formData.createType}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    createType: e.target.value as 'invite' | 'direct',
                    password: '', // Clear password when switching
                  })
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="invite">Send Invitation Email (User sets password)</option>
                <option value="direct">Create Directly (Set password now)</option>
              </select>
              <p className="text-xs text-muted-foreground">
                {formData.createType === 'invite'
                  ? 'User will receive an email with activation link to set their password'
                  : 'User will be created immediately with the password you set'}
              </p>
            </div>

            {formData.createType === 'direct' && (
              <div className="space-y-2">
                <Label htmlFor="password">
                  Password <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter password (min 8 characters)"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                />
                {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                <p className="text-xs text-muted-foreground">
                  Password must be at least 8 characters with uppercase, lowercase, number, and
                  special character.
                </p>
              </div>
            )}

            {formData.createType === 'invite' && (
              <div className="space-y-4 border rounded-lg p-4 bg-muted/50">
                <div className="space-y-2">
                  <Label htmlFor="emailFrom">Email Sender Address (Optional)</Label>
                  <Input
                    id="emailFrom"
                    type="email"
                    placeholder="noreply@example.com"
                    value={formData.emailFrom}
                    onChange={(e) => setFormData({ ...formData, emailFrom: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave empty to use system default email. Can be different from account creation
                    email.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="emailFromName">Email Sender Name (Optional)</Label>
                  <Input
                    id="emailFromName"
                    type="text"
                    placeholder="BMS Team"
                    value={formData.emailFromName}
                    onChange={(e) => setFormData({ ...formData, emailFromName: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Display name for the email sender (e.g., &quot;Your Organization Name&quot;)
                  </p>
                </div>
              </div>
            )}

            {isSuperAdmin && (
              <div className="space-y-2">
                <Label htmlFor="organizationId">
                  Organization <span className="text-destructive">*</span>
                </Label>
                <select
                  id="organizationId"
                  value={formData.organizationId}
                  onChange={(e) => setFormData({ ...formData, organizationId: e.target.value })}
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Select organization</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name} ({org.code})
                    </option>
                  ))}
                </select>
                {errors.organizationId && (
                  <p className="text-sm text-destructive">{errors.organizationId}</p>
                )}
              </div>
            )}

            <div className="space-y-4">
              <RoleSelector
                selectedRoles={formData.roles}
                onRolesChange={(roles) => setFormData({ ...formData, roles })}
                allowedRoles={isOrgAdmin && !isSuperAdmin ? ORG_ADMIN_ALLOWED_ROLES : undefined}
                showPermissionPreview={true}
              />
              {errors.roles && <p className="text-sm text-destructive">{errors.roles}</p>}
            </div>

            {successMessage && (
              <div className="p-4 rounded-md bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200">
                <p className="font-medium">{successMessage}</p>
                {invitationToken && (
                  <div className="mt-2 text-sm">
                    <p className="font-medium">Invitation Token (for testing):</p>
                    <code className="block mt-1 p-2 bg-green-100 dark:bg-green-900/40 rounded text-xs break-all">
                      {invitationToken}
                    </code>
                    <p className="mt-2 text-xs">
                      Activation URL:{' '}
                      <code className="bg-green-100 dark:bg-green-900/40 px-1 rounded">
                        /auth/activate/{invitationToken}
                      </code>
                    </p>
                  </div>
                )}
              </div>
            )}

            {errors.submit && (
              <div className="p-4 rounded-md bg-destructive/10 text-destructive text-sm">
                {errors.submit}
              </div>
            )}

            <div className="flex gap-4">
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending Invitation...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Send Invitation
                  </>
                )}
              </Button>
              <Link href="/admin/users">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
