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
import { Wrench, Download, FileText, Calendar, AlertCircle } from 'lucide-react';

interface OperationalReport {
  period: {
    startDate: string | null;
    endDate: string | null;
  };
  buildingId: string | null;
  complaints: {
    total: number;
    byStatus: Array<{ status: string; count: number }>;
    byCategory: Array<{ category: string; count: number }>;
    averageResolutionTime: number;
    resolvedCount: number;
    trends: Array<{
      month: string;
      count: number;
      resolved: number;
    }>;
  };
  workOrders: {
    total: number;
    byStatus: Array<{ status: string; count: number }>;
    byPriority: Array<{ priority: string; count: number }>;
    completionRate: number;
    completedCount: number;
    trends: Array<{
      month: string;
      count: number;
      completed: number;
    }>;
  };
  summary: {
    totalComplaints: number;
    totalWorkOrders: number;
    openComplaints: number;
    openWorkOrders: number;
  };
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function OperationalReportsPage() {
  const [report, setReport] = useState<OperationalReport | null>(null);
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

      const response = await fetch(`/api/reports/operational?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setReport(data.report);
      } else {
        console.error('Failed to fetch operational report');
      }
    } catch (error) {
      console.error('Error fetching operational report:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedBuilding, startDate, endDate]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

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

      const response = await fetch(`/api/reports/operational/export/csv?${params.toString()}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `operational-report-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
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

      const response = await fetch(`/api/reports/operational/export/pdf?${params.toString()}`);
      if (response.ok) {
        const blob = await response.blob();
        // Verify it's actually a PDF
        if (blob.type === 'application/pdf' || blob.size > 1000) {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `operational-report-${new Date().toISOString().split('T')[0]}.pdf`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
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
      title="Operational Reports"
      breadcrumbs={[
        { label: 'Organization', href: '/org' },
        { label: 'Reports', href: '/org/reports' },
        { label: 'Operational', href: '/org/reports/operational' },
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
                <CardTitle className="text-sm font-medium">Total Complaints</CardTitle>
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{report.complaints.total}</div>
                <p className="text-xs text-muted-foreground">
                  {report.summary.openComplaints} open
                </p>
              </CardContent>
            </Card>

            <Card className="dark:bg-card dark:border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Work Orders</CardTitle>
                <Wrench className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{report.workOrders.total}</div>
                <p className="text-xs text-muted-foreground">
                  {report.summary.openWorkOrders} open
                </p>
              </CardContent>
            </Card>

            <Card className="dark:bg-card dark:border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Resolution Time</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {report.complaints.averageResolutionTime.toFixed(1)} days
                </div>
                <p className="text-xs text-muted-foreground">
                  {report.complaints.resolvedCount} resolved
                </p>
              </CardContent>
            </Card>

            <Card className="dark:bg-card dark:border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
                <Wrench className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {report.workOrders.completionRate.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">
                  {report.workOrders.completedCount} completed
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Complaints Charts */}
          <div className="grid gap-6 md:grid-cols-2 mb-6">
            <Card className="dark:bg-card dark:border-border">
              <CardHeader>
                <CardTitle>Complaints by Status</CardTitle>
                <CardDescription>Distribution of complaints by status</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={report.complaints.byStatus}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(props: { percent?: number; index?: number }) => {
                        if (props.index === undefined) return '';
                        const entry = report.complaints.byStatus[props.index];
                        return entry ? `${entry.status}: ${entry.count}` : '';
                      }}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {report.complaints.byStatus.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="dark:bg-card dark:border-border">
              <CardHeader>
                <CardTitle>Complaints by Category</CardTitle>
                <CardDescription>Distribution of complaints by category</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={report.complaints.byCategory}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="category" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="count" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Work Orders Charts */}
          <div className="grid gap-6 md:grid-cols-2 mb-6">
            <Card className="dark:bg-card dark:border-border">
              <CardHeader>
                <CardTitle>Work Orders by Status</CardTitle>
                <CardDescription>Distribution of work orders by status</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={report.workOrders.byStatus}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(props: { percent?: number; index?: number }) => {
                        if (props.index === undefined) return '';
                        const entry = report.workOrders.byStatus[props.index];
                        return entry ? `${entry.status}: ${entry.count}` : '';
                      }}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {report.workOrders.byStatus.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="dark:bg-card dark:border-border">
              <CardHeader>
                <CardTitle>Work Orders by Priority</CardTitle>
                <CardDescription>Distribution of work orders by priority</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={report.workOrders.byPriority}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="priority" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="count" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Trends Charts */}
          {report.complaints.trends.length > 0 && (
            <Card className="mb-6 dark:bg-card dark:border-border">
              <CardHeader>
                <CardTitle>Complaints Trends</CardTitle>
                <CardDescription>Complaints and resolutions over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={report.complaints.trends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#8884d8"
                      strokeWidth={2}
                      name="Total Complaints"
                    />
                    <Line
                      type="monotone"
                      dataKey="resolved"
                      stroke="#82ca9d"
                      strokeWidth={2}
                      name="Resolved"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {report.workOrders.trends.length > 0 && (
            <Card className="mb-6 dark:bg-card dark:border-border">
              <CardHeader>
                <CardTitle>Work Orders Trends</CardTitle>
                <CardDescription>Work orders and completions over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={report.workOrders.trends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#8884d8"
                      strokeWidth={2}
                      name="Total Work Orders"
                    />
                    <Line
                      type="monotone"
                      dataKey="completed"
                      stroke="#82ca9d"
                      strokeWidth={2}
                      name="Completed"
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
