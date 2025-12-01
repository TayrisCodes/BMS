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
import { Checkbox } from '@/lib/components/ui/checkbox';
import { Loader2, ArrowLeft, Mail, Phone, UserPlus } from 'lucide-react';
import { apiGet } from '@/lib/utils/api-client';
import type { UserRole } from '@/lib/auth/types';

interface Organization {
  id: string;
  name: string;
  code: string;
}

const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  SUPER_ADMIN: 'Platform owner with full system access across all organizations',
  ORG_ADMIN: 'Organization administrator with full access to their organization',
  BUILDING_MANAGER: 'Manages a specific building: units, tenants, complaints, invoices',
  FACILITY_MANAGER: 'Manages maintenance, assets, and facility operations',
  ACCOUNTANT: 'Manages invoices, payments, and financial operations',
  SECURITY: 'Manages security, visitor logs, and parking operations',
  TECHNICIAN: 'Executes maintenance work orders and logs activities',
  TENANT: 'Tenant portal access (own data only)',
  AUDITOR: 'Read-only access for auditing and reporting',
};

export default function InviteUserPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    name: '',
    roles: [] as UserRole[],
    organizationId: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [invitationToken, setInvitationToken] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        // Check if user is SUPER_ADMIN
        const profile = await apiGet<{ roles: UserRole[] }>('/api/users/me');
        const roles = profile.roles || [];
        const superAdmin = roles.includes('SUPER_ADMIN');
        setIsSuperAdmin(superAdmin);

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

  const handleRoleToggle = (role: UserRole) => {
    setFormData((prev) => ({
      ...prev,
      roles: prev.roles.includes(role)
        ? prev.roles.filter((r) => r !== role)
        : [...prev.roles, role],
    }));
  };

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
          roles: formData.roles,
          organizationId: isSuperAdmin ? formData.organizationId : undefined,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccessMessage('User invitation sent successfully!');
        if (data.token) {
          setInvitationToken(data.token);
        }
        // Reset form
        setFormData({
          email: '',
          phone: '',
          name: '',
          roles: [],
          organizationId: '',
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
              <Label>
                Roles <span className="text-destructive">*</span>
              </Label>
              <div className="space-y-3 border rounded-lg p-4">
                {(Object.keys(ROLE_DESCRIPTIONS) as UserRole[]).map((role) => (
                  <div key={role} className="flex items-start space-x-3">
                    <Checkbox
                      id={role}
                      checked={formData.roles.includes(role)}
                      onCheckedChange={() => handleRoleToggle(role)}
                    />
                    <div className="flex-1">
                      <label
                        htmlFor={role}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {role.replace(/_/g, ' ')}
                      </label>
                      <p className="text-xs text-muted-foreground mt-1">
                        {ROLE_DESCRIPTIONS[role]}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
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
