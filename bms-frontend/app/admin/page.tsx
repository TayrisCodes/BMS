'use client';

import { useEffect, useState } from 'react';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import { StatCard } from '@/lib/components/dashboard/cards/StatCard';
import { ChartCard } from '@/lib/components/dashboard/cards/ChartCard';
import { TableCard } from '@/lib/components/dashboard/cards/TableCard';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { Building2, Users, FileCheck, Activity, TrendingUp } from 'lucide-react';
import { useRouter } from 'next/navigation';

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
          setOrganizations((orgsData.organizations || orgsData || []).slice(0, 10));
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

  return (
    <DashboardPage title="Admin Dashboard" breadcrumbs={[{ label: 'Admin', href: '/admin' }]}>
      {/* Stats Cards */}
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
      <StatCard
        label="Total Tenants"
        value={stats?.totalTenants || 0}
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

      {/* Recent Organizations Table */}
      <TableCard
        title="Recent Organizations"
        columns={orgColumns}
        data={organizations}
        onRowClick={(item: { _id?: string; createdAt?: string }) =>
          router.push(`/admin/organizations/${item._id}`)
        }
        colSpan={2}
      />

      {/* Recent Users Table */}
      <TableCard title="Recent Users" columns={userColumns} data={recentUsers} colSpan={2} />
    </DashboardPage>
  );
}
