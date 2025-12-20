'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/lib/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/lib/components/ui/table';
import { Badge } from '@/lib/components/ui/badge';
import { Input } from '@/lib/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/lib/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { StatCard } from '@/lib/components/dashboard/cards/StatCard';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import { apiGet } from '@/lib/utils/api-client';
import { SubscriptionModal } from '@/lib/components/subscriptions/SubscriptionModal';
import {
  CreditCard,
  Plus,
  Search,
  Eye,
  Edit,
  TrendingUp,
  DollarSign,
  AlertCircle,
  Calendar,
} from 'lucide-react';
import type { SubscriptionTier, SubscriptionStatus, BillingCycle } from '@/lib/subscriptions/types';

interface Subscription {
  id: string;
  _id: string;
  organizationId: string;
  organizationName: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  price: number;
  currency: string;
  startDate: string | Date;
  endDate?: string | Date | null;
  nextBillingDate?: string | Date | null;
  autoRenew: boolean;
  features: string[];
  createdAt: string | Date;
  updatedAt: string | Date;
}

interface SubscriptionStats {
  total: number;
  active: number;
  trial: number;
  expired: number;
  cancelled: number;
  suspended: number;
  mrr: number;
  arr: number;
  tierDistribution: {
    starter: number;
    growth: number;
    enterprise: number;
  };
  billingCycleDistribution: {
    monthly: number;
    quarterly: number;
    annually: number;
  };
  upcomingRenewals: number;
  expiringSoon: number;
}

