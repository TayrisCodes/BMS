'use client';

import { useEffect, useState } from 'react';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import { StatCard } from '@/lib/components/dashboard/cards/StatCard';
import { ChartCard } from '@/lib/components/dashboard/cards/ChartCard';
import { TableCard } from '@/lib/components/dashboard/cards/TableCard';
import type { Column } from '@/lib/components/dashboard/cards/TableCard';
import { ListCard } from '@/lib/components/dashboard/cards/ListCard';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { useRecentActivity } from '@/hooks/useRecentActivity';
import { useOverdueInvoices } from '@/hooks/useOverdueInvoices';
import {
  Building2,
  DoorOpen,
  TrendingUp,
  Receipt,
  AlertCircle,
  MessageSquare,
  Calendar,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/lib/components/ui/badge';

export default function OrgHomePage() {
  const router = useRouter();
  const { data: stats, loading, error, refetch } = useDashboardStats();
  const { activities, loading: activitiesLoading } = useRecentActivity();
  const { invoices, loading: invoicesLoading } = useOverdueInvoices();
  const [recentLeases, setRecentLeases] = useState([]);
  const [recentTenants, setRecentTenants] = useState([]);
  const [recentComplaints, setRecentComplaints] = useState([]);
  const [recentPayments, setRecentPayments] = useState([]);
  const [occupancyData, setOccupancyData] = useState([]);
  const [revenueData, setRevenueData] = useState([]);
  const [loadingCharts, setLoadingCharts] = useState(true);

  // Fetch additional data
  useEffect(() => {
    async function fetchData() {
      try {
        const [leasesRes, tenantsRes, complaintsRes, paymentsRes, occupancyRes, revenueRes] =
          await Promise.all([
            fetch('/api/leases?limit=10'),
            fetch('/api/tenants?limit=10'),
            fetch('/api/complaints?limit=10'),
            fetch('/api/payments?limit=10'),
            fetch('/api/dashboard/charts/occupancy?months=6'),
            fetch('/api/dashboard/charts/revenue?months=6'),
          ]);

        if (leasesRes.ok) {
          const data = await leasesRes.json();
          setRecentLeases(data.leases || data || []);
        } else {
          console.error('Failed to fetch leases:', leasesRes.status, leasesRes.statusText);
        }

        if (tenantsRes.ok) {
          const data = await tenantsRes.json();
          setRecentTenants(data.tenants || data || []);
        } else {
          console.error('Failed to fetch tenants:', tenantsRes.status, tenantsRes.statusText);
        }

        if (complaintsRes.ok) {
          const data = await complaintsRes.json();
          setRecentComplaints(data.complaints || data || []);
        } else {
          console.error(
            'Failed to fetch complaints:',
            complaintsRes.status,
            complaintsRes.statusText,
          );
        }

        if (paymentsRes.ok) {
          const data = await paymentsRes.json();
          setRecentPayments(data.payments || data || []);
        } else {
          console.error('Failed to fetch payments:', paymentsRes.status, paymentsRes.statusText);
        }

        if (occupancyRes.ok) {
          const data = await occupancyRes.json();
          setOccupancyData(data.data || []);
        } else {
          console.error(
            'Failed to fetch occupancy chart:',
            occupancyRes.status,
            occupancyRes.statusText,
          );
        }

        if (revenueRes.ok) {
          const data = await revenueRes.json();
          setRevenueData(data.data || []);
        } else {
          console.error('Failed to fetch revenue chart:', revenueRes.status, revenueRes.statusText);
        }
      } catch (err) {
        console.error('Failed to fetch data:', err);
      } finally {
        setLoadingCharts(false);
      }
    }

    fetchData();
  }, []);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ET', {
      style: 'currency',
      currency: 'ETB',
    }).format(amount);
  };

  // Table columns
  type LeaseItem = {
    _id?: string;
    tenantId?: string;
    unitId?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
  };

  type TenantItem = {
    _id?: string;
    name?: string;
    phone?: string;
    email?: string;
    status?: string;
  };

  const leaseColumns: Column<LeaseItem>[] = [
    { key: 'tenantId', label: 'Tenant ID' },
    { key: 'unitId', label: 'Unit ID' },
    {
      key: 'startDate',
      label: 'Start Date',
      render: (item: LeaseItem) =>
        item.startDate ? new Date(item.startDate).toLocaleDateString() : 'N/A',
    },
    {
      key: 'endDate',
      label: 'End Date',
      render: (item: LeaseItem) =>
        item.endDate ? new Date(item.endDate).toLocaleDateString() : 'N/A',
    },
    {
      key: 'status',
      label: 'Status',
      render: (item: LeaseItem) => (
        <Badge variant={item.status === 'active' ? 'default' : 'secondary'}>
          {item.status || 'N/A'}
        </Badge>
      ),
    },
  ];

  const tenantColumns: Column<TenantItem>[] = [
    { key: 'name', label: 'Name' },
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email' },
    {
      key: 'status',
      label: 'Status',
      render: (item: TenantItem) => (
        <Badge variant={item.status === 'active' ? 'default' : 'secondary'}>
          {item.status || 'N/A'}
        </Badge>
      ),
    },
  ];

  return (
    <DashboardPage
      title="Organization Dashboard"
      breadcrumbs={[{ label: 'Organization', href: '/org' }]}
    >
      {/* Stats Cards */}
      <StatCard
        label="Total Buildings"
        value={stats?.totalBuildings || 0}
        icon={Building2}
        loading={loading}
        error={error}
        onRetry={refetch}
      />
      <StatCard
        label="Occupied Units"
        value={`${stats?.occupiedUnits || 0} / ${stats?.totalUnits || 0}`}
        icon={DoorOpen}
        loading={loading}
        error={error}
        onRetry={refetch}
      />
      <StatCard
        label="Vacancy Rate"
        value={`${stats?.vacancyRate?.toFixed(1) || 0}%`}
        {...(stats?.vacancyRate
          ? {
              trend: {
                value: 5,
                direction: stats.vacancyRate < 10 ? 'down' : 'up',
              },
            }
          : {})}
        icon={TrendingUp}
        loading={loading}
        error={error}
        onRetry={refetch}
      />
      <StatCard
        label="Total Revenue"
        value={formatCurrency(stats?.totalRevenue || 0)}
        formatValue={(val) => formatCurrency(val)}
        icon={TrendingUp}
        loading={loading}
        error={error}
        onRetry={refetch}
      />
      <StatCard
        label="Outstanding Receivables"
        value={formatCurrency(stats?.outstandingReceivables || 0)}
        formatValue={(val) => formatCurrency(val)}
        icon={Receipt}
        loading={loading}
        error={error}
        onRetry={refetch}
      />
      <StatCard
        label="Pending Complaints"
        value={stats?.pendingComplaints || 0}
        icon={AlertCircle}
        loading={loading}
        error={error}
        onRetry={refetch}
      />

      {/* Charts */}
      <ChartCard
        title="Occupancy Trends"
        data={occupancyData}
        type="area"
        xAxis="name"
        colSpan={2}
        loading={loadingCharts}
      />
      <ChartCard
        title="Monthly Revenue"
        data={revenueData}
        type="bar"
        xAxis="name"
        colSpan={2}
        loading={loadingCharts}
      />

      {/* Lists */}
      <ListCard
        title="Recent Complaints"
        items={recentComplaints}
        renderItem={(item: {
          _id?: string;
          title?: string;
          status?: string;
          createdAt?: string;
        }) => (
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">{item.title || 'Untitled'}</div>
              <div className="text-xs text-muted-foreground">
                {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'N/A'}
              </div>
            </div>
            <Badge variant={item.status === 'resolved' ? 'default' : 'secondary'}>
              {item.status || 'pending'}
            </Badge>
          </div>
        )}
        emptyMessage="No complaints"
        maxItems={5}
        loading={false}
      />

      <ListCard
        title="Overdue Invoices"
        items={invoices}
        renderItem={(item: {
          _id?: string;
          number?: string;
          amount?: number;
          dueDate?: string;
          tenantName?: string;
        }) => (
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Invoice {item.number || item._id}</div>
              <div className="text-xs text-muted-foreground">
                {item.tenantName || 'Unknown'} • {formatCurrency(item.amount || 0)}
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              {item.dueDate ? new Date(item.dueDate).toLocaleDateString() : 'N/A'}
            </div>
          </div>
        )}
        emptyMessage="No overdue invoices"
        maxItems={5}
        loading={invoicesLoading}
      />

      <ListCard
        title="Recent Payments"
        items={recentPayments}
        renderItem={(item: {
          _id?: string;
          amount?: number;
          invoiceNumber?: string;
          createdAt?: string;
        }) => (
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">{formatCurrency(item.amount || 0)}</div>
              <div className="text-xs text-muted-foreground">
                Invoice {item.invoiceNumber || 'N/A'}
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'N/A'}
            </div>
          </div>
        )}
        emptyMessage="No recent payments"
        maxItems={5}
        loading={false}
      />

      {/* Tables */}
      <TableCard
        title="Recent Leases"
        columns={leaseColumns}
        data={recentLeases}
        onRowClick={(item: { _id?: string }) => router.push(`/org/leases/${item._id}`)}
        colSpan={2}
      />

      <TableCard
        title="Recent Tenants"
        columns={tenantColumns}
        data={recentTenants}
        onRowClick={(item: { _id?: string }) => router.push(`/org/tenants/${item._id}`)}
        colSpan={2}
      />
    </DashboardPage>
  );
}
