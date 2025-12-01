'use client';

import { useState, useEffect } from 'react';

interface Invoice {
  id: string;
  number: string;
  tenantId: string;
  tenantName?: string;
  amount: number;
  dueDate: string;
  status: string;
  createdAt: string;
}

interface UseOverdueInvoicesReturn {
  invoices: Invoice[];
  loading: boolean;
  error: string | null;
}

export function useOverdueInvoices(): UseOverdueInvoicesReturn {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchInvoices() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch('/api/invoices?status=overdue');
        if (!response.ok) {
          throw new Error('Failed to fetch overdue invoices');
        }
        const result = await response.json();
        setInvoices(result.invoices || result || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        setInvoices([]);
      } finally {
        setLoading(false);
      }
    }

    fetchInvoices();
  }, []);

  return {
    invoices,
    loading,
    error,
  };
}

