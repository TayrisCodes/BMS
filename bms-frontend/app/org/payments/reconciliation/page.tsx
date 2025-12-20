'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/lib/components/ui/button';
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
import { Checkbox } from '@/lib/components/ui/checkbox';
import { apiGet, apiPost } from '@/lib/utils/api-client';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import { CheckCircle2, Clock, AlertCircle, Download } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/lib/components/ui/dialog';
import { Input } from '@/lib/components/ui/input';
import { Label } from '@/lib/components/ui/label';
import { Textarea } from '@/lib/components/ui/textarea';

interface Payment {
  _id: string;
  invoiceId?: string | null;
  tenantId: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  paymentDate: string;
  referenceNumber?: string | null;
  providerTransactionId?: string | null;
  reconciliationStatus: string;
  notes?: string | null;
}

export default function PaymentReconciliationPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [selectedPayments, setSelectedPayments] = useState<Set<string>>(new Set());
  const [reconcileDialogOpen, setReconcileDialogOpen] = useState(false);
  const [bankStatementRef, setBankStatementRef] = useState('');
  const [reconciliationNotes, setReconciliationNotes] = useState('');

  useEffect(() => {
    fetchPayments();
  }, [statusFilter]);

  async function fetchPayments() {
    try {
      setIsLoading(true);
      const data = await apiGet<{ payments: Payment[] }>(
        `/api/payments/reconciliation?status=${statusFilter}`,
      );
      setPayments(data.payments || []);
    } catch (err) {
      console.error('Failed to fetch payments:', err);
    } finally {
      setIsLoading(false);
    }
  }

  function togglePaymentSelection(paymentId: string) {
    const newSelection = new Set(selectedPayments);
    if (newSelection.has(paymentId)) {
      newSelection.delete(paymentId);
    } else {
      newSelection.add(paymentId);
    }
    setSelectedPayments(newSelection);
  }

  function toggleAllPayments() {
    if (selectedPayments.size === payments.length) {
      setSelectedPayments(new Set());
    } else {
      setSelectedPayments(new Set(payments.map((p) => p._id)));
    }
  }

  async function handleBulkReconcile() {
    if (selectedPayments.size === 0) {
      return;
    }

    setReconcileDialogOpen(true);
  }

  async function confirmBulkReconcile() {
    try {
      await apiPost('/api/payments/reconciliation/bulk', {
        paymentIds: Array.from(selectedPayments),
        bankStatementReference: bankStatementRef || null,
        reconciliationNotes: reconciliationNotes || null,
      });

      setReconcileDialogOpen(false);
      setBankStatementRef('');
      setReconciliationNotes('');
      setSelectedPayments(new Set());
      fetchPayments();
    } catch (err) {
      console.error('Failed to reconcile payments:', err);
    }
  }

  async function handleSingleReconcile(paymentId: string) {
    try {
      await apiPost(`/api/payments/${paymentId}/reconcile`, {
        bankStatementReference: bankStatementRef || null,
        reconciliationNotes: reconciliationNotes || null,
      });

      setReconcileDialogOpen(false);
      setBankStatementRef('');
      setReconciliationNotes('');
      fetchPayments();
    } catch (err) {
      console.error('Failed to reconcile payment:', err);
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'reconciled':
        return <Badge className="bg-green-100 text-green-800">Reconciled</Badge>;
      case 'disputed':
        return <Badge className="bg-red-100 text-red-800">Disputed</Badge>;
      default:
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
    }
  };

  return (
    <DashboardPage>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Payment Reconciliation</h1>
            <p className="text-muted-foreground">Reconcile payments with bank statements</p>
          </div>
          {selectedPayments.size > 0 && (
            <Button onClick={handleBulkReconcile}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Reconcile Selected ({selectedPayments.size})
            </Button>
          )}
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Payments</CardTitle>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="reconciled">Reconciled</SelectItem>
                  <SelectItem value="disputed">Disputed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : payments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No payments found for reconciliation
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedPayments.size === payments.length}
                        onCheckedChange={toggleAllPayments}
                      />
                    </TableHead>
                    <TableHead>Payment Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment._id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedPayments.has(payment._id)}
                          onCheckedChange={() => togglePaymentSelection(payment._id)}
                        />
                      </TableCell>
                      <TableCell>{new Date(payment.paymentDate).toLocaleDateString()}</TableCell>
                      <TableCell>
                        {payment.currency} {payment.amount.toLocaleString()}
                      </TableCell>
                      <TableCell>{payment.paymentMethod}</TableCell>
                      <TableCell>
                        {payment.referenceNumber || payment.providerTransactionId || '—'}
                      </TableCell>
                      <TableCell>{getStatusBadge(payment.reconciliationStatus)}</TableCell>
                      <TableCell>
                        {payment.reconciliationStatus === 'pending' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedPayments(new Set([payment._id]));
                              handleBulkReconcile();
                            }}
                          >
                            Reconcile
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={reconcileDialogOpen} onOpenChange={setReconcileDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reconcile Payment{selectedPayments.size > 1 ? 's' : ''}</DialogTitle>
              <DialogDescription>
                Mark payment{selectedPayments.size > 1 ? 's' : ''} as reconciled and link to bank
                statement
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bankStatementRef">Bank Statement Reference</Label>
                <Input
                  id="bankStatementRef"
                  value={bankStatementRef}
                  onChange={(e) => setBankStatementRef(e.target.value)}
                  placeholder="e.g., TXN-123456"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reconciliationNotes">Notes</Label>
                <Textarea
                  id="reconciliationNotes"
                  value={reconciliationNotes}
                  onChange={(e) => setReconciliationNotes(e.target.value)}
                  placeholder="Additional reconciliation notes"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReconcileDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={confirmBulkReconcile}>Reconcile</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardPage>
  );
}

