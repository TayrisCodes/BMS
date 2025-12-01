import { NextResponse } from 'next/server';
import { getAuthContextFromCookies, getCurrentUserFromCookies } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
import { findTenantByPhone } from '@/lib/tenants/tenants';
import { findInvoicesByTenant } from '@/lib/invoices/invoices';
import { findPaymentsByTenant } from '@/lib/payments/payments';
import { findComplaintsByTenant } from '@/lib/complaints/complaints';

export async function GET() {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user is a tenant
    if (!context.roles.includes('TENANT')) {
      return NextResponse.json({ error: 'Forbidden: Tenant access required' }, { status: 403 });
    }

    // Get user to find tenant by phone
    const user = await getCurrentUserFromCookies();
    if (!user || !user.phone) {
      return NextResponse.json(
        { error: 'User not found or phone number missing' },
        { status: 404 },
      );
    }

    // Validate organization context
    const organizationId = context.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    // Find tenant by phone (tenants are linked to users via phone)
    const tenant = await findTenantByPhone(user.phone, organizationId);

    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found. Please contact your building manager.' },
        { status: 404 },
      );
    }

    // Validate tenant belongs to the same organization
    if (tenant.organizationId !== organizationId) {
      return NextResponse.json(
        { error: 'Access denied: Tenant does not belong to your organization' },
        { status: 403 },
      );
    }

    const tenantId = tenant._id.toString();

    try {
      // Get all unpaid invoices for the tenant
      const allInvoices = await findInvoicesByTenant(tenantId, organizationId);
      const unpaidInvoices = allInvoices.filter(
        (inv) => inv.status !== 'paid' && inv.status !== 'cancelled',
      );

      // Calculate current balance (sum of unpaid invoice totals)
      const balance = unpaidInvoices.reduce((sum, inv) => sum + inv.total, 0);

      // Get next invoice (upcoming unpaid invoice, sorted by due date)
      const sortedUnpaidInvoices = unpaidInvoices.sort(
        (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
      );

      let nextInvoice = undefined;
      const nextInvoiceDoc = sortedUnpaidInvoices[0];
      if (nextInvoiceDoc) {
        const daysUntilDue = Math.ceil(
          (new Date(nextInvoiceDoc.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        );

        nextInvoice = {
          id: nextInvoiceDoc._id.toString(),
          number: nextInvoiceDoc.invoiceNumber,
          amount: nextInvoiceDoc.total,
          dueDate: nextInvoiceDoc.dueDate.toISOString(),
          daysUntilDue: Math.max(0, daysUntilDue),
        };
      }

      // Calculate total paid this month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const allPayments = await findPaymentsByTenant(tenantId, organizationId);
      const paymentsThisMonth = allPayments.filter((payment) => {
        if (payment.status !== 'completed') {
          return false;
        }
        const paymentDate =
          payment.paymentDate instanceof Date ? payment.paymentDate : new Date(payment.paymentDate);
        return paymentDate >= startOfMonth;
      });

      const totalPaidThisMonth = paymentsThisMonth.reduce(
        (sum, payment) => sum + payment.amount,
        0,
      );

      // Count invoices
      const invoicesCount = allInvoices.length;

      // Count complaints
      const allComplaints = await findComplaintsByTenant(tenantId, organizationId);
      const complaintsCount = allComplaints.length;

      // Get recent invoices (last 5, sorted by creation date)
      const recentInvoices = allInvoices
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5)
        .map((inv) => ({
          id: inv._id.toString(),
          number: inv.invoiceNumber,
          amount: inv.total,
          dueDate: inv.dueDate.toISOString(),
          status: inv.status,
        }));

      return NextResponse.json({
        balance,
        nextInvoice,
        totalPaidThisMonth,
        invoicesCount,
        complaintsCount,
        recentInvoices,
      });
    } catch (error) {
      console.error('Error fetching tenant dashboard data:', error);
      if (error instanceof Error) {
        if (error.message.includes('Organization ID is required')) {
          return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
        }
      }
      throw error;
    }
  } catch (error) {
    console.error('Tenant dashboard error:', error);

    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('Organization ID is required')) {
        return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
      }
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }

    return NextResponse.json(
      { error: 'Failed to fetch dashboard data. Please try again later.' },
      { status: 500 },
    );
  }
}
