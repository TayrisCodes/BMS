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
import { Separator } from '@/lib/components/ui/separator';
import { apiGet } from '@/lib/utils/api-client';
import { SubscriptionModal } from '@/lib/components/subscriptions/SubscriptionModal';
import type { SubscriptionTier, SubscriptionStatus, BillingCycle } from '@/lib/subscriptions/types';
import {
  CreditCard,
  ArrowLeft,
  Calendar,
  DollarSign,
  Building2,
  CheckCircle2,
  Edit,
  RefreshCw,
  TrendingUp,
  Users,
  Package,
  FileText,
  Percent,
  Info,
} from 'lucide-react';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';

interface Subscription {
  id: string;
  _id: string;
  organizationId: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  basePrice?: number;
  discountType?: 'percentage' | 'fixed' | null;
  discountValue?: number | null;
  price: number;
  currency: string;
  startDate: string | Date;
  endDate?: string | Date | null;
  trialEndDate?: string | Date | null;
  nextBillingDate?: string | Date | null;
  autoRenew: boolean;
  maxBuildings?: number | null;
  maxUnits?: number | null;
  maxUsers?: number | null;
  features: string[];
  paymentMethod?: {
    provider: string;
    last4?: string;
    expiryDate?: string;
  } | null;
  lastPaymentDate?: string | Date | null;
  cancellationDate?: string | Date | null;
  cancellationReason?: string | null;
  notes?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

interface Organization {
  id: string;
  name: string;
  code: string;
}

export default function SubscriptionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const subscriptionId = params?.id as string;

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false);

  useEffect(() => {
    async function fetchSubscription() {
      if (!subscriptionId) return;

      try {
        setIsLoading(true);
        setError(null);
        const data = await apiGet<{ subscription: Subscription }>(
          `/api/subscriptions/${subscriptionId}`,
        );

        setSubscription(data.subscription);

        // Fetch organization details
        if (data.subscription.organizationId) {
          try {
            const orgData = await apiGet<{ organization: Organization }>(
              `/api/organizations/${data.subscription.organizationId}`,
            );
            setOrganization(orgData.organization);
          } catch {
            // Organization fetch failed, continue without it
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load subscription');
      } finally {
        setIsLoading(false);
      }
    }

    fetchSubscription();
  }, [subscriptionId]);

  function formatCurrency(amount: number): string {
    return `${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`;
  }

  function formatDate(date: string | Date | undefined | null): string {
    if (!date) return 'N/A';
    try {
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return 'N/A';
    }
  }

  function formatDateTime(date: string | Date | undefined | null): string {
    if (!date) return 'N/A';
    try {
      return new Date(date).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'N/A';
    }
  }

  function getStatusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' {
    switch (status) {
      case 'active':
      case 'trial':
        return 'default';
      case 'expired':
      case 'cancelled':
      case 'suspended':
        return 'destructive';
      default:
        return 'secondary';
    }
  }

  function getTierColor(tier: string): string {
    switch (tier.toLowerCase()) {
      case 'starter':
        return 'bg-blue-500';
      case 'growth':
        return 'bg-purple-500';
      case 'enterprise':
        return 'bg-amber-500';
      default:
        return 'bg-gray-500';
    }
  }

  if (isLoading) {
    return (
      <DashboardPage
        title="Subscription Details"
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Subscriptions', href: '/admin/subscriptions' },
          { label: 'Details', href: '#' },
        ]}
      >
        <div className="col-span-full flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading subscription...</p>
          </div>
        </div>
      </DashboardPage>
    );
  }

  if (error || !subscription) {
    return (
      <DashboardPage
        title="Subscription Details"
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Subscriptions', href: '/admin/subscriptions' },
          { label: 'Details', href: '#' },
        ]}
      >
        <div className="col-span-full">
          <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
            {error || 'Subscription not found'}
          </div>
          <Link href="/admin/subscriptions">
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Subscriptions
            </Button>
          </Link>
        </div>
      </DashboardPage>
    );
  }

  const hasDiscount =
    subscription.discountType &&
    subscription.discountValue &&
    subscription.basePrice &&
    subscription.basePrice !== subscription.price;
  const savings =
    hasDiscount && subscription.basePrice ? subscription.basePrice - subscription.price : 0;

  return (
    <DashboardPage
      title="Subscription Details"
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'Subscriptions', href: '/admin/subscriptions' },
        { label: 'Details', href: '#' },
      ]}
    >
      {/* Header Section */}
      <div className="col-span-full">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <Link href="/admin/subscriptions">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className={`h-3 w-3 rounded-full ${getTierColor(subscription.tier)}`}></div>
                <h1 className="text-3xl font-bold">
                  {organization?.name || 'Organization'} Subscription
                </h1>
                <Badge variant={getStatusBadgeVariant(subscription.status)} className="text-sm">
                  {subscription.status}
                </Badge>
              </div>
              <p className="text-muted-foreground">
                {subscription.tier.charAt(0).toUpperCase() + subscription.tier.slice(1)} tier •{' '}
                {subscription.billingCycle} billing
              </p>
            </div>
          </div>
          <Button onClick={() => setSubscriptionModalOpen(true)} size="lg">
            <Edit className="h-4 w-4 mr-2" />
            Edit Subscription
          </Button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <Card className="col-span-full lg:col-span-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Pricing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <p className="text-3xl font-bold">{formatCurrency(subscription.price)}</p>
              <p className="text-sm text-muted-foreground">
                Final price per {subscription.billingCycle}
              </p>
            </div>
            {hasDiscount && subscription.basePrice && (
              <>
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Base price:</span>
                    <span className="line-through">{formatCurrency(subscription.basePrice)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Discount:</span>
                    <span className="font-semibold text-green-600">
                      {subscription.discountType === 'percentage'
                        ? `${subscription.discountValue}%`
                        : formatCurrency(subscription.discountValue || 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm font-semibold pt-2 border-t">
                    <span>You save:</span>
                    <span className="text-green-600">{formatCurrency(savings)}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="col-span-full lg:col-span-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Billing Cycle
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <p className="text-2xl font-bold capitalize">{subscription.billingCycle}</p>
              <p className="text-sm text-muted-foreground">Billing frequency</p>
            </div>
            <Separator />
            <div className="flex items-center gap-2">
              <Badge variant={subscription.autoRenew ? 'default' : 'secondary'}>
                {subscription.autoRenew ? 'Auto-renew enabled' : 'Auto-renew disabled'}
              </Badge>
            </div>
            {subscription.nextBillingDate && (
              <div className="pt-2">
                <p className="text-xs text-muted-foreground mb-1">Next billing</p>
                <p className="text-sm font-medium">{formatDate(subscription.nextBillingDate)}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="col-span-full lg:col-span-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4" />
            Limits
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-2xl font-bold">{subscription.maxBuildings ?? '∞'}</p>
              <p className="text-xs text-muted-foreground">Buildings</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{subscription.maxUnits ?? '∞'}</p>
              <p className="text-xs text-muted-foreground">Units</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{subscription.maxUsers ?? '∞'}</p>
              <p className="text-xs text-muted-foreground">Users</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timeline Card */}
      <Card className="col-span-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Timeline & Important Dates
          </CardTitle>
          <CardDescription>Key dates for this subscription</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                <span>Start Date</span>
              </div>
              <p className="text-base font-semibold">{formatDate(subscription.startDate)}</p>
              <p className="text-xs text-muted-foreground">
                {formatDateTime(subscription.startDate)}
              </p>
            </div>

            {subscription.trialEndDate && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="h-2 w-2 rounded-full bg-yellow-500"></div>
                  <span>Trial End Date</span>
                </div>
                <p className="text-base font-semibold">{formatDate(subscription.trialEndDate)}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(subscription.trialEndDate)}
                </p>
              </div>
            )}

            {subscription.endDate && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="h-2 w-2 rounded-full bg-orange-500"></div>
                  <span>End Date</span>
                </div>
                <p className="text-base font-semibold">{formatDate(subscription.endDate)}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(subscription.endDate)}
                </p>
              </div>
            )}

            {subscription.nextBillingDate && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <RefreshCw className="h-3 w-3" />
                  <span>Next Billing</span>
                </div>
                <p className="text-base font-semibold">
                  {formatDate(subscription.nextBillingDate)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(subscription.nextBillingDate)}
                </p>
              </div>
            )}

            {subscription.cancellationDate && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="h-2 w-2 rounded-full bg-red-500"></div>
                  <span>Cancellation Date</span>
                </div>
                <p className="text-base font-semibold">
                  {formatDate(subscription.cancellationDate)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(subscription.cancellationDate)}
                </p>
              </div>
            )}
          </div>

          {subscription.cancellationReason && (
            <>
              <Separator className="my-4" />
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Cancellation Reason</p>
                <p className="text-sm">{subscription.cancellationReason}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Features Card */}
      <Card className="col-span-full lg:col-span-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            Included Features
          </CardTitle>
          <CardDescription>Features enabled for this subscription tier</CardDescription>
        </CardHeader>
        <CardContent>
          {subscription.features && subscription.features.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {subscription.features.map((feature, index) => (
                <div key={index} className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                  <span className="text-sm">{feature}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No features listed</p>
          )}
        </CardContent>
      </Card>

      {/* Organization & Notes Card */}
      <Card className="col-span-full lg:col-span-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Organization & Notes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {organization && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">Organization</p>
              <Link
                href={`/admin/organizations/${subscription.organizationId}`}
                className="flex items-center gap-2 text-primary hover:underline group"
              >
                <Building2 className="h-4 w-4" />
                <span className="font-medium">{organization.name}</span>
                <span className="text-sm text-muted-foreground">({organization.code})</span>
              </Link>
            </div>
          )}

          {subscription.notes && (
            <>
              <Separator />
              <div>
                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  Notes
                </p>
                <p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded-lg">
                  {subscription.notes}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Subscription Modal */}
      <SubscriptionModal
        open={subscriptionModalOpen}
        onOpenChange={setSubscriptionModalOpen}
        organizationId={subscription.organizationId}
        existingSubscription={subscription}
        onSuccess={() => {
          setSubscriptionModalOpen(false);
          window.location.reload();
        }}
      />
    </DashboardPage>
  );
}
