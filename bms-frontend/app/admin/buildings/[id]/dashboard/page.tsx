'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import { StatCard } from '@/lib/components/dashboard/cards/StatCard';
import { ChartCard } from '@/lib/components/dashboard/cards/ChartCard';
import { ListCard } from '@/lib/components/dashboard/cards/ListCard';
import { DoorOpen, TrendingUp, Receipt, AlertCircle, Wrench } from 'lucide-react';
import { Badge } from '@/lib/components/ui/badge';

export default function BuildingDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const buildingId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState<{
    name?: string;
    address?: string;
  } | null>(null);
  const [stats, setStats] = useState<{
    occupancy?: number;
    revenue?: number;
    outstanding?: number;
    complaints?: number;
    totalUnits?: number;
    occupiedUnits?: number;
  } | null>(null);
  const [recentComplaints, setRecentComplaints] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [revenueData, setRevenueData] = useState([]);
  const [loadingChart, setLoadingChart] = useState(true);

  useEffect(() => {
    async function fetchBuildingData() {
      try {
        setLoading(true);

        // Fetch building details
        const buildingRes = await fetch(`/api/buildings/${buildingId}`);
        if (buildingRes.ok) {
          const buildingData = await buildingRes.json();
          setBuilding(buildingData.building || buildingData);
        } else {
          console.error('Failed to fetch building:', buildingRes.status, buildingRes.statusText);
        }

        // Fetch building stats
        const statsRes = await fetch(`/api/buildings/${buildingId}/stats`);
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData.stats || statsData);
        } else {
          console.error('Failed to fetch building stats:', statsRes.status, statsRes.statusText);
        }

        // Fetch recent complaints
        const complaintsRes = await fetch(`/api/complaints?buildingId=${buildingId}&limit=10`);
        if (complaintsRes.ok) {
          const complaintsData = await complaintsRes.json();
          setRecentComplaints(complaintsData.complaints || complaintsData || []);
        } else {
          console.error(
            'Failed to fetch complaints:',
            complaintsRes.status,
            complaintsRes.statusText,
          );
        }

        // Fetch work orders
        const workOrdersRes = await fetch(`/api/work-orders?buildingId=${buildingId}&limit=10`);
        if (workOrdersRes.ok) {
          const workOrdersData = await workOrdersRes.json();
          setWorkOrders(workOrdersData.workOrders || workOrdersData || []);
        } else {
          console.error(
            'Failed to fetch work orders:',
            workOrdersRes.status,
            workOrdersRes.statusText,
          );
        }

        // Fetch revenue chart data
        const revenueRes = await fetch(
          `/api/dashboard/charts/revenue?buildingId=${buildingId}&months=6`,
        );
        if (revenueRes.ok) {
          const revenueDataResponse = await revenueRes.json();
          setRevenueData(revenueDataResponse.data || []);
        }
      } catch (err) {
        console.error('Failed to fetch building data:', err);
      } finally {
        setLoading(false);
        setLoadingChart(false);
      }
    }

    if (buildingId) {
      fetchBuildingData();
    }
  }, [buildingId]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ET', {
      style: 'currency',
      currency: 'ETB',
    }).format(amount);
  };

  // Prepare chart data
  const unitStatusData = [
    { name: 'Occupied', value: stats?.occupiedUnits || 0 },
    { name: 'Vacant', value: (stats?.totalUnits || 0) - (stats?.occupiedUnits || 0) },
  ];

  // revenueData is already defined as state above, using that instead

  return (
    <DashboardPage
      title={building?.name || 'Building Dashboard'}
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'Buildings', href: '/admin/buildings' },
        { label: building?.name || buildingId, href: `/admin/buildings/${buildingId}` },
        { label: 'Dashboard' },
      ]}
    >
      {/* Stats Cards */}
      <StatCard
        label="Occupancy Rate"
        value={`${stats?.occupancy?.toFixed(1) || 0}%`}
        icon={DoorOpen}
        loading={loading}
        colSpan={1}
      />
      <StatCard
        label="Monthly Revenue"
        value={formatCurrency(stats?.revenue || 0)}
        formatValue={(val) => formatCurrency(val)}
        icon={TrendingUp}
        loading={loading}
        colSpan={1}
      />
      <StatCard
        label="Outstanding"
        value={formatCurrency(stats?.outstanding || 0)}
        formatValue={(val) => formatCurrency(val)}
        icon={Receipt}
        loading={loading}
        colSpan={1}
      />
      <StatCard
        label="Active Complaints"
        value={stats?.complaints || 0}
        icon={AlertCircle}
        loading={loading}
        colSpan={1}
      />

      {/* Charts */}
      <ChartCard
        title="Unit Status Breakdown"
        data={unitStatusData}
        type="pie"
        xAxis="name"
        colSpan={2}
      />
      <ChartCard
        title="Revenue Trends"
        data={revenueData}
        type="line"
        xAxis="name"
        colSpan={2}
        loading={loadingChart}
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
        emptyMessage="No complaints for this building"
        maxItems={5}
        loading={loading}
      />

      <ListCard
        title="Work Orders"
        items={workOrders}
        renderItem={(item: {
          _id?: string;
          title?: string;
          status?: string;
          priority?: string;
          createdAt?: string;
        }) => (
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">{item.title || 'Untitled'}</div>
              <div className="text-xs text-muted-foreground">
                {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'N/A'}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {item.priority && <Badge variant="outline">{item.priority}</Badge>}
              <Badge variant={item.status === 'resolved' ? 'default' : 'secondary'}>
                {item.status || 'open'}
              </Badge>
            </div>
          </div>
        )}
        emptyMessage="No work orders for this building"
        maxItems={5}
        loading={loading}
      />
    </DashboardPage>
  );
}
