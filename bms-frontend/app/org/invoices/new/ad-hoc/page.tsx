'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { apiGet, apiPost } from '@/lib/utils/api-client';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import { ArrowLeft, FileText, Save, Plus, X, AlertCircle } from 'lucide-react';
import { Textarea } from '@/lib/components/ui/textarea';

interface Tenant {
  _id: string;
  firstName: string;
  lastName: string;
  primaryPhone?: string;
}

interface WorkOrder {
  _id: string;
  title: string;
  status: string;
  estimatedCost?: number | null;
}

interface Invoice {
  _id: string;
  invoiceNumber: string;
  total: number;
  tenantId: string;
}

interface InvoiceItem {
  description: string;
  amount: number;
  type: 'rent' | 'charge' | 'penalty' | 'deposit' | 'other';
}

export default function AdHocInvoicePage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoiceType, setInvoiceType] = useState<'maintenance' | 'penalty' | 'other'>('other');
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string>('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  );
  const [vatRate, setVatRate] = useState<string>('15');
  const [currency, setCurrency] = useState<string>('ETB');
  const [notes, setNotes] = useState<string>('');
  const [items, setItems] = useState<InvoiceItem[]>([
    { description: '', amount: 0, type: 'other' },
  ]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        const [tenantsData, currenciesData] = await Promise.all([
          apiGet<{ tenants: Tenant[] }>('/api/tenants'),
          apiGet<{ currencies: Array<{ code: string; symbol: string }> }>(
            '/api/settings/currencies?activeOnly=true',
          ),
        ]);

        setTenants(tenantsData.tenants || []);
        if (currenciesData.currencies && currenciesData.currencies.length > 0) {
          const primaryCurrency =
            currenciesData.currencies.find((c: any) => c.isPrimary) || currenciesData.currencies[0];
          setCurrency(primaryCurrency.code);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load form data');
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  useEffect(() => {
    async function fetchWorkOrders() {
      if (invoiceType === 'maintenance' && selectedTenantId) {
        try {
          const data = await apiGet<{ workOrders: WorkOrder[] }>(
            `/api/work-orders?tenantId=${selectedTenantId}&status=completed`,
          );
          setWorkOrders(data.workOrders || []);
        } catch (err) {
          console.error('Failed to fetch work orders:', err);
        }
      } else {
        setWorkOrders([]);
      }
    }

    fetchWorkOrders();
  }, [invoiceType, selectedTenantId]);

  useEffect(() => {
    async function fetchInvoices() {
      if (invoiceType === 'penalty' && selectedTenantId) {
        try {
          const data = await apiGet<{ invoices: Invoice[] }>(
            `/api/invoices?tenantId=${selectedTenantId}&status=sent,overdue`,
          );
          setInvoices(data.invoices || []);
        } catch (err) {
          console.error('Failed to fetch invoices:', err);
        }
      } else {
        setInvoices([]);
      }
    }

    fetchInvoices();
  }, [invoiceType, selectedTenantId]);

  function addItem() {
    setItems([...items, { description: '', amount: 0, type: 'other' }]);
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: keyof InvoiceItem, value: string | number) {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!selectedTenantId || !dueDate) {
      setError('Please fill in all required fields');
      return;
    }

    if (invoiceType === 'maintenance' && !selectedWorkOrderId) {
      setError('Work order is required for maintenance invoices');
      return;
    }

    if (invoiceType === 'penalty' && !selectedInvoiceId) {
      setError('Original invoice is required for penalty invoices');
      return;
    }

    if (items.length === 0 || items.some((item) => !item.description || item.amount <= 0)) {
      setError('Please add at least one valid invoice item');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await apiPost<{
        message: string;
        invoice: { _id: string; invoiceNumber: string };
      }>('/api/invoices/ad-hoc', {
        invoiceType,
        tenantId: selectedTenantId,
        items: items.map((item) => ({
          description: item.description,
          amount: item.amount,
          type: item.type,
        })),
        dueDate: new Date(dueDate).toISOString(),
        vatRate: parseFloat(vatRate) || 15,
        currency,
        linkedWorkOrderId: invoiceType === 'maintenance' ? selectedWorkOrderId : null,
        linkedInvoiceId: invoiceType === 'penalty' ? selectedInvoiceId : null,
        notes: notes || null,
      });

      router.push(`/org/invoices/${response.invoice._id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invoice');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <DashboardPage>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </DashboardPage>
    );
  }

  return (
    <DashboardPage>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Create Ad-Hoc Invoice</h1>
            <p className="text-muted-foreground">
              Create invoices for maintenance, penalties, or other charges
            </p>
          </div>
        </div>

        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            </CardContent>
          </Card>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Invoice Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="invoiceType">Invoice Type *</Label>
                  <Select value={invoiceType} onValueChange={(v: any) => setInvoiceType(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="penalty">Penalty</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tenantId">Tenant *</Label>
                  <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select tenant" />
                    </SelectTrigger>
                    <SelectContent>
                      {tenants.map((tenant) => (
                        <SelectItem key={tenant._id} value={tenant._id}>
                          {tenant.firstName} {tenant.lastName} ({tenant.primaryPhone})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {invoiceType === 'maintenance' && (
                  <div className="space-y-2">
                    <Label htmlFor="workOrderId">Work Order *</Label>
                    <Select value={selectedWorkOrderId} onValueChange={setSelectedWorkOrderId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select work order" />
                      </SelectTrigger>
                      <SelectContent>
                        {workOrders.map((wo) => (
                          <SelectItem key={wo._id} value={wo._id}>
                            {wo.title} {wo.estimatedCost ? `(${wo.estimatedCost} ETB)` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {invoiceType === 'penalty' && (
                  <div className="space-y-2">
                    <Label htmlFor="invoiceId">Original Invoice *</Label>
                    <Select value={selectedInvoiceId} onValueChange={setSelectedInvoiceId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select invoice" />
                      </SelectTrigger>
                      <SelectContent>
                        {invoices.map((inv) => (
                          <SelectItem key={inv._id} value={inv._id}>
                            {inv.invoiceNumber} ({inv.total} ETB)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="dueDate">Due Date *</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vatRate">VAT Rate (%)</Label>
                  <Input
                    id="vatRate"
                    type="number"
                    step="0.01"
                    value={vatRate}
                    onChange={(e) => setVatRate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ETB">ETB</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Invoice Items</CardTitle>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-4 items-end">
                  <div className="col-span-5 space-y-2">
                    <Label>Description</Label>
                    <Input
                      value={item.description}
                      onChange={(e) => updateItem(index, 'description', e.target.value)}
                      placeholder="Item description"
                      required
                    />
                  </div>
                  <div className="col-span-3 space-y-2">
                    <Label>Type</Label>
                    <Select
                      value={item.type}
                      onValueChange={(v: any) => updateItem(index, 'type', v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="rent">Rent</SelectItem>
                        <SelectItem value="charge">Charge</SelectItem>
                        <SelectItem value="penalty">Penalty</SelectItem>
                        <SelectItem value="deposit">Deposit</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-3 space-y-2">
                    <Label>Amount</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={item.amount}
                      onChange={(e) => updateItem(index, 'amount', parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <div className="col-span-1">
                    {items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Additional Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional notes or comments"
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Save className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Create Invoice
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </DashboardPage>
  );
}

