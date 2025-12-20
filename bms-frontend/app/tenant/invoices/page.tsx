'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MobileCard } from '@/lib/components/tenant/MobileCard';
import { MobileList } from '@/lib/components/tenant/MobileList';
import { SwipeableCard } from '@/lib/components/tenant/SwipeableCard';
import { Button } from '@/lib/components/ui/button';
import { Badge } from '@/lib/components/ui/badge';
import { ArrowRight, CreditCard } from 'lucide-react';

interface Invoice {
  id: string;
  number: string;
  amount: number;
  dueDate: string;
  status: string;
  createdAt: string;
  subtotal?: number;
  tax?: number;
  vatRate?: number;
  netIncomeBeforeVat?: number;
  netIncomeAfterVat?: number;
}

export default function TenantInvoicesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'paid' | 'unpaid' | 'overdue'>('all');

  useEffect(() => {
    async function fetchInvoices() {
      try {
        setLoading(true);
        const statusParam = searchParams.get('status');
        if (statusParam) {
          setFilter(statusParam as typeof filter);
        }

        const response = await fetch('/api/tenant/invoices');
        if (response.ok) {
          const data = await response.json();
          setInvoices(data.invoices || data || []);
        } else {
          setInvoices([]);
        }
      } catch (error) {
        console.error('Failed to fetch invoices:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchInvoices();
  }, [searchParams]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ET', {
      style: 'currency',
      currency: 'ETB',
    }).format(amount);
  };

  const filteredInvoices = invoices.filter((invoice) => {
    if (filter === 'all') return true;
    return invoice.status === filter;
  });

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'paid':
        return 'default';
      case 'overdue':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  return (
    <div className="space-y-4">
      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {(['all', 'unpaid', 'paid', 'overdue'] as const).map((status) => (
          <Button
            key={status}
            variant={filter === status ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setFilter(status);
              router.push(`/tenant/invoices${status !== 'all' ? `?status=${status}` : ''}`);
            }}
            className="flex-shrink-0 capitalize"
          >
            {status}
          </Button>
        ))}
      </div>

      {/* Invoices List */}
      <MobileList
        items={filteredInvoices}
        loading={loading}
        emptyMessage="No invoices found"
        renderItem={(invoice) => (
          <SwipeableCard
            onSwipeLeft={() => router.push(`/tenant/invoices/${invoice.id}`)}
            onSwipeRight={() => {
              if (invoice.status !== 'paid') {
                router.push(`/tenant/payments?invoice=${invoice.id}&action=pay`);
              }
            }}
            {...(invoice.status !== 'paid'
              ? {
                  swipeRightAction: {
                    label: 'Pay Now',
                    icon: <CreditCard className="h-4 w-4 mr-2" />,
                    onClick: () => {
                      router.push(`/tenant/payments?invoice=${invoice.id}&action=pay`);
                    },
                  },
                }
              : {})}
            className="border-0 border-b rounded-none"
          >
            <MobileCard
              onClick={() => router.push(`/tenant/invoices/${invoice.id}`)}
              className="border-0"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="font-semibold text-base">Invoice {invoice.number}</div>
                    <Badge variant={getStatusBadgeVariant(invoice.status)}>{invoice.status}</Badge>
                  </div>
                  <div className="text-lg font-bold mb-1">{formatCurrency(invoice.amount)}</div>
                  <div className="text-sm text-muted-foreground">
                    Due: {new Date(invoice.dueDate).toLocaleDateString()}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/tenant/invoices/${invoice.id}`);
                  }}
                  className="flex-shrink-0"
                >
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </div>
            </MobileCard>
          </SwipeableCard>
        )}
      />
    </div>
  );
}
