'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { ArrowLeft, CreditCard, Save, AlertCircle } from 'lucide-react';

interface Tenant {
  _id: string;
  firstName: string;
  lastName: string;
  primaryPhone?: string;
  email?: string;
}

interface Invoice {
  _id: string;
  invoiceNumber: string;
  tenantId: string;
  total: number;
  status: string;
  dueDate: string;
}

export default function NewPaymentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const invoiceIdParam = searchParams.get('invoiceId');
  const tenantIdParam = searchParams.get('tenantId');

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>(tenantIdParam || '');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>(invoiceIdParam || '__none__');
  const [amount, setAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]!);
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        const params = new URLSearchParams();
        if (invoiceIdParam) params.set('invoiceId', invoiceIdParam);
        if (tenantIdParam) params.set('tenantId', tenantIdParam);

        const data = await apiGet<{
          tenants: Tenant[];
          invoices: Invoice[];
          paymentMethods: Array<{ value: string; label: string }>;
        }>(`/api/payments/new?${params.toString()}`);

        setTenants(data.tenants || []);
        setInvoices(data.invoices || []);

        // If invoice is pre-selected, set amount and tenant
        if (invoiceIdParam && data.invoices && data.invoices.length > 0) {
          const invoice = data.invoices[0];
          if (invoice) {
            setSelectedInvoiceId(invoice._id);
            setSelectedTenantId(invoice.tenantId);
            // Calculate remaining balance (we'll need to fetch payments for this)
            setAmount(invoice.total.toString());
          }
        } else if (!invoiceIdParam) {
          // If no invoice is pre-selected, default to "none"
          setSelectedInvoiceId('__none__');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load payment form data');
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [invoiceIdParam, tenantIdParam]);

  // When tenant changes, filter invoices
  useEffect(() => {
    if (selectedTenantId) {
      // Filter invoices for selected tenant
      const tenantInvoices = invoices.filter((inv) => inv.tenantId === selectedTenantId);
      if (tenantInvoices.length > 0 && (selectedInvoiceId === '__none__' || !selectedInvoiceId)) {
        // Auto-select first invoice if available and no invoice is selected
        const firstInvoice = tenantInvoices[0];
        if (firstInvoice) {
          setSelectedInvoiceId(firstInvoice._id);
          setAmount(firstInvoice.total.toString());
        }
      }
    }
  }, [selectedTenantId, invoices, selectedInvoiceId]);

  // When invoice changes, update amount
  useEffect(() => {
    if (selectedInvoiceId && selectedInvoiceId !== '__none__') {
      const invoice = invoices.find((inv) => inv._id === selectedInvoiceId);
      if (invoice) {
        setSelectedTenantId(invoice.tenantId);
        setAmount(invoice.total.toString());
      }
    }
  }, [selectedInvoiceId, invoices]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!selectedTenantId || !amount || !paymentMethod || !paymentDate) {
      setError('Please fill in all required fields');
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Amount must be a positive number');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await apiPost<{
        message: string;
        payment: { _id: string };
      }>('/api/payments', {
        tenantId: selectedTenantId,
        invoiceId: selectedInvoiceId === '__none__' ? null : selectedInvoiceId,
        amount: amountNum,
        paymentMethod,
        paymentDate: new Date(paymentDate).toISOString(),
        referenceNumber: referenceNumber || null,
        notes: notes || null,
        status: 'completed',
      });

      setSuccess('Payment recorded successfully!');
      setTimeout(() => {
        if (selectedInvoiceId && selectedInvoiceId !== '__none__') {
          router.push(`/org/invoices/${selectedInvoiceId}`);
        } else {
          router.push('/org/payments');
        }
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record payment');
    } finally {
      setIsSubmitting(false);
    }
  }

  const selectedTenant = tenants.find((t) => t._id === selectedTenantId);
  const selectedInvoice = invoices.find(
    (inv) => inv._id === selectedInvoiceId && selectedInvoiceId !== '__none__',
  );
  const filteredInvoices = selectedTenantId
    ? invoices.filter((inv) => inv.tenantId === selectedTenantId)
    : invoices;

  if (isLoading) {
    return (
      <DashboardPage>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading payment form...</p>
          </div>
        </div>
      </DashboardPage>
    );
  }

  return (
    <DashboardPage>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button onClick={() => router.back()} variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Record Payment</h1>
            <p className="text-sm text-muted-foreground">Record a new payment manually</p>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800">{success}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Payment Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tenant">Tenant *</Label>
                <Select value={selectedTenantId} onValueChange={setSelectedTenantId} required>
                  <SelectTrigger id="tenant">
                    <SelectValue placeholder="Select tenant" />
                  </SelectTrigger>
                  <SelectContent>
                    {tenants.map((tenant) => (
                      <SelectItem key={tenant._id} value={tenant._id}>
                        {tenant.firstName} {tenant.lastName}
                        {tenant.primaryPhone && ` - ${tenant.primaryPhone}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="invoice">Invoice (Optional)</Label>
                <Select
                  value={selectedInvoiceId}
                  onValueChange={setSelectedInvoiceId}
                  disabled={!selectedTenantId}
                >
                  <SelectTrigger id="invoice">
                    <SelectValue placeholder="Select invoice (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No invoice (manual payment)</SelectItem>
                    {filteredInvoices.map((invoice) => (
                      <SelectItem key={invoice._id} value={invoice._id}>
                        {invoice.invoiceNumber} - {invoice.total.toLocaleString()} ETB (
                        {invoice.status})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedInvoice && (
                  <p className="text-xs text-muted-foreground">
                    Invoice Total: {selectedInvoice.total.toLocaleString()} ETB | Due:{' '}
                    {new Date(selectedInvoice.dueDate).toLocaleDateString()}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount (ETB) *</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="paymentMethod">Payment Method *</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod} required>
                    <SelectTrigger id="paymentMethod">
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="telebirr">Telebirr</SelectItem>
                      <SelectItem value="cbe_birr">CBE Birr</SelectItem>
                      <SelectItem value="chapa">Chapa</SelectItem>
                      <SelectItem value="hellocash">HelloCash</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="paymentDate">Payment Date *</Label>
                  <Input
                    id="paymentDate"
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="referenceNumber">Reference Number</Label>
                  <Input
                    id="referenceNumber"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder="Transaction reference (optional)"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Input
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional notes (optional)"
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3 justify-end">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              <Save className="h-4 w-4 mr-2" />
              {isSubmitting ? 'Recording...' : 'Record Payment'}
            </Button>
          </div>
        </form>
      </div>
    </DashboardPage>
  );
}
