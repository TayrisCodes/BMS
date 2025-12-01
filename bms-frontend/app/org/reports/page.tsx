'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/lib/components/ui/card';
import { Button } from '@/lib/components/ui/button';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import { DollarSign, Building2, Wrench, ArrowRight, TrendingUp, FileText } from 'lucide-react';

export default function ReportsPage() {
  const [stats, setStats] = useState<{
    totalRevenue?: number;
    outstandingReceivables?: number;
    totalUnits?: number;
    occupiedUnits?: number;
    totalComplaints?: number;
    totalWorkOrders?: number;
  }>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        // Fetch quick stats from various endpoints
        const [financialRes, occupancyRes, operationalRes] = await Promise.all([
          fetch('/api/reports/financial'),
          fetch('/api/reports/occupancy'),
          fetch('/api/reports/operational'),
        ]);

        if (financialRes.ok) {
          const financialData = await financialRes.json();
          setStats((prev) => ({
            ...prev,
            totalRevenue: financialData.report?.totalRevenue || 0,
            outstandingReceivables: financialData.report?.outstandingReceivables || 0,
          }));
        }

        if (occupancyRes.ok) {
          const occupancyData = await occupancyRes.json();
          setStats((prev) => ({
            ...prev,
            totalUnits: occupancyData.report?.summary?.totalUnits || 0,
            occupiedUnits: occupancyData.report?.summary?.occupiedUnits || 0,
          }));
        }

        if (operationalRes.ok) {
          const operationalData = await operationalRes.json();
          setStats((prev) => ({
            ...prev,
            totalComplaints: operationalData.report?.complaints?.total || 0,
            totalWorkOrders: operationalData.report?.workOrders?.total || 0,
          }));
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ET', {
      style: 'currency',
      currency: 'ETB',
    }).format(amount);
  };

  return (
    <DashboardPage
      title="Reports Dashboard"
      breadcrumbs={[
        { label: 'Organization', href: '/org' },
        { label: 'Reports', href: '/org/reports' },
      ]}
    >
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Financial Reports Card */}
        <Card className="hover:shadow-lg transition-shadow dark:bg-card dark:border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                <CardTitle>Financial Reports</CardTitle>
              </div>
            </div>
            <CardDescription>Revenue, receivables, and payment analytics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Revenue</span>
                <span className="font-semibold">
                  {loading ? '...' : formatCurrency(stats.totalRevenue || 0)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Outstanding</span>
                <span className="font-semibold">
                  {loading ? '...' : formatCurrency(stats.outstandingReceivables || 0)}
                </span>
              </div>
              <Link href="/org/reports/financial">
                <Button className="w-full" variant="default">
                  View Financial Reports
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Occupancy Reports Card */}
        <Card className="hover:shadow-lg transition-shadow dark:bg-card dark:border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                <CardTitle>Occupancy Reports</CardTitle>
              </div>
            </div>
            <CardDescription>Unit occupancy, vacancy rates, and trends</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Units</span>
                <span className="font-semibold">{loading ? '...' : stats.totalUnits || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Occupied</span>
                <span className="font-semibold">
                  {loading ? '...' : `${stats.occupiedUnits || 0} / ${stats.totalUnits || 0}`}
                </span>
              </div>
              <Link href="/org/reports/occupancy">
                <Button className="w-full" variant="default">
                  View Occupancy Reports
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Operational Reports Card */}
        <Card className="hover:shadow-lg transition-shadow dark:bg-card dark:border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wrench className="h-5 w-5 text-primary" />
                <CardTitle>Operational Reports</CardTitle>
              </div>
            </div>
            <CardDescription>Complaints, work orders, and maintenance metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Complaints</span>
                <span className="font-semibold">
                  {loading ? '...' : stats.totalComplaints || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Work Orders</span>
                <span className="font-semibold">
                  {loading ? '...' : stats.totalWorkOrders || 0}
                </span>
              </div>
              <Link href="/org/reports/operational">
                <Button className="w-full" variant="default">
                  View Operational Reports
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="mt-6 dark:bg-card dark:border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Quick Actions
          </CardTitle>
          <CardDescription>Export reports for ERCA compliance and auditing</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <Link href="/org/reports/financial">
              <Button variant="outline" className="w-full">
                <TrendingUp className="mr-2 h-4 w-4" />
                Export Financial Data
              </Button>
            </Link>
            <Link href="/org/reports/occupancy">
              <Button variant="outline" className="w-full">
                <Building2 className="mr-2 h-4 w-4" />
                Export Occupancy Data
              </Button>
            </Link>
            <Link href="/org/reports/operational">
              <Button variant="outline" className="w-full">
                <Wrench className="mr-2 h-4 w-4" />
                Export Operational Data
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </DashboardPage>
  );
}
