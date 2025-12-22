'use client';

import { useEffect, useState } from 'react';
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
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import { apiGet, apiPatch } from '@/lib/utils/api-client';
import { Building2, Save } from 'lucide-react';

interface Organization {
  _id: string;
  name: string;
  code: string;
  contactInfo?: {
    email?: string;
    phone?: string;
    address?: string;
  } | null;
  settings?: {
    [key: string]: unknown;
  } | null;
  branding?: {
    logo?: string | null;
    primaryColor?: string | null;
    secondaryColor?: string | null;
    favicon?: string | null;
    companyName?: string | null;
    tagline?: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export default function OrganizationSettingsPage() {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [tagline, setTagline] = useState('');
  const [primaryColor, setPrimaryColor] = useState('');
  const [secondaryColor, setSecondaryColor] = useState('');

  useEffect(() => {
    async function fetchOrganization() {
      try {
        setIsLoading(true);
        const data = (await apiGet<{ organization: Organization }>('/api/organizations/me')) as {
          organization: Organization;
        };
        setOrganization(data.organization);
        setName(data.organization.name || '');
        setEmail(data.organization.contactInfo?.email || '');
        setPhone(data.organization.contactInfo?.phone || '');
        setAddress(data.organization.contactInfo?.address || '');
        setCompanyName(data.organization.branding?.companyName || '');
        setTagline(data.organization.branding?.tagline || '');
        setPrimaryColor(data.organization.branding?.primaryColor || '');
        setSecondaryColor(data.organization.branding?.secondaryColor || '');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load organization');
      } finally {
        setIsLoading(false);
      }
    }

    fetchOrganization();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await apiPatch<{ organization?: Organization }>('/api/organizations/me', {
        name,
        contactInfo: {
          email: email || undefined,
          phone: phone || undefined,
          address: address || undefined,
        },
        branding: {
          companyName: companyName || undefined,
          tagline: tagline || undefined,
          primaryColor: primaryColor || undefined,
          secondaryColor: secondaryColor || undefined,
        },
      });

      setSuccess('Organization settings updated successfully');
      if (response.organization) {
        setOrganization(response.organization);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update organization');
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <DashboardPage
        title="Organization Settings"
        breadcrumbs={[
          { label: 'Organization', href: '/org' },
          { label: 'Settings', href: '/org/settings' },
          { label: 'Organization', href: '/org/settings/organization' },
        ]}
      >
        <div className="col-span-full">
          <p className="text-muted-foreground">Loading organization settings...</p>
        </div>
      </DashboardPage>
    );
  }

  return (
    <DashboardPage
      title="Organization Settings"
      breadcrumbs={[
        { label: 'Organization', href: '/org' },
        { label: 'Settings', href: '/org/settings' },
        { label: 'Organization', href: '/org/settings/organization' },
      ]}
    >
      <form onSubmit={handleSubmit} className="col-span-full space-y-6">
        {error && <div className="bg-destructive/10 text-destructive p-4 rounded-lg">{error}</div>}

        {success && (
          <div className="bg-green-500/10 text-green-600 dark:text-green-400 p-4 rounded-lg">
            {success}
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-primary" />
              <CardTitle>Organization Information</CardTitle>
            </div>
            <CardDescription>Update your organization&apos;s basic information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Organization Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Enter organization name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="code">Organization Code</Label>
              <Input
                id="code"
                value={organization?.code || ''}
                disabled
                className="bg-muted"
                placeholder="Auto-generated"
              />
              <p className="text-sm text-muted-foreground">
                Organization code cannot be changed. Contact support if you need to change it.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
            <CardDescription>Update your organization&apos;s contact details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contact@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+251 9XX XXX XXX"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street, City, Region"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Branding</CardTitle>
            <CardDescription>Customize your organization&apos;s branding</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">Company Display Name</Label>
              <Input
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Display name (can differ from legal name)"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tagline">Tagline</Label>
              <Input
                id="tagline"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="Your organization tagline"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="primaryColor">Primary Color</Label>
                <Input
                  id="primaryColor"
                  type="color"
                  value={primaryColor || '#000000'}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="secondaryColor">Secondary Color</Label>
                <Input
                  id="secondaryColor"
                  type="color"
                  value={secondaryColor || '#000000'}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button type="submit" disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </DashboardPage>
  );
}
