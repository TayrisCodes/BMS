'use client';

import { useEffect, useState } from 'react';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import { StatCard } from '@/lib/components/dashboard/cards/StatCard';
import { ChartCard } from '@/lib/components/dashboard/cards/ChartCard';
import { TableCard } from '@/lib/components/dashboard/cards/TableCard';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import {
  Building2,
  Users,
  FileCheck,
  Activity,
  TrendingUp,
  CreditCard,
  DollarSign,
  ArrowUpRight,
  Plus,
  Zap,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/lib/components/ui/button';

export default function AdminHomePage() {
  const router = useRouter();
  const { data: stats, loading, error, refetch } = useDashboardStats();
  const [organizations, setOrganizations] = useState([]);
  const [recentUsers, setRecentUsers] = useState([]);
  const [revenueData, setRevenueData] = useState([]);
  const [loadingChart, setLoadingChart] = useState(true);

  // Fetch recent organizations and users
  useEffect(() => {
    async function fetchData() {
      try {
        const [orgsRes, usersRes, revenueRes] = await Promise.all([
          fetch('/api/organizations'),
          fetch('/api/users'),
          fetch('/api/dashboard/charts/revenue?months=6'),
        ]);

        if (orgsRes.ok) {
          const orgsData = await orgsRes.json();
          const orgs = (orgsData.organizations || orgsData || []).slice(0, 10);
          // Normalize id/_id field for compatibility
          const normalized = orgs.map((org: { id?: string; _id?: string }) => ({
            ...org,
            _id: org._id || org.id,
            id: org.id || org._id,
          }));
          setOrganizations(normalized);
        } else {
          console.error('Failed to fetch organizations:', orgsRes.status, orgsRes.statusText);
        }

        if (usersRes.ok) {
          const usersData = await usersRes.json();
          setRecentUsers((usersData.users || usersData || []).slice(0, 10));
        } else {
          console.error('Failed to fetch users:', usersRes.status, usersRes.statusText);
        }

        if (revenueRes.ok) {
          const revenueDataResponse = await revenueRes.json();
          setRevenueData(revenueDataResponse.data || []);
        } else {
          console.error('Failed to fetch revenue chart:', revenueRes.status, revenueRes.statusText);
        }
      } catch (err) {
        console.error('Failed to fetch data:', err);
      } finally {
        setLoadingChart(false);
      }
    }

    fetchData();
  }, []);

  const orgColumns = [
    { key: 'name', label: 'Name' },
    { key: 'code', label: 'Code' },
    {
      key: 'createdAt',
      label: 'Created',
      render: (item: { _id?: string; createdAt?: string }) =>
        item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'N/A',
    },
  ];

  const userColumns = [
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    {
      key: 'roles',
      label: 'Roles',
      render: (item: { email?: string; phone?: string; roles?: string[]; createdAt?: string }) =>
        item.roles ? item.roles.join(', ') : 'N/A',
    },
    {
      key: 'createdAt',
      label: 'Created',
      render: (item: { email?: string; phone?: string; roles?: string[]; createdAt?: string }) =>
        item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'N/A',
    },
  ];

  function formatCurrency(amount: number): string {
    return `${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`;
  }

  return (
    <DashboardPage title="Admin Dashboard" breadcrumbs={[{ label: 'Admin', href: '/admin' }]}>
      {/* Primary KPI Cards - Revenue & Subscriptions */}
      <StatCard
        label="Monthly Recurring Revenue (MRR)"
        value={stats?.mrr ? formatCurrency(stats.mrr) : '0.00 ETB'}
        icon={TrendingUp}
        loading={loading}
        error={error}
        onRetry={refetch}
      />
      <StatCard
        label="Annual Recurring Revenue (ARR)"
        value={stats?.arr ? formatCurrency(stats.arr) : '0.00 ETB'}
        icon={DollarSign}
        loading={loading}
        error={error}
        onRetry={refetch}
      />
      <StatCard
        label="Active Subscriptions"
        value={stats?.activeSubscriptions || 0}
        icon={CreditCard}
        loading={loading}
        error={error}
        onRetry={refetch}
      />
      <StatCard
        label="Total Revenue"
        value={stats?.totalRevenue ? formatCurrency(stats.totalRevenue) : '0.00 ETB'}
        icon={DollarSign}
        loading={loading}
        error={error}
        onRetry={refetch}
      />

      {/* Growth Metrics */}
      <StatCard
        label="New Organizations (This Month)"
        value={stats?.newOrganizationsThisMonth || 0}
        icon={ArrowUpRight}
        loading={loading}
        error={error}
        onRetry={refetch}
      />
      <StatCard
        label="New Users (This Month)"
        value={stats?.newUsersThisMonth || 0}
        icon={Users}
        loading={loading}
        error={error}
        onRetry={refetch}
      />
      <StatCard
        label="Total Organizations"
        value={stats?.totalOrganizations || 0}
        icon={Building2}
        loading={loading}
        error={error}
        onRetry={refetch}
      />
      <StatCard
        label="Total Buildings"
        value={stats?.totalBuildings || 0}
        icon={Building2}
        loading={loading}
        error={error}
        onRetry={refetch}
      />

      {/* Additional Stats */}
      <StatCard
        label="Total Tenants"
        value={stats?.totalTenants || 0}
        icon={Users}
        loading={loading}
        error={error}
        onRetry={refetch}
      />
      <StatCard
        label="Total Users"
        value={stats?.totalUsers || 0}
        icon={Users}
        loading={loading}
        error={error}
        onRetry={refetch}
      />
      <StatCard
        label="System Health"
        value={stats?.systemHealth === 'healthy' ? 'Healthy' : 'Unknown'}
        icon={Activity}
        loading={loading}
        error={error}
        onRetry={refetch}
      />

      {/* Quick Actions */}
      <div className="col-span-full">
        <div className="grid gap-4 md:grid-cols-3">
          <Link href="/admin/organizations/new">
            <Button className="w-full h-20 flex-col gap-2" variant="outline">
              <Plus className="h-6 w-6" />
              <span>Create Organization</span>
            </Button>
          </Link>
          <Link href="/admin/users/invite">
            <Button className="w-full h-20 flex-col gap-2" variant="outline">
              <Users className="h-6 w-6" />
              <span>Invite User</span>
            </Button>
          </Link>
          <Link href="/admin/organizations">
            <Button className="w-full h-20 flex-col gap-2" variant="outline">
              <Zap className="h-6 w-6" />
              <span>Manage Organizations</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Revenue Trends Chart */}
      <ChartCard
        title="Revenue Trends"
        subtitle="Cross-organization revenue over time"
        data={revenueData}
        type="line"
        xAxis="name"
        colSpan={2}
        loading={loadingChart}
      />

      {/* Subscription Tier Distribution Chart */}
      {stats?.subscriptionTierDistribution && (
        <ChartCard
          title="Subscription Tier Distribution"
          subtitle="Active subscriptions by tier"
          data={[
            { name: 'Starter', value: stats.subscriptionTierDistribution.starter },
            { name: 'Growth', value: stats.subscriptionTierDistribution.growth },
            { name: 'Enterprise', value: stats.subscriptionTierDistribution.enterprise },
          ]}
          type="pie"
          xAxis="name"
          colSpan={1}
          loading={loading}
        />
      )}

      {/* Recent Organizations Table */}
      <TableCard
        title="Recent Organizations"
        columns={orgColumns}
        data={organizations}
        onRowClick={(item: { _id?: string; id?: string; createdAt?: string }) =>
          router.push(`/admin/organizations/${item._id || item.id}`)
        }
        colSpan={2}
      />

      {/* Recent Users Table */}
      <TableCard title="Recent Users" columns={userColumns} data={recentUsers} colSpan={2} />
    </DashboardPage>
  );
}
