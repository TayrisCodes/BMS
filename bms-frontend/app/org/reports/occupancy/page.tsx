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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/lib/components/ui/select';
import { Label } from '@/lib/components/ui/label';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Building2, Download, FileText } from 'lucide-react';

interface OccupancyReport {
  buildingId: string | null;
  summary: {
    totalUnits: number;
    occupiedUnits: number;
    availableUnits: number;
    maintenanceUnits: number;
    reservedUnits: number;
    occupancyRate: number;
    vacancyRate: number;
  };
  occupancyByBuilding: Array<{
    buildingId: string;
    buildingName: string;
    totalUnits: number;
    occupiedUnits: number;
    availableUnits: number;
    maintenanceUnits: number;
    reservedUnits: number;
    occupancyRate: number;
    vacancyRate: number;
  }> | null;
}

export default function OccupancyReportsPage() {
  const [report, setReport] = useState<OccupancyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [buildings, setBuildings] = useState<Array<{ _id: string; name: string }>>([]);
  const [selectedBuilding, setSelectedBuilding] = useState<string>('__all__');
  const [exporting, setExporting] = useState<{ csv: boolean; pdf: boolean }>({
    csv: false,
    pdf: false,
  });

  useEffect(() => {
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
      if (selectedBuilding && selectedBuilding !== '__all__') {
        params.append('buildingId', selectedBuilding);
      }

      const response = await fetch(`/api/reports/occupancy?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setReport(data.report);
      } else {
        console.error('Failed to fetch occupancy report');
      }
    } catch (error) {
      console.error('Error fetching occupancy report:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedBuilding]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleExportCSV = async () => {
    setExporting((prev) => ({ ...prev, csv: true }));
    try {
      const params = new URLSearchParams();
      if (selectedBuilding && selectedBuilding !== '__all__') {
        params.append('buildingId', selectedBuilding);
      }

      const response = await fetch(`/api/reports/occupancy/export/csv?${params.toString()}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `occupancy-report-${new Date().toISOString().split('T')[0]}.csv`;
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
      if (selectedBuilding && selectedBuilding !== '__all__') {
        params.append('buildingId', selectedBuilding);
      }

      const response = await fetch(`/api/reports/occupancy/export/pdf?${params.toString()}`);
      if (response.ok) {
        const blob = await response.blob();
        // Verify it's actually a PDF
        if (blob.type === 'application/pdf' || blob.size > 1000) {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `occupancy-report-${new Date().toISOString().split('T')[0]}.pdf`;
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
      title="Occupancy Reports"
      breadcrumbs={[
        { label: 'Organization', href: '/org' },
        { label: 'Reports', href: '/org/reports' },
        { label: 'Occupancy', href: '/org/reports/occupancy' },
      ]}
    >
      {/* Filters */}
      <Card className="mb-6 dark:bg-card dark:border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Filters
          </CardTitle>
          <CardDescription>Select building to filter the report</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="building">Building (Optional)</Label>
              <Select value={selectedBuilding} onValueChange={setSelectedBuilding}>
                <SelectTrigger id="building" className="dark:bg-background dark:border-input">
                  <SelectValue placeholder="All Buildings" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Buildings</SelectItem>
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
                <CardTitle className="text-sm font-medium">Total Units</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{report.summary.totalUnits}</div>
                <p className="text-xs text-muted-foreground">All units</p>
              </CardContent>
            </Card>

            <Card className="dark:bg-card dark:border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Occupied Units</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{report.summary.occupiedUnits}</div>
                <p className="text-xs text-muted-foreground">
                  {report.summary.occupancyRate.toFixed(1)}% occupancy rate
                </p>
              </CardContent>
            </Card>

            <Card className="dark:bg-card dark:border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Available Units</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{report.summary.availableUnits}</div>
                <p className="text-xs text-muted-foreground">
                  {report.summary.vacancyRate.toFixed(1)}% vacancy rate
                </p>
              </CardContent>
            </Card>

            <Card className="dark:bg-card dark:border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Other Units</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {report.summary.maintenanceUnits + report.summary.reservedUnits}
                </div>
                <p className="text-xs text-muted-foreground">
                  {report.summary.maintenanceUnits} maintenance, {report.summary.reservedUnits}{' '}
                  reserved
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Occupancy by Building */}
          {report.occupancyByBuilding && report.occupancyByBuilding.length > 0 && (
            <>
              <Card className="mb-6 dark:bg-card dark:border-border">
                <CardHeader>
                  <CardTitle>Occupancy by Building</CardTitle>
                  <CardDescription>Breakdown of occupancy across all buildings</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Building</th>
                          <th className="text-right p-2">Total Units</th>
                          <th className="text-right p-2">Occupied</th>
                          <th className="text-right p-2">Available</th>
                          <th className="text-right p-2">Maintenance</th>
                          <th className="text-right p-2">Reserved</th>
                          <th className="text-right p-2">Occupancy Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.occupancyByBuilding.map((building) => (
                          <tr key={building.buildingId} className="border-b">
                            <td className="p-2 font-medium">{building.buildingName}</td>
                            <td className="p-2 text-right">{building.totalUnits}</td>
                            <td className="p-2 text-right">{building.occupiedUnits}</td>
                            <td className="p-2 text-right">{building.availableUnits}</td>
                            <td className="p-2 text-right">{building.maintenanceUnits}</td>
                            <td className="p-2 text-right">{building.reservedUnits}</td>
                            <td className="p-2 text-right">{building.occupancyRate.toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Occupancy Rate Chart */}
              <Card className="mb-6 dark:bg-card dark:border-border">
                <CardHeader>
                  <CardTitle>Occupancy Rate by Building</CardTitle>
                  <CardDescription>Visual comparison of occupancy rates</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={report.occupancyByBuilding}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="buildingName" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="occupancyRate" fill="#8884d8" name="Occupancy Rate (%)" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Unit Status Distribution */}
              <Card className="mb-6 dark:bg-card dark:border-border">
                <CardHeader>
                  <CardTitle>Unit Status Distribution</CardTitle>
                  <CardDescription>Breakdown of unit statuses across buildings</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={report.occupancyByBuilding}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="buildingName" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="occupiedUnits" stackId="a" fill="#8884d8" name="Occupied" />
                      <Bar dataKey="availableUnits" stackId="a" fill="#82ca9d" name="Available" />
                      <Bar
                        dataKey="maintenanceUnits"
                        stackId="a"
                        fill="#ffc658"
                        name="Maintenance"
                      />
                      <Bar dataKey="reservedUnits" stackId="a" fill="#ff7300" name="Reserved" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </DashboardPage>
  );
}
