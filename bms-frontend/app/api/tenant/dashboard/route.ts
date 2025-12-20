import { NextResponse } from 'next/server';
import { getAuthContextFromCookies, getCurrentUserFromCookies } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
import { findTenantByPhone } from '@/lib/tenants/tenants';
import { findInvoicesByTenant } from '@/lib/invoices/invoices';
import { findPaymentsByTenant } from '@/lib/payments/payments';
import { findComplaintsByTenant } from '@/lib/complaints/complaints';
import { findLeasesByTenant } from '@/lib/leases/leases';

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

      // Count complaints and get maintenance requests
      const allComplaints = await findComplaintsByTenant(tenantId, organizationId);
      const complaintsCount = allComplaints.length;
      const maintenanceRequests = allComplaints.filter((c) => c.type === 'maintenance_request');
      const openMaintenanceRequests = maintenanceRequests.filter(
        (c) => c.status !== 'resolved' && c.status !== 'closed',
      );
      const urgentMaintenanceRequests = openMaintenanceRequests.filter(
        (c) => c.urgency === 'emergency' || c.urgency === 'high',
      );

      // Get lease expiration info
      const leases = await findLeasesByTenant(tenantId, organizationId);
      const activeLease = leases.find((l) => l.status === 'active');
      let leaseExpirationInfo = null;
      if (activeLease?.endDate) {
        const endDate =
          activeLease.endDate instanceof Date ? activeLease.endDate : new Date(activeLease.endDate);
        const now = new Date();
        const daysUntilExpiry = Math.ceil(
          (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        );
        const renewalNoticeDays = activeLease.renewalNoticeDays ?? 30;

        if (daysUntilExpiry > 0 && daysUntilExpiry <= renewalNoticeDays) {
          leaseExpirationInfo = {
            endDate: endDate.toISOString(),
            daysUntilExpiry,
            renewalNoticeDays,
            needsRenewal: true,
          };
        }
      }

      // Calculate overdue amount
      const overdueInvoices = unpaidInvoices.filter((inv) => {
        const dueDate = inv.dueDate instanceof Date ? inv.dueDate : new Date(inv.dueDate);
        return dueDate < new Date() && inv.status !== 'paid';
      });
      const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + inv.total, 0);

      // Calculate payment trends (last 3 months)
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      const recentPayments = allPayments.filter((payment) => {
        if (payment.status !== 'completed') return false;
        const paymentDate =
          payment.paymentDate instanceof Date ? payment.paymentDate : new Date(payment.paymentDate);
        return paymentDate >= threeMonthsAgo;
      });
      const onTimePayments = recentPayments.filter((payment) => {
        // Find associated invoice
        const invoice = allInvoices.find((inv) => {
          // Assuming payment has invoiceId or we can match by amount/date
          return inv._id.toString() === (payment as any).invoiceId;
        });
        if (!invoice) return true; // Assume on time if we can't verify
        const dueDate =
          invoice.dueDate instanceof Date ? invoice.dueDate : new Date(invoice.dueDate);
        const paymentDate =
          payment.paymentDate instanceof Date ? payment.paymentDate : new Date(payment.paymentDate);
        return paymentDate <= dueDate;
      });
      const paymentTrend = {
        totalPayments: recentPayments.length,
        onTimePayments: onTimePayments.length,
        onTimeRate: recentPayments.length > 0 ? onTimePayments.length / recentPayments.length : 1,
      };

      // Build recent activity feed
      const recentActivity: Array<{
        type: string;
        title: string;
        description: string;
        timestamp: string;
        link?: string;
      }> = [];

      // Add recent payments
      recentPayments
        .sort((a, b) => {
          const dateA = a.paymentDate instanceof Date ? a.paymentDate : new Date(a.paymentDate);
          const dateB = b.paymentDate instanceof Date ? b.paymentDate : new Date(b.paymentDate);
          return dateB.getTime() - dateA.getTime();
        })
        .slice(0, 3)
        .forEach((payment) => {
          const paymentDate =
            payment.paymentDate instanceof Date
              ? payment.paymentDate
              : new Date(payment.paymentDate);
          recentActivity.push({
            type: 'payment',
            title: 'Payment Received',
            description: `ETB ${payment.amount.toLocaleString()} payment received`,
            timestamp: paymentDate.toISOString(),
            link: '/tenant/payments',
          });
        });

      // Add recent invoices
      allInvoices
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 3)
        .forEach((invoice) => {
          recentActivity.push({
            type: 'invoice',
            title: 'New Invoice',
            description: `Invoice ${invoice.invoiceNumber} for ETB ${invoice.total.toLocaleString()}`,
            timestamp: invoice.createdAt.toISOString(),
            link: `/tenant/invoices/${invoice._id}`,
          });
        });

      // Add complaint updates
      allComplaints
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 3)
        .forEach((complaint) => {
          recentActivity.push({
            type: 'complaint',
            title: `Complaint ${complaint.status === 'resolved' ? 'Resolved' : 'Updated'}`,
            description: complaint.title,
            timestamp: complaint.updatedAt.toISOString(),
            link: `/tenant/complaints/${complaint._id}`,
          });
        });

      // Sort activity by timestamp and take most recent 10
      recentActivity.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );
      const recentActivityFeed = recentActivity.slice(0, 10);

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
        overdueAmount,
        nextInvoice,
        totalPaidThisMonth,
        invoicesCount,
        complaintsCount,
        recentInvoices,
        // New fields
        maintenanceRequestsSummary: {
          total: maintenanceRequests.length,
          open: openMaintenanceRequests.length,
          urgent: urgentMaintenanceRequests.length,
          recentUpdates: openMaintenanceRequests
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
            .slice(0, 3)
            .map((c) => ({
              id: c._id.toString(),
              title: c.title,
              status: c.status,
              urgency: c.urgency || null,
              updatedAt: c.updatedAt.toISOString(),
            })),
        },
        leaseExpirationInfo,
        recentActivity: recentActivityFeed,
        paymentTrend,
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
