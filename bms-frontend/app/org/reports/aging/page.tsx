'use client';

import { useEffect, useState } from 'react';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/lib/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { Badge } from '@/lib/components/ui/badge';
import { apiGet } from '@/lib/utils/api-client';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import { Calendar, Building2, Users, TrendingUp } from 'lucide-react';

interface AgingBucket {
  bucket: string;
  label: string;
  total: number;
  invoiceCount: number;
  invoices: Array<{
    invoiceId: string;
    invoiceNumber: string;
    tenantId: string;
    amount: number;
    dueDate: string;
    daysOverdue: number;
  }>;
}

interface AgingReport {
  asOfDate: string;
  buckets: AgingBucket[];
  totalReceivables: number;
  totalInvoiceCount: number;
}

export default function AgingReportPage() {
  const [report, setReport] = useState<AgingReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [asOfDate, setAsOfDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [buildingId, setBuildingId] = useState<string>('');
  const [tenantId, setTenantId] = useState<string>('');
  const [buildings, setBuildings] = useState<Array<{ _id: string; name: string }>>([]);
  const [tenants, setTenants] = useState<
    Array<{ _id: string; firstName: string; lastName: string }>
  >([]);

  useEffect(() => {
    fetchBuildings();
    fetchTenants();
    generateReport();
  }, []);

  async function fetchBuildings() {
    try {
      const data = await apiGet<{ buildings: Array<{ _id: string; name: string }> }>(
        '/api/buildings',
      );
      setBuildings(data.buildings || []);
    } catch (err) {
      console.error('Failed to fetch buildings:', err);
    }
  }

  async function fetchTenants() {
    try {
      const data = await apiGet<{
        tenants: Array<{ _id: string; firstName: string; lastName: string }>;
      }>('/api/tenants');
      setTenants(data.tenants || []);
    } catch (err) {
      console.error('Failed to fetch tenants:', err);
    }
  }

  async function generateReport() {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      params.set('asOf', asOfDate);
      if (buildingId) params.set('buildingId', buildingId);
      if (tenantId) params.set('tenantId', tenantId);

      const data = await apiGet<{ report: AgingReport }>(`/api/reports/aging?${params.toString()}`);
      setReport(data.report);
    } catch (err) {
      console.error('Failed to generate report:', err);
    } finally {
      setIsLoading(false);
    }
  }

  const bucketColors: Record<string, string> = {
    current: 'bg-green-100 text-green-800',
    '31-60': 'bg-yellow-100 text-yellow-800',
    '61-90': 'bg-orange-100 text-orange-800',
    '90+': 'bg-red-100 text-red-800',
  };

  return (
    <DashboardPage>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Aging Report</h1>
          <p className="text-muted-foreground">Track receivables by aging buckets</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="asOfDate">As Of Date</Label>
                <Input
                  id="asOfDate"
                  type="date"
                  value={asOfDate}
                  onChange={(e) => setAsOfDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="buildingId">Building</Label>
                <Select value={buildingId} onValueChange={setBuildingId}>
                  <SelectTrigger>
                    <SelectValue placeholder="All buildings" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All buildings</SelectItem>
                    {buildings.map((b) => (
                      <SelectItem key={b._id} value={b._id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tenantId">Tenant</Label>
                <Select value={tenantId} onValueChange={setTenantId}>
                  <SelectTrigger>
                    <SelectValue placeholder="All tenants" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All tenants</SelectItem>
                    {tenants.map((t) => (
                      <SelectItem key={t._id} value={t._id}>
                        {t.firstName} {t.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>&nbsp;</Label>
                <Button onClick={generateReport} className="w-full" disabled={isLoading}>
                  Generate Report
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {report && (
          <>
            <div className="grid grid-cols-4 gap-4">
              {report.buckets.map((bucket) => (
                <Card key={bucket.bucket}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">{bucket.label}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{bucket.total.toLocaleString()} ETB</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {bucket.invoiceCount} invoice{bucket.invoiceCount !== 1 ? 's' : ''}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Aging Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {report.buckets.map((bucket) => (
                    <div key={bucket.bucket}>
                      <div className="flex items-center gap-2 mb-4">
                        <Badge className={bucketColors[bucket.bucket] || ''}>{bucket.label}</Badge>
                        <span className="text-sm text-muted-foreground">
                          Total: {bucket.total.toLocaleString()} ETB ({bucket.invoiceCount}{' '}
                          invoices)
                        </span>
                      </div>
                      {bucket.invoices.length > 0 ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Invoice #</TableHead>
                              <TableHead>Tenant</TableHead>
                              <TableHead>Due Date</TableHead>
                              <TableHead>Days Overdue</TableHead>
                              <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {bucket.invoices.map((invoice) => (
                              <TableRow key={invoice.invoiceId}>
                                <TableCell className="font-medium">
                                  {invoice.invoiceNumber}
                                </TableCell>
                                <TableCell>{invoice.tenantId}</TableCell>
                                <TableCell>
                                  {new Date(invoice.dueDate).toLocaleDateString()}
                                </TableCell>
                                <TableCell>{invoice.daysOverdue} days</TableCell>
                                <TableCell className="text-right">
                                  {invoice.amount.toLocaleString()} ETB
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <p className="text-sm text-muted-foreground">No invoices in this bucket</p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardPage>
  );
}
