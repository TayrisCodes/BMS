'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MobileCard } from '@/lib/components/tenant/MobileCard';
import { MobileList } from '@/lib/components/tenant/MobileList';
import { SwipeableCard } from '@/lib/components/tenant/SwipeableCard';
import { Button } from '@/lib/components/ui/button';
import { Badge } from '@/lib/components/ui/badge';
import { DashboardCardsSkeleton, ListItemSkeleton } from '@/lib/components/tenant/LoadingSkeleton';
import {
  ArrowRight,
  Receipt,
  MessageSquare,
  FileText,
  TrendingUp,
  Calendar,
  CreditCard,
  RefreshCw,
  AlertCircle,
  Wrench,
  Clock,
  Activity,
  AlertTriangle,
} from 'lucide-react';

interface DashboardData {
  balance: number;
  overdueAmount?: number;
  nextInvoice?: {
    id: string;
    number: string;
    amount: number;
    dueDate: string;
    daysUntilDue: number;
  };
  totalPaidThisMonth: number;
  invoicesCount: number;
  complaintsCount: number;
  recentInvoices: Array<{
    id: string;
    number: string;
    amount: number;
    dueDate: string;
    status: string;
  }>;
  maintenanceRequestsSummary?: {
    total: number;
    open: number;
    urgent: number;
    recentUpdates: Array<{
      id: string;
      title: string;
      status: string;
      urgency: string | null;
      updatedAt: string;
    }>;
  };
  leaseExpirationInfo?: {
    endDate: string;
    daysUntilExpiry: number;
    renewalNoticeDays: number;
    needsRenewal: boolean;
  } | null;
  recentActivity?: Array<{
    type: string;
    title: string;
    description: string;
    timestamp: string;
    link?: string;
  }>;
  paymentTrend?: {
    totalPayments: number;
    onTimePayments: number;
    onTimeRate: number;
  };
}

