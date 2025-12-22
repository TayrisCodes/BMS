'use client';

import { useEffect, useState } from 'react';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import { StatCard } from '@/lib/components/dashboard/cards/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { apiGet } from '@/lib/utils/api-client';
import {
  DollarSign,
  TrendingUp,
  Car,
  UserCheck,
  Building2,
  Receipt,
  AlertCircle,
} from 'lucide-react';

interface ParkingAssignment {
  _id: string;
  assignmentType: 'tenant' | 'visitor';
  billingPeriod: 'monthly' | 'daily' | 'hourly';
  rate: number;
  invoiceId: string | null;
  status: 'active' | 'completed' | 'cancelled';
  startDate: string;
  endDate: string | null;
}

interface Invoice {
  _id: string;
  total: number;
  status: string;
}

interface RevenueStats {
  totalRevenue: number;
  tenantRevenue: number;
  visitorRevenue: number;
  activeAssignments: number;
  completedAssignments: number;
  outstandingInvoices: number;
  outstandingAmount: number;
}

export default function ParkingRevenuePage() {
  const [stats, setStats] = useState<RevenueStats>({
    totalRevenue: 0,
    tenantRevenue: 0,
    visitorRevenue: 0,
    activeAssignments: 0,
    completedAssignments: 0,
    outstandingInvoices: 0,
    outstandingAmount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRevenueData() {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch all parking assignments
        const assignmentsData = await apiGet<{ parkingAssignments: ParkingAssignment[] }>(
          '/api/parking/assignments',
        );
        const assignments = assignmentsData.parkingAssignments || [];

        // Fetch invoices for assignments that have them
        const invoiceIds = assignments
          .filter((a) => a.invoiceId)
          .map((a) => a.invoiceId)
          .filter((id): id is string => id !== null);

        let invoices: Invoice[] = [];
        if (invoiceIds.length > 0) {
          // Fetch invoices (we'll need to batch this or create a bulk endpoint)
          // For now, we'll calculate from assignments
          const invoicesData = await apiGet<{ invoices: Invoice[] }>(
            `/api/invoices?limit=1000`,
          ).catch(() => ({ invoices: [] }));
          invoices = invoicesData.invoices || [];
        }

        // Calculate revenue stats
        const completedAssignments = assignments.filter((a) => a.status === 'completed');
        const activeAssignments = assignments.filter((a) => a.status === 'active');
        const tenantAssignments = assignments.filter((a) => a.assignmentType === 'tenant');
        const visitorAssignments = assignments.filter((a) => a.assignmentType === 'visitor');

        // Calculate revenue from completed assignments with invoices
        let totalRevenue = 0;
        let tenantRevenue = 0;
        let visitorRevenue = 0;

        completedAssignments.forEach((assignment) => {
          if (assignment.invoiceId) {
            const invoice = invoices.find((inv) => inv._id === assignment.invoiceId);
            if (invoice && invoice.status === 'paid') {
              totalRevenue += invoice.total;
              if (assignment.assignmentType === 'tenant') {
                tenantRevenue += invoice.total;
              } else {
                visitorRevenue += invoice.total;
              }
            }
          }
        });

        // Calculate outstanding invoices
        const outstandingInvoices = invoices.filter(
          (inv) =>
            inv.status !== 'paid' &&
            assignments.some((a) => a.invoiceId === inv._id && a.status === 'active'),
        );
        const outstandingAmount = outstandingInvoices.reduce((sum, inv) => sum + inv.total, 0);

        setStats({
          totalRevenue,
          tenantRevenue,
          visitorRevenue,
          activeAssignments: activeAssignments.length,
          completedAssignments: completedAssignments.length,
          outstandingInvoices: outstandingInvoices.length,
          outstandingAmount,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load revenue data');
      } finally {
        setIsLoading(false);
      }
    }

    fetchRevenueData();
  }, []);

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-ET', {
      style: 'currency',
      currency: 'ETB',
      minimumFractionDigits: 0,
    }).format(amount);
  }

  return (
    <DashboardPage
      title="Parking Revenue"
      breadcrumbs={[
        { label: 'Organization', href: '/org' },
        { label: 'Parking', href: '/org/parking/spaces' },
        { label: 'Revenue', href: '/org/parking/revenue' },
      ]}
    >
      <div className="col-span-full space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <DollarSign className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-xl font-semibold">Parking Revenue Dashboard</h2>
            <p className="text-sm text-muted-foreground">
              Overview of parking revenue and financial metrics
            </p>
          </div>
        </div>

        {error && (
          <div className="col-span-full bg-destructive/10 text-destructive p-4 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              <p>{error}</p>
            </div>
          </div>
        )}

        {/* Revenue Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Revenue"
            value={formatCurrency(stats.totalRevenue)}
            icon={DollarSign}
            loading={isLoading}
            error={error}
          />
          <StatCard
            label="Tenant Revenue"
            value={formatCurrency(stats.tenantRevenue)}
            icon={Car}
            loading={isLoading}
            error={error}
          />
          <StatCard
            label="Visitor Revenue"
            value={formatCurrency(stats.visitorRevenue)}
            icon={UserCheck}
            loading={isLoading}
            error={error}
          />
          <StatCard
            label="Outstanding Amount"
            value={formatCurrency(stats.outstandingAmount)}
            icon={TrendingUp}
            loading={isLoading}
            error={error}
          />
        </div>

        {/* Assignment Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Assignments</CardTitle>
              <Car className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeAssignments}</div>
              <p className="text-xs text-muted-foreground">Currently active parking</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed Assignments</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completedAssignments}</div>
              <p className="text-xs text-muted-foreground">Total completed</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Outstanding Invoices</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.outstandingInvoices}</div>
              <p className="text-xs text-muted-foreground">Unpaid parking invoices</p>
            </CardContent>
          </Card>
        </div>

        {/* Revenue Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Car className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Tenant Parking Revenue</span>
                </div>
                <span className="text-lg font-semibold">{formatCurrency(stats.tenantRevenue)}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Visitor Parking Revenue</span>
                </div>
                <span className="text-lg font-semibold">
                  {formatCurrency(stats.visitorRevenue)}
                </span>
              </div>
              <div className="border-t pt-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">Total Revenue</span>
                </div>
                <span className="text-2xl font-bold text-primary">
                  {formatCurrency(stats.totalRevenue)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardPage>
  );
}