export default function SubscriptionsPage() {
  const router = useRouter();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [stats, setStats] = useState<SubscriptionStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [billingCycleFilter, setBillingCycleFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        setError(null);

        const params = new URLSearchParams({
          page: page.toString(),
          limit: '50',
        });

        if (statusFilter !== 'all') {
          params.append('status', statusFilter);
        }
        if (tierFilter !== 'all') {
          params.append('tier', tierFilter);
        }
        if (billingCycleFilter !== 'all') {
          params.append('billingCycle', billingCycleFilter);
        }

        const [subscriptionsData, statsData] = await Promise.all([
          apiGet<{
            subscriptions: Subscription[];
            pagination: { page: number; limit: number; total: number; totalPages: number };
          }>(`/api/subscriptions?${params.toString()}`),
          apiGet<{ stats: SubscriptionStats }>('/api/subscriptions/stats'),
        ]);

        setSubscriptions(subscriptionsData.subscriptions || []);
        setPagination((prev) => subscriptionsData.pagination || prev);
        setStats(statsData.stats || null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load subscriptions');
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [page, statusFilter, tierFilter, billingCycleFilter]);

  const filteredSubscriptions = subscriptions.filter((sub) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      sub.organizationName.toLowerCase().includes(search) ||
      sub.tier.toLowerCase().includes(search) ||
      sub.status.toLowerCase().includes(search)
    );
  });

  function formatCurrency(amount: number): string {
    return `${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`;
  }

  function formatDate(date: string | Date | undefined | null): string {
    if (!date) return 'N/A';
    try {
      return new Date(date).toLocaleDateString();
    } catch {
      return 'N/A';
    }
  }

  function getStatusBadgeVariant(
    status: SubscriptionStatus,
  ): 'default' | 'secondary' | 'destructive' {
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

  function handleCreateSubscription(organizationId: string) {
    setSelectedOrgId(organizationId);
    setSelectedSubscription(null);
    setSubscriptionModalOpen(true);
  }

  function handleEditSubscription(subscription: Subscription) {
    setSelectedOrgId(null);
    setSelectedSubscription(subscription);
    setSubscriptionModalOpen(true);
  }

  function handleModalSuccess() {
    setSubscriptionModalOpen(false);
    // Refresh data
    window.location.reload();
  }

  return (
    <DashboardPage
      title="Subscription Management"
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'Subscriptions', href: '/admin/subscriptions' },
      ]}
    >
      {/* Stats Cards */}
      {stats && (
        <>
          <StatCard
            label="Total Subscriptions"
            value={stats.total}
            icon={CreditCard}
            loading={isLoading}
            error={error}
          />
          <StatCard
            label="Active Subscriptions"
            value={stats.active}
            icon={TrendingUp}
            loading={isLoading}
            error={error}
          />
          <StatCard
            label="Monthly Recurring Revenue"
            value={formatCurrency(stats.mrr)}
            icon={DollarSign}
            loading={isLoading}
            error={error}
          />
          <StatCard
            label="Annual Recurring Revenue"
            value={formatCurrency(stats.arr)}
            icon={DollarSign}
            loading={isLoading}
            error={error}
          />
          <StatCard
            label="Trial Subscriptions"
            value={stats.trial}
            icon={AlertCircle}
            loading={isLoading}
            error={error}
          />
          <StatCard
            label="Upcoming Renewals (30 days)"
            value={stats.upcomingRenewals}
            icon={Calendar}
            loading={isLoading}
            error={error}
          />
        </>
      )}

      {/* Header */}
      <div className="col-span-full flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Subscriptions</h1>
          <p className="text-muted-foreground">Manage organization subscriptions</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/organizations">
            <Button variant="outline">View Organizations</Button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="col-span-full bg-destructive/10 text-destructive p-4 rounded-lg">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="col-span-full flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by organization, tier, or status..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(value) => {
            setStatusFilter(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="trial">Trial</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={tierFilter}
          onValueChange={(value) => {
            setTierFilter(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by tier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tiers</SelectItem>
            <SelectItem value="starter">Starter</SelectItem>
            <SelectItem value="growth">Growth</SelectItem>
            <SelectItem value="enterprise">Enterprise</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={billingCycleFilter}
          onValueChange={(value) => {
            setBillingCycleFilter(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by billing" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Billing Cycles</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="quarterly">Quarterly</SelectItem>
            <SelectItem value="annually">Annually</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Subscriptions Table */}
      <div className="col-span-full border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Organization</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Billing Cycle</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Start Date</TableHead>
              <TableHead>Next Billing</TableHead>
              <TableHead>Auto Renew</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  <p className="text-muted-foreground">Loading subscriptions...</p>
                </TableCell>
              </TableRow>
            ) : filteredSubscriptions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  <p className="text-muted-foreground">
                    {subscriptions.length === 0
                      ? 'No subscriptions found. Create subscriptions from organization pages.'
                      : 'No subscriptions match your filters.'}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              filteredSubscriptions.map((subscription) => (
                <TableRow key={subscription.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/admin/organizations/${subscription.organizationId}`}
                      className="hover:underline"
                    >
                      {subscription.organizationName}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {subscription.tier}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(subscription.status)}>
                      {subscription.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="capitalize">{subscription.billingCycle}</TableCell>
                  <TableCell>{formatCurrency(subscription.price)}</TableCell>
                  <TableCell>{formatDate(subscription.startDate)}</TableCell>
                  <TableCell>{formatDate(subscription.nextBillingDate)}</TableCell>
                  <TableCell>
                    <Badge variant={subscription.autoRenew ? 'default' : 'secondary'}>
                      {subscription.autoRenew ? 'Yes' : 'No'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditSubscription(subscription)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Link href={`/admin/subscriptions/${subscription.id}`}>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="col-span-full flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}{' '}
            subscriptions
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page === pagination.totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Subscription Modal */}
      {selectedOrgId && (
        <SubscriptionModal
          open={subscriptionModalOpen}
          onOpenChange={setSubscriptionModalOpen}
          organizationId={selectedOrgId}
          existingSubscription={null}
          onSuccess={handleModalSuccess}
        />
      )}
      {selectedSubscription && (
        <SubscriptionModal
          open={subscriptionModalOpen}
          onOpenChange={setSubscriptionModalOpen}
          organizationId={selectedSubscription.organizationId}
          existingSubscription={selectedSubscription}
          onSuccess={handleModalSuccess}
        />
      )}
    </DashboardPage>
  );
}
