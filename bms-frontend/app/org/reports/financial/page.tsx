'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/lib/components/ui/card';
import { Button } from '@/lib/components/ui/button';
import { Input } from '@/lib/components/ui/input';
import { Label } from '@/lib/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/lib/components/ui/select';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import {
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
  LineChart,
  Line,
} from 'recharts';
import { DollarSign, Download, FileText, Calendar } from 'lucide-react';

interface FinancialReport {
  period: {
    startDate: string | null;
    endDate: string | null;
  };
  buildingId: string | null;
  totalRevenue: number;
  outstandingReceivables: number;
  overdueAmount: number;
  paymentBreakdown: Array<{
    method: string;
    count: number;
    total: number;
    percentage: number;
  }>;
  monthlyTrends: Array<{
    month: string;
    revenue: number;
    receivables: number;
    paymentsCount: number;
  }>;
  summary: {
    totalPayments: number;
    totalUnpaidInvoices: number;
    totalOverdueInvoices: number;
  };
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function FinancialReportsPage() {
  const [report, setReport] = useState<FinancialReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [buildings, setBuildings] = useState<Array<{ _id: string; name: string }>>([]);
  const [selectedBuilding, setSelectedBuilding] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [exporting, setExporting] = useState<{ csv: boolean; pdf: boolean }>({
    csv: false,
    pdf: false,
  });

  useEffect(() => {
    // Set default date range (last 3 months)
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 3);
    setStartDate(start.toISOString().split('T')[0] || '');
    setEndDate(end.toISOString().split('T')[0] || '');

    // Fetch buildings
    fetch('/api/buildings')
      .then((res) => res.json())
      .then((data) => {
        setBuildings(data.buildings || []);
      })
      .catch((err) => console.error('Failed to fetch buildings:', err));
  }, []);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedBuilding) {
        params.append('buildingId', selectedBuilding);
      }
      if (startDate) {
        params.append('startDate', new Date(startDate).toISOString());
      }
      if (endDate) {
        params.append('endDate', new Date(endDate + 'T23:59:59').toISOString());
      }

      const response = await fetch(`/api/reports/financial?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setReport(data.report);
      } else {
        console.error('Failed to fetch financial report');
      }
    } catch (error) {
      console.error('Error fetching financial report:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedBuilding, startDate, endDate]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ET', {
      style: 'currency',
      currency: 'ETB',
    }).format(amount);
  };

  const handleExportCSV = async () => {
    setExporting((prev) => ({ ...prev, csv: true }));
    try {
      const params = new URLSearchParams();
      if (selectedBuilding) {
        params.append('buildingId', selectedBuilding);
      }
      if (startDate) {
        params.append('startDate', new Date(startDate).toISOString());
      }
      if (endDate) {
        params.append('endDate', new Date(endDate + 'T23:59:59').toISOString());
      }

      const response = await fetch(`/api/reports/financial/export/csv?${params.toString()}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `financial-report-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        // Success feedback
        console.log('CSV export successful');
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('CSV export failed:', errorData);
        alert(`Failed to export CSV: ${errorData.error || 'Please try again.'}`);
      }
    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert(
        `Failed to export CSV: ${error instanceof Error ? error.message : 'Please try again.'}`,
      );
    } finally {
      setExporting((prev) => ({ ...prev, csv: false }));
    }
  };

  const handleExportPDF = async () => {
    setExporting((prev) => ({ ...prev, pdf: true }));
    try {
      const params = new URLSearchParams();
      if (selectedBuilding) {
        params.append('buildingId', selectedBuilding);
      }
      if (startDate) {
        params.append('startDate', new Date(startDate).toISOString());
      }
      if (endDate) {
        params.append('endDate', new Date(endDate + 'T23:59:59').toISOString());
      }

      const response = await fetch(`/api/reports/financial/export/pdf?${params.toString()}`);
      if (response.ok) {
        const blob = await response.blob();
        // Verify it's actually a PDF
        if (blob.type === 'application/pdf' || blob.size > 1000) {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `financial-report-${new Date().toISOString().split('T')[0]}.pdf`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
          // Success feedback
          console.log('PDF export successful');
        } else {
          throw new Error('Invalid PDF file received');
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('PDF export failed:', errorData);
        alert(`Failed to export PDF: ${errorData.error || 'Please try again.'}`);
      }
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert(
        `Failed to export PDF: ${error instanceof Error ? error.message : 'Please try again.'}`,
      );
    } finally {
      setExporting((prev) => ({ ...prev, pdf: false }));
    }
  };

  return (
    <DashboardPage
      title="Financial Reports"
      breadcrumbs={[
        { label: 'Organization', href: '/org' },
        { label: 'Reports', href: '/org/reports' },
        { label: 'Financial', href: '/org/reports/financial' },
      ]}
    >
      {/* Filters */}
      <Card className="mb-6 dark:bg-card dark:border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Filters
          </CardTitle>
          <CardDescription>Select date range and building to filter the report</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="dark:bg-background dark:border-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="dark:bg-background dark:border-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="building">Building (Optional)</Label>
              <Select value={selectedBuilding} onValueChange={setSelectedBuilding}>
                <SelectTrigger id="building" className="dark:bg-background dark:border-input">
                  <SelectValue placeholder="All Buildings" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Buildings</SelectItem>
                  {buildings.map((building) => (
                    <SelectItem key={building._id} value={building._id}>
                      {building.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button
              onClick={handleExportCSV}
              disabled={exporting.csv || exporting.pdf || loading}
              variant="outline"
              className="dark:bg-background dark:border-input"
            >
              <Download className={`mr-2 h-4 w-4 ${exporting.csv ? 'animate-spin' : ''}`} />
              {exporting.csv ? 'Exporting CSV...' : 'Export CSV'}
            </Button>
            <Button
              onClick={handleExportPDF}
              disabled={exporting.csv || exporting.pdf || loading}
              variant="outline"
              className="dark:bg-background dark:border-input"
            >
              <FileText className={`mr-2 h-4 w-4 ${exporting.pdf ? 'animate-spin' : ''}`} />
              {exporting.pdf ? 'Exporting PDF...' : 'Export PDF'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-center py-8">Loading report...</div>
      ) : !report ? (
        <div className="text-center py-8 text-muted-foreground">No data available</div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
            <Card className="dark:bg-card dark:border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(report.totalRevenue)}</div>
                <p className="text-xs text-muted-foreground">
                  {report.summary.totalPayments} payments
                </p>
              </CardContent>
            </Card>

            <Card className="dark:bg-card dark:border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Outstanding Receivables</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(report.outstandingReceivables)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {report.summary.totalUnpaidInvoices} unpaid invoices
                </p>
              </CardContent>
            </Card>

            <Card className="dark:bg-card dark:border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Overdue Amount</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(report.overdueAmount)}</div>
                <p className="text-xs text-muted-foreground">
                  {report.summary.totalOverdueInvoices} overdue invoices
                </p>
              </CardContent>
            </Card>

            <Card className="dark:bg-card dark:border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Payment Methods</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{report.paymentBreakdown.length}</div>
                <p className="text-xs text-muted-foreground">Different methods</p>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid gap-6 md:grid-cols-2 mb-6">
            {/* Payment Breakdown by Method */}
            <Card className="dark:bg-card dark:border-border">
              <CardHeader>
                <CardTitle>Payment Breakdown by Method</CardTitle>
                <CardDescription>Distribution of payments by payment method</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={report.paymentBreakdown}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(props: { percent?: number; index?: number }) => {
                        if (props.index === undefined || props.percent === undefined) return '';
                        const entry = report.paymentBreakdown[props.index];
                        return entry ? `${entry.method}: ${(props.percent * 100).toFixed(1)}%` : '';
                      }}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="total"
                    >
                      {report.paymentBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Payment Breakdown Bar Chart */}
            <Card className="dark:bg-card dark:border-border">
              <CardHeader>
                <CardTitle>Payment Methods Comparison</CardTitle>
                <CardDescription>Total amount by payment method</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={report.paymentBreakdown}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="method" />
                    <YAxis tickFormatter={(value) => `ETB ${(value / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                    <Bar dataKey="total" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Monthly Revenue Trends */}
          {report.monthlyTrends.length > 0 && (
            <Card className="mb-6 dark:bg-card dark:border-border">
              <CardHeader>
                <CardTitle>Monthly Revenue Trends</CardTitle>
                <CardDescription>Revenue and receivables over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={report.monthlyTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis tickFormatter={(value) => `ETB ${(value / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="#8884d8"
                      strokeWidth={2}
                      name="Revenue"
                    />
                    <Line
                      type="monotone"
                      dataKey="receivables"
                      stroke="#82ca9d"
                      strokeWidth={2}
                      name="Receivables"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </DashboardPage>
  );
}