// Loading skeleton component
function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      {/* Balance Card Skeleton */}
      <div className="rounded-lg border bg-card p-6 space-y-3">
        <div className="h-6 w-32 bg-muted rounded animate-pulse"></div>
        <div className="h-12 w-48 bg-muted rounded animate-pulse mb-4"></div>
        <div className="h-12 w-full bg-muted rounded animate-pulse"></div>
      </div>

      {/* Next Invoice Skeleton */}
      <div className="rounded-lg border bg-card p-6 space-y-3">
        <div className="h-6 w-40 bg-muted rounded animate-pulse"></div>
        <div className="h-8 w-32 bg-muted rounded animate-pulse"></div>
        <div className="h-4 w-24 bg-muted rounded animate-pulse"></div>
      </div>

      {/* Quick Actions Skeleton */}
      <div className="grid grid-cols-2 gap-4">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-lg border bg-card p-6 space-y-2">
            <div className="h-8 w-8 bg-muted rounded mx-auto animate-pulse"></div>
            <div className="h-4 w-24 bg-muted rounded mx-auto animate-pulse"></div>
          </div>
        ))}
      </div>

      {/* Stats Skeleton */}
      <DashboardCardsSkeleton />

      {/* Recent Invoices Skeleton */}
      <div className="space-y-0">
        {[1, 2, 3].map((i) => (
          <ListItemSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export default function TenantDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);

  const fetchDashboardData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      // Fetch tenant dashboard data
      const response = await fetch('/api/tenant/dashboard', {
        cache: 'no-store',
      });

      if (response.ok) {
        const result = await response.json();
        setData(result);
      } else {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || 'Failed to load dashboard data';
        setError(errorMessage);

        // Set empty data on error
        setData({
          balance: 0,
          totalPaidThisMonth: 0,
          invoicesCount: 0,
          complaintsCount: 0,
          recentInvoices: [],
        });
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      setError('Network error. Please check your connection and try again.');
      setData({
        balance: 0,
        totalPaidThisMonth: 0,
        invoicesCount: 0,
        complaintsCount: 0,
        recentInvoices: [],
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Pull-to-refresh handler
  const handleRefresh = useCallback(() => {
    fetchDashboardData(true);
  }, [fetchDashboardData]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ET', {
      style: 'currency',
      currency: 'ETB',
    }).format(amount);
  };

  // Show loading skeleton on initial load
  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-4">
      {/* Error Banner */}
      {error && (
        <MobileCard className="border-destructive bg-destructive/10">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-medium text-destructive mb-1">Error</div>
              <div className="text-sm text-muted-foreground">{error}</div>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Refreshing...' : 'Try Again'}
              </Button>
            </div>
          </div>
        </MobileCard>
      )}

      {/* Refresh Button (for manual refresh) */}
      {!loading && (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-muted-foreground"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      )}
      {/* Balance Card - Prominent */}
      <MobileCard title="Current Balance" onClick={() => router.push('/tenant/payments')}>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="text-4xl font-bold text-primary">
              {formatCurrency(data?.balance || 0)}
            </div>
            {data?.overdueAmount && data.overdueAmount > 0 && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4" />
                <span>Overdue: {formatCurrency(data.overdueAmount)}</span>
              </div>
            )}
          </div>
          <Button
            className="w-full h-12 text-base font-medium"
            onClick={(e) => {
              e.stopPropagation();
              router.push('/tenant/payments?action=pay');
            }}
          >
            Pay Now
          </Button>
        </div>
      </MobileCard>

      {/* Lease Expiration Warning */}
      {data?.leaseExpirationInfo && data.leaseExpirationInfo.needsRenewal && (
        <MobileCard className="border-orange-500 bg-orange-50 dark:bg-orange-950/20">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              <h3 className="font-semibold text-orange-900 dark:text-orange-100">
                Lease Expiring Soon
              </h3>
            </div>
            <p className="text-sm text-orange-800 dark:text-orange-200">
              Your lease expires in {data.leaseExpirationInfo.daysUntilExpiry} days on{' '}
              {new Date(data.leaseExpirationInfo.endDate).toLocaleDateString()}
            </p>
            <Button
              variant="outline"
              className="w-full border-orange-500 text-orange-700 dark:text-orange-300"
              onClick={() => router.push('/tenant/lease')}
            >
              View Lease Details
            </Button>
          </div>
        </MobileCard>
      )}

      {/* Maintenance Requests Summary */}
      {data?.maintenanceRequestsSummary && data.maintenanceRequestsSummary.open > 0 && (
        <MobileCard onClick={() => router.push('/tenant/complaints?type=maintenance_request')}>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wrench className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Maintenance Requests</h3>
              </div>
              <Badge variant="outline">{data.maintenanceRequestsSummary.open} Open</Badge>
            </div>
            {data.maintenanceRequestsSummary.urgent > 0 && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4" />
                <span>{data.maintenanceRequestsSummary.urgent} urgent request(s)</span>
              </div>
            )}
            {data.maintenanceRequestsSummary.recentUpdates.length > 0 && (
              <div className="space-y-2 pt-2 border-t">
                {data.maintenanceRequestsSummary.recentUpdates.map((update) => (
                  <div key={update.id} className="text-sm">
                    <div className="font-medium">{update.title}</div>
                    <div className="text-muted-foreground text-xs">
                      {update.status.replace('_', ' ')} •{' '}
                      {new Date(update.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Button
              variant="outline"
              className="w-full"
              onClick={(e) => {
                e.stopPropagation();
                router.push('/tenant/complaints/new?type=maintenance_request');
              }}
            >
              Submit New Request
            </Button>
          </div>
        </MobileCard>
      )}

      {/* Next Invoice Card */}
      {data?.nextInvoice && (
        <MobileCard
          title="Next Payment Due"
          onClick={() => router.push(`/tenant/invoices/${data.nextInvoice!.id}`)}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{formatCurrency(data.nextInvoice.amount)}</div>
                <div className="text-sm text-muted-foreground">
                  Invoice {data.nextInvoice.number}
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-semibold">{data.nextInvoice.daysUntilDue} days</div>
                <div className="text-xs text-muted-foreground">until due</div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Due: {new Date(data.nextInvoice.dueDate).toLocaleDateString()}</span>
            </div>
            <Button
              variant="outline"
              className="w-full h-11"
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/tenant/invoices/${data.nextInvoice!.id}`);
              }}
            >
              View Invoice
            </Button>
          </div>
        </MobileCard>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-4">
        <MobileCard className="text-center" onClick={() => router.push('/tenant/complaints/new')}>
          <div className="space-y-2">
            <MessageSquare className="h-8 w-8 mx-auto text-primary" />
            <div className="text-sm font-medium">Submit Complaint</div>
          </div>
        </MobileCard>
        <MobileCard
          className="text-center"
          onClick={() => router.push('/tenant/complaints/new?type=maintenance_request')}
        >
          <div className="space-y-2">
            <Wrench className="h-8 w-8 mx-auto text-primary" />
            <div className="text-sm font-medium">Maintenance Request</div>
          </div>
        </MobileCard>
        <MobileCard className="text-center" onClick={() => router.push('/tenant/lease')}>
          <div className="space-y-2">
            <FileText className="h-8 w-8 mx-auto text-primary" />
            <div className="text-sm font-medium">View Lease</div>
          </div>
        </MobileCard>
        <MobileCard className="text-center" onClick={() => router.push('/tenant/visitor-qr-codes')}>
          <div className="space-y-2">
            <FileText className="h-8 w-8 mx-auto text-primary" />
            <div className="text-sm font-medium">Visitor QR Codes</div>
          </div>
        </MobileCard>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <MobileCard className="text-center py-4">
          <TrendingUp className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
          <div className="text-xl font-bold">{formatCurrency(data?.totalPaidThisMonth || 0)}</div>
          <div className="text-xs text-muted-foreground">Paid This Month</div>
          {data?.paymentTrend && data.paymentTrend.totalPayments > 0 && (
            <div className="text-xs text-muted-foreground mt-1">
              {Math.round(data.paymentTrend.onTimeRate * 100)}% on time
            </div>
          )}
        </MobileCard>
        <MobileCard className="text-center py-4">
          <Receipt className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
          <div className="text-xl font-bold">{data?.invoicesCount || 0}</div>
          <div className="text-xs text-muted-foreground">Invoices</div>
        </MobileCard>
        <MobileCard className="text-center py-4">
          <MessageSquare className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
          <div className="text-xl font-bold">{data?.complaintsCount || 0}</div>
          <div className="text-xs text-muted-foreground">Complaints</div>
          {data?.maintenanceRequestsSummary && data.maintenanceRequestsSummary.open > 0 && (
            <div className="text-xs text-primary mt-1">
              {data.maintenanceRequestsSummary.open} maintenance
            </div>
          )}
        </MobileCard>
      </div>

      {/* Recent Activity Feed */}
      {data?.recentActivity && data.recentActivity.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Recent Activity
            </h2>
          </div>
          <div className="space-y-2">
            {data.recentActivity.map((activity, index) => (
              <MobileCard
                key={index}
                onClick={() => activity.link && router.push(activity.link)}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-sm">{activity.title}</div>
                    <Clock className="h-3 w-3 text-muted-foreground" />
                  </div>
                  <div className="text-sm text-muted-foreground">{activity.description}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(activity.timestamp).toLocaleString()}
                  </div>
                </div>
              </MobileCard>
            ))}
          </div>
        </div>
      )}

      {/* Recent Invoices */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent Invoices</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/tenant/invoices')}
            className="text-sm"
          >
            View All
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
        <MobileList
          items={data?.recentInvoices || []}
          loading={loading}
          emptyMessage="No invoices yet"
          renderItem={(invoice) => (
            <SwipeableCard
              onSwipeLeft={() => router.push(`/tenant/invoices/${invoice.id}`)}
              onSwipeRight={() => {
                if (invoice.status !== 'paid') {
                  router.push(`/tenant/payments?invoice=${invoice.id}&action=pay`);
                }
              }}
              {...(invoice.status !== 'paid'
                ? {
                    swipeRightAction: {
                      label: 'Pay Now',
                      icon: <CreditCard className="h-4 w-4 mr-2" />,
                      onClick: () => {
                        router.push(`/tenant/payments?invoice=${invoice.id}&action=pay`);
                      },
                    },
                  }
                : {})}
              className="border-0 border-b rounded-none"
            >
              <div
                className="flex items-center justify-between p-4 active:bg-accent transition-colors"
                onClick={() => router.push(`/tenant/invoices/${invoice.id}`)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="font-medium">Invoice {invoice.number}</div>
                    <Badge
                      variant={
                        invoice.status === 'paid'
                          ? 'default'
                          : invoice.status === 'overdue'
                            ? 'destructive'
                            : 'secondary'
                      }
                    >
                      {invoice.status}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {formatCurrency(invoice.amount)} • Due{' '}
                    {new Date(invoice.dueDate).toLocaleDateString()}
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground flex-shrink-0 ml-2" />
              </div>
            </SwipeableCard>
          )}
        />
      </div>
    </div>
  );
}
