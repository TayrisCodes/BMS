'use client';

import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/lib/components/ui/tabs';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/lib/components/ui/card';
import { StatCard } from '@/lib/components/dashboard/cards/StatCard';
import { ChartCard } from '@/lib/components/dashboard/cards/ChartCard';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { apiGet } from '@/lib/utils/api-client';
import {
  BarChart3,
  TrendingUp,
  Users,
  Building2,
  DollarSign,
  CreditCard,
  FileText,
  Package,
  Activity,
  Download,
} from 'lucide-react';
import { Button } from '@/lib/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/lib/components/ui/select';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function AnalyticsPage() {
  const [platformData, setPlatformData] = useState<any>(null);
  const [revenueData, setRevenueData] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [buildingData, setBuildingData] = useState<any>(null);
  const [financialData, setFinancialData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revenuePeriod, setRevenuePeriod] = useState('30d');
  const [revenueGroupBy, setRevenueGroupBy] = useState('day');

  useEffect(() => {
    async function fetchAllData() {
      try {
        setIsLoading(true);
        setError(null);

        const [platform, revenue, users, buildings, financial] = await Promise.all([
          apiGet('/api/analytics/platform'),
          apiGet(`/api/analytics/revenue?period=${revenuePeriod}&groupBy=${revenueGroupBy}`),
          apiGet('/api/analytics/users'),
          apiGet('/api/analytics/buildings'),
          apiGet(`/api/analytics/financial?period=${revenuePeriod}`),
        ]);

        setPlatformData(platform);
        setRevenueData(revenue);
        setUserData(users);
        setBuildingData(buildings);
        setFinancialData(financial);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load analytics');
      } finally {
        setIsLoading(false);
      }
    }

    fetchAllData();
  }, [revenuePeriod, revenueGroupBy]);

  function formatCurrency(amount: number): string {
    return `${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`;
  }

  function handleExport() {
    // TODO: Implement export functionality
    alert('Export functionality coming soon!');
  }

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <nav
          className="flex items-center gap-1.5 text-sm text-muted-foreground"
          aria-label="Breadcrumb"
        >
          <Link href="/admin" className="hover:text-foreground transition-colors font-medium">
            Admin
          </Link>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <span className="text-foreground font-medium">Analytics</span>
        </nav>
        <h1 className="text-3xl font-bold tracking-tight">Platform Analytics</h1>
        <p className="text-muted-foreground">Comprehensive insights across all organizations</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4">
        {/* Header with Export */}
        <div className="col-span-full flex items-center justify-between mb-4">
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>

        {error && (
          <div className="col-span-full bg-destructive/10 text-destructive p-4 rounded-lg">
            {error}
          </div>
        )}

        <Tabs defaultValue="overview" className="col-span-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="buildings">Buildings</TabsTrigger>
            <TabsTrigger value="financial">Financial</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6 mt-6">
            {/* Key Metrics */}
            {platformData && (
              <>
                <StatCard
                  label="Total Organizations"
                  value={platformData.overview?.totalOrganizations || 0}
                  icon={Building2}
                  loading={isLoading}
                  error={error}
                />
                <StatCard
                  label="Total Users"
                  value={platformData.overview?.totalUsers || 0}
                  icon={Users}
                  loading={isLoading}
                  error={error}
                />
                <StatCard
                  label="Monthly Recurring Revenue"
                  value={formatCurrency(platformData.overview?.mrr || 0)}
                  icon={DollarSign}
                  loading={isLoading}
                  error={error}
                />
                <StatCard
                  label="Annual Recurring Revenue"
                  value={formatCurrency(platformData.overview?.arr || 0)}
                  icon={TrendingUp}
                  loading={isLoading}
                  error={error}
                />
                <StatCard
                  label="Active Subscriptions"
                  value={platformData.overview?.activeSubscriptions || 0}
                  icon={CreditCard}
                  loading={isLoading}
                  error={error}
                />
                <StatCard
                  label="Total Buildings"
                  value={platformData.overview?.totalBuildings || 0}
                  icon={Building2}
                  loading={isLoading}
                  error={error}
                />

                {/* Growth Metrics */}
                <Card className="col-span-full">
                  <CardHeader>
                    <CardTitle>Growth (Last 30 Days)</CardTitle>
                    <CardDescription>New additions to the platform</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-2xl font-bold">
                          {platformData.growth?.last30Days?.newOrganizations || 0}
                        </p>
                        <p className="text-sm text-muted-foreground">New Organizations</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold">
                          {platformData.growth?.last30Days?.newUsers || 0}
                        </p>
                        <p className="text-sm text-muted-foreground">New Users</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold">
                          {platformData.growth?.last30Days?.newBuildings || 0}
                        </p>
                        <p className="text-sm text-muted-foreground">New Buildings</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold">
                          {platformData.growth?.last30Days?.newSubscriptions || 0}
                        </p>
                        <p className="text-sm text-muted-foreground">New Subscriptions</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Distribution Charts */}
                <ChartCard
                  title="Subscription Tier Distribution"
                  subtitle="Revenue by subscription tier"
                  data={
                    platformData.distributions?.subscriptionTiers?.map((item: any) => ({
                      name: item.tier?.charAt(0).toUpperCase() + item.tier?.slice(1) || 'Unknown',
                      value: item.totalRevenue || 0,
                      count: item.count || 0,
                    })) || []
                  }
                  type="pie"
                  yAxis="value"
                  colSpan={6}
                  loading={isLoading}
                  error={error}
                />

                <ChartCard
                  title="Organization Status Distribution"
                  subtitle="Organizations by status"
                  data={
                    platformData.distributions?.organizationStatus?.map((item: any) => ({
                      name:
                        item.status?.charAt(0).toUpperCase() + item.status?.slice(1) || 'Unknown',
                      value: item.count || 0,
                    })) || []
                  }
                  type="pie"
                  yAxis="value"
                  colSpan={6}
                  loading={isLoading}
                  error={error}
                />
              </>
            )}
          </TabsContent>

          {/* Revenue Tab */}
          <TabsContent value="revenue" className="space-y-6 mt-6">
            {/* Filters */}
            <div className="col-span-full flex gap-4">
              <Select value={revenuePeriod} onValueChange={setRevenuePeriod}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                  <SelectItem value="1y">Last year</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>
              <Select value={revenueGroupBy} onValueChange={setRevenueGroupBy}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Group by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">By Day</SelectItem>
                  <SelectItem value="week">By Week</SelectItem>
                  <SelectItem value="month">By Month</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {revenueData && (
              <>
                <ChartCard
                  title="Revenue Trends"
                  subtitle={`Revenue over time (${revenuePeriod})`}
                  data={revenueData.trends || []}
                  type="line"
                  xAxis="date"
                  yAxis="revenue"
                  colSpan={12}
                  loading={isLoading}
                  error={error}
                />

                <ChartCard
                  title="Revenue by Organization"
                  subtitle="Top 10 organizations by revenue"
                  data={
                    revenueData.byOrganization?.map((item: any) => ({
                      name: item.organizationName || 'Unknown',
                      value: item.totalRevenue || 0,
                      count: item.subscriptionCount || 0,
                    })) || []
                  }
                  type="bar"
                  xAxis="name"
                  yAxis="value"
                  colSpan={6}
                  loading={isLoading}
                  error={error}
                />

                <ChartCard
                  title="Revenue by Tier"
                  subtitle="Revenue breakdown by subscription tier"
                  data={
                    revenueData.byTier?.map((item: any) => ({
                      name: item._id?.charAt(0).toUpperCase() + item._id?.slice(1) || 'Unknown',
                      value: item.totalRevenue || 0,
                      count: item.subscriptionCount || 0,
                    })) || []
                  }
                  type="pie"
                  yAxis="value"
                  colSpan={6}
                  loading={isLoading}
                  error={error}
                />
              </>
            )}
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-6 mt-6">
            {userData && (
              <>
                <ChartCard
                  title="User Growth"
                  subtitle="New users over the last 12 months"
                  data={userData.growth || []}
                  type="line"
                  xAxis="date"
                  yAxis="count"
                  colSpan={12}
                  loading={isLoading}
                  error={error}
                />

                <ChartCard
                  title="Users by Organization"
                  subtitle="Top 10 organizations by user count"
                  data={
                    userData.byOrganization?.map((item: any) => ({
                      name: item.organizationName || 'Unknown',
                      value: item.count || 0,
                      active: item.active || 0,
                      invited: item.invited || 0,
                    })) || []
                  }
                  type="bar"
                  xAxis="name"
                  yAxis="value"
                  colSpan={6}
                  loading={isLoading}
                  error={error}
                />

                <ChartCard
                  title="Role Distribution"
                  subtitle="Users by role"
                  data={
                    userData.roleDistribution?.map((item: any) => ({
                      name: item.role || 'Unknown',
                      value: item.count || 0,
                    })) || []
                  }
                  type="pie"
                  yAxis="value"
                  colSpan={6}
                  loading={isLoading}
                  error={error}
                />

                <ChartCard
                  title="User Status Distribution"
                  subtitle="Users by status"
                  data={
                    userData.statusDistribution?.map((item: any) => ({
                      name:
                        item.status?.charAt(0).toUpperCase() + item.status?.slice(1) || 'Unknown',
                      value: item.count || 0,
                    })) || []
                  }
                  type="pie"
                  yAxis="value"
                  colSpan={6}
                  loading={isLoading}
                  error={error}
                />
              </>
            )}
          </TabsContent>

          {/* Buildings Tab */}
          <TabsContent value="buildings" className="space-y-6 mt-6">
            {buildingData && (
              <>
                <Card className="col-span-full">
                  <CardHeader>
                    <CardTitle>Occupancy Metrics</CardTitle>
                    <CardDescription>Unit occupancy across the platform</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-2xl font-bold">
                          {buildingData.occupancy?.totalUnits || 0}
                        </p>
                        <p className="text-sm text-muted-foreground">Total Units</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold">
                          {buildingData.occupancy?.occupiedUnits || 0}
                        </p>
                        <p className="text-sm text-muted-foreground">Occupied Units</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold">
                          {buildingData.occupancy?.occupancyRate || 0}%
                        </p>
                        <p className="text-sm text-muted-foreground">Occupancy Rate</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <ChartCard
                  title="Buildings by Organization"
                  subtitle="Top 10 organizations by building count"
                  data={
                    buildingData.buildingsByOrganization?.map((item: any) => ({
                      name: item.organizationName || 'Unknown',
                      value: item.count || 0,
                    })) || []
                  }
                  type="bar"
                  xAxis="name"
                  yAxis="value"
                  colSpan={6}
                  loading={isLoading}
                  error={error}
                />

                <ChartCard
                  title="Units by Organization"
                  subtitle="Top 10 organizations by unit count"
                  data={
                    buildingData.unitsByOrganization?.map((item: any) => ({
                      name: item.organizationName || 'Unknown',
                      value: item.count || 0,
                    })) || []
                  }
                  type="bar"
                  xAxis="name"
                  yAxis="value"
                  colSpan={6}
                  loading={isLoading}
                  error={error}
                />
              </>
            )}
          </TabsContent>

          {/* Financial Tab */}
          <TabsContent value="financial" className="space-y-6 mt-6">
            {financialData && (
              <>
                <StatCard
                  label="Total Revenue"
                  value={formatCurrency(financialData.totalRevenue || 0)}
                  icon={DollarSign}
                  loading={isLoading}
                  error={error}
                />
                <StatCard
                  label="Payment Success Rate"
                  value={`${financialData.paymentSuccess?.successRate || 0}%`}
                  icon={Activity}
                  loading={isLoading}
                  error={error}
                />
                <StatCard
                  label="Outstanding Invoices"
                  value={financialData.outstandingInvoices?.count || 0}
                  icon={FileText}
                  loading={isLoading}
                  error={error}
                />
                <StatCard
                  label="Outstanding Amount"
                  value={formatCurrency(financialData.outstandingInvoices?.totalAmount || 0)}
                  icon={CreditCard}
                  loading={isLoading}
                  error={error}
                />

                <ChartCard
                  title="Payment Method Distribution"
                  subtitle="Payments by provider"
                  data={
                    financialData.paymentMethods?.map((item: any) => ({
                      name: item.provider || 'Unknown',
                      value: item.totalAmount || 0,
                      count: item.count || 0,
                    })) || []
                  }
                  type="pie"
                  yAxis="value"
                  colSpan={6}
                  loading={isLoading}
                  error={error}
                />

                <ChartCard
                  title="Invoice Status Distribution"
                  subtitle="Invoices by status"
                  data={
                    financialData.invoiceStatus?.map((item: any) => ({
                      name:
                        item.status?.charAt(0).toUpperCase() + item.status?.slice(1) || 'Unknown',
                      value: item.totalAmount || 0,
                      count: item.count || 0,
                    })) || []
                  }
                  type="bar"
                  xAxis="name"
                  yAxis="value"
                  colSpan={6}
                  loading={isLoading}
                  error={error}
                />

                <Card className="col-span-full">
                  <CardHeader>
                    <CardTitle>Payment Statistics</CardTitle>
                    <CardDescription>Payment success and failure rates</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <p className="text-2xl font-bold">
                          {financialData.paymentSuccess?.total || 0}
                        </p>
                        <p className="text-sm text-muted-foreground">Total Payments</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-green-600">
                          {financialData.paymentSuccess?.successful || 0}
                        </p>
                        <p className="text-sm text-muted-foreground">Successful</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-red-600">
                          {financialData.paymentSuccess?.failed || 0}
                        </p>
                        <p className="text-sm text-muted-foreground">Failed</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold">
                          {financialData.paymentSuccess?.successRate || 0}%
                        </p>
                        <p className="text-sm text-muted-foreground">Success Rate</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
