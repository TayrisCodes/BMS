'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/lib/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/lib/components/ui/card';
import { Badge } from '@/lib/components/ui/badge';
import { Label } from '@/lib/components/ui/label';
import { apiGet, apiDelete } from '@/lib/utils/api-client';
import { SubscriptionModal } from '@/lib/components/subscriptions/SubscriptionModal';
import type { SubscriptionTier, SubscriptionStatus, BillingCycle } from '@/lib/subscriptions/types';
import {
  Building2,
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Users,
  FileText,
  Calendar,
  CreditCard,
  DollarSign,
  Receipt,
  AlertCircle,
  Trash2,
  Edit,
  Globe,
  Palette,
  Shield,
  ExternalLink,
} from 'lucide-react';

interface Organization {
  id: string;
  _id: string;
  name: string;
  code: string;
  contactInfo?: {
    email?: string;
    phone?: string;
    address?: string;
  } | null;
  settings?: Record<string, unknown> | null;
  status: string;
  subscriptionId?: string | null;
  domain?: string | null;
  subdomain?: string | null;
  branding?: {
    logo?: string | null;
    primaryColor?: string | null;
    secondaryColor?: string | null;
    favicon?: string | null;
    companyName?: string | null;
    tagline?: string | null;
  } | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

interface AdminUser {
  id: string;
  name?: string | null;
  email?: string | null;
  phone: string;
  status: string;
  createdAt: string | Date;
}

interface Subscription {
  id: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  basePrice?: number;
  discountType?: 'percentage' | 'fixed' | null;
  discountValue?: number | null;
  price: number;
  startDate: string | Date;
  endDate?: string | Date | null;
  trialEndDate?: string | Date | null;
  nextBillingDate?: string | Date | null;
  autoRenew: boolean;
  maxBuildings?: number | null;
  maxUnits?: number | null;
  maxUsers?: number | null;
  features: string[];
  notes?: string | null;
}

interface OrganizationStats {
  buildings: number;
  users: number;
  tenants: number;
  leases: number;
  invoices: number;
  payments: number;
  totalRevenue: number;
  pendingInvoices: number;
}

export default function OrganizationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const organizationId = params?.id as string;

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<OrganizationStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false);

  async function fetchOrganization() {
    if (!organizationId) return;

    try {
      setIsLoading(true);
      setError(null);
      const data = await apiGet<{
        organization: Organization;
        subscription: Subscription | null;
        adminUsers?: AdminUser[];
        stats: OrganizationStats;
      }>(`/api/organizations/${organizationId}`);

      setOrganization(data.organization);
      setSubscription(data.subscription || null);
      setAdminUsers(data.adminUsers || []);
      setStats(data.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load organization');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchOrganization();
  }, [organizationId]);

  async function handleDelete() {
    if (
      !confirm('Are you sure you want to delete this organization? This will set it to inactive.')
    ) {
      return;
    }

    try {
      await apiDelete(`/api/organizations/${organizationId}`);
      router.push('/admin/organizations');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete organization');
    }
  }

  function getStatusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' {
    switch (status) {
      case 'active':
        return 'default';
      case 'inactive':
        return 'secondary';
      case 'suspended':
        return 'destructive';
      default:
        return 'default';
    }
  }

  function formatDate(date: string | Date | undefined): string {
    if (!date) return 'N/A';
    try {
      return new Date(date).toLocaleString();
    } catch {
      return 'N/A';
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading organization...</p>
        </div>
      </div>
    );
  }

  if (error || !organization) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
          {error || 'Organization not found'}
        </div>
        <Link href="/admin/organizations">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Organizations
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/organizations">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <Building2 className="h-8 w-8 text-primary" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold">{organization.name}</h1>
              <Badge variant={getStatusBadgeVariant(organization.status)}>
                {organization.status}
              </Badge>
            </div>
            <p className="text-muted-foreground">Organization Details</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setSubscriptionModalOpen(true)}>
            <CreditCard className="h-4 w-4 mr-2" />
            {subscription ? 'Manage Subscription' : 'Create Subscription'}
          </Button>
          <Link href={`/admin/organizations/${organizationId}/edit`}>
            <Button variant="outline">
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </Link>
          <Button variant="destructive" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Buildings</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.buildings || 0}</div>
            <p className="text-xs text-muted-foreground">Total buildings</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.users || 0}</div>
            <p className="text-xs text-muted-foreground">Total users</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tenants</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.tenants || 0}</div>
            <p className="text-xs text-muted-foreground">Active tenants</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Leases</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.leases || 0}</div>
            <p className="text-xs text-muted-foreground">Active leases</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {(stats?.totalRevenue || 0).toLocaleString()} ETB
            </div>
            <p className="text-xs text-muted-foreground">ETB collected</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Invoices</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.invoices || 0}</div>
            <p className="text-xs text-muted-foreground">Total invoices</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Payments</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.payments || 0}</div>
            <p className="text-xs text-muted-foreground">Total payments</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Invoices</CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats?.pendingInvoices || 0}</div>
            <p className="text-xs text-muted-foreground">Awaiting payment</p>
          </CardContent>
        </Card>
      </div>

      {/* Subscription Card */}
      {subscription && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Subscription</CardTitle>
                <CardDescription>Current subscription plan and billing information</CardDescription>
              </div>
              <Badge
                variant={
                  subscription.status === 'active' || subscription.status === 'trial'
                    ? 'default'
                    : 'destructive'
                }
              >
                {subscription.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <Label className="text-xs text-muted-foreground">Tier</Label>
                <p className="text-lg font-semibold capitalize">{subscription.tier}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Billing Cycle</Label>
                <p className="text-lg font-semibold capitalize">{subscription.billingCycle}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Price</Label>
                <p className="text-lg font-semibold">{subscription.price.toLocaleString()} ETB</p>
              </div>
              {subscription.nextBillingDate && (
                <div>
                  <Label className="text-xs text-muted-foreground">Next Billing Date</Label>
                  <p className="text-sm">{formatDate(subscription.nextBillingDate)}</p>
                </div>
              )}
              <div>
                <Label className="text-xs text-muted-foreground">Auto Renew</Label>
                <p className="text-sm">{subscription.autoRenew ? 'Yes' : 'No'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Organization Details */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>Organization identification details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Name</label>
              <p className="text-lg font-semibold">{organization.name}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Code</label>
              <p>
                <Badge variant="outline">{organization.code}</Badge>
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Organization ID</label>
              <p className="text-sm font-mono text-muted-foreground">{organization.id}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
            <CardDescription>Organization contact details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {organization.contactInfo?.email ? (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Email</label>
                  <p>{organization.contactInfo.email}</p>
                </div>
              </div>
            ) : null}
            {organization.contactInfo?.phone ? (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Phone</label>
                  <p>{organization.contactInfo.phone}</p>
                </div>
              </div>
            ) : null}
            {organization.contactInfo?.address ? (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Address</label>
                  <p>{organization.contactInfo.address}</p>
                </div>
              </div>
            ) : null}
            {!organization.contactInfo?.email &&
              !organization.contactInfo?.phone &&
              !organization.contactInfo?.address && (
                <p className="text-sm text-muted-foreground">No contact information available</p>
              )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Timestamps</CardTitle>
            <CardDescription>Organization creation and update dates</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <label className="text-sm font-medium text-muted-foreground">Created At</label>
                <p>{formatDate(organization.createdAt)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <label className="text-sm font-medium text-muted-foreground">Updated At</label>
                <p>{formatDate(organization.updatedAt)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Domain & Branding Section */}
      <div className="grid gap-6 md:grid-cols-2">
        {(organization.domain || organization.subdomain) && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                <CardTitle>Domain Configuration</CardTitle>
              </div>
              <CardDescription>Organization domain and subdomain settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {organization.subdomain && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Subdomain</label>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="font-mono text-sm">
                      {organization.subdomain}.bms.com
                    </p>
                    <a
                      href={`https://${organization.subdomain}.bms.com`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              )}
              {organization.domain && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Custom Domain</label>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="font-mono text-sm">{organization.domain}</p>
                    <a
                      href={`https://${organization.domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              )}
              {!organization.domain && !organization.subdomain && (
                <p className="text-sm text-muted-foreground">No domain configured</p>
              )}
            </CardContent>
          </Card>
        )}

        {organization.branding && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-primary" />
                <CardTitle>Branding</CardTitle>
              </div>
              <CardDescription>Organization branding and customization</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {organization.branding.primaryColor && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Primary Color</label>
                  <div className="flex items-center gap-2 mt-1">
                    <div
                      className="w-8 h-8 rounded border"
                      style={{ backgroundColor: organization.branding.primaryColor }}
                    />
                    <p className="font-mono text-sm">{organization.branding.primaryColor}</p>
                  </div>
                </div>
              )}
              {organization.branding.secondaryColor && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Secondary Color</label>
                  <div className="flex items-center gap-2 mt-1">
                    <div
                      className="w-8 h-8 rounded border"
                      style={{ backgroundColor: organization.branding.secondaryColor }}
                    />
                    <p className="font-mono text-sm">{organization.branding.secondaryColor}</p>
                  </div>
                </div>
              )}
              {organization.branding.companyName && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Display Name</label>
                  <p>{organization.branding.companyName}</p>
                </div>
              )}
              {organization.branding.tagline && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Tagline</label>
                  <p className="italic">{organization.branding.tagline}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Admin Users Section */}
      {adminUsers.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle>Organization Admin Users</CardTitle>
                  <CardDescription>
                    Users with ORG_ADMIN role for this organization
                  </CardDescription>
                </div>
              </div>
              <Link href="/admin/users">
                <Button variant="outline" size="sm">
                  <Users className="h-4 w-4 mr-2" />
                  Manage Users
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {adminUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-primary/10">
                      <Shield className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{user.name || 'N/A'}</p>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        {user.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {user.email}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {user.phone}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        user.status === 'active'
                          ? 'default'
                          : user.status === 'invited'
                            ? 'secondary'
                            : 'destructive'
                      }
                    >
                      {user.status}
                    </Badge>
                    <Link href={`/admin/users/${user.id}`}>
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <SubscriptionModal
        open={subscriptionModalOpen}
        onOpenChange={setSubscriptionModalOpen}
        organizationId={organizationId}
        existingSubscription={subscription}
        onSuccess={fetchOrganization}
      />
    </div>
  );
}
