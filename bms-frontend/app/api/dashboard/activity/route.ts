import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
import { withOrganizationScope } from '@/lib/organizations/scoping';
import { getPaymentsCollection, type Payment } from '@/lib/payments/payments';
import { getLeasesCollection, type Lease } from '@/lib/leases/leases';
import { getComplaintsCollection, type Complaint } from '@/lib/complaints/complaints';
import { findInvoiceById } from '@/lib/invoices/invoices';
import type { Document } from 'mongodb';

interface Activity {
  id: string;
  type: 'payment' | 'lease' | 'complaint';
  title: string;
  description: string;
  timestamp: Date | string;
  link: string;
}

export async function GET() {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch recent activities across different entities
    const activities: Activity[] = [];

    try {
      // Recent payments
      const paymentsCollection = await getPaymentsCollection();
      const paymentsQuery = withOrganizationScope(context, {});
      const recentPayments = await paymentsCollection
        .find(paymentsQuery as Document)
        .sort({ createdAt: -1 })
        .limit(5)
        .toArray();

      for (const payment of recentPayments) {
        const paymentDoc = payment as Payment;
        let invoiceNumber = 'N/A';

        // If payment has invoiceId, fetch invoice to get invoiceNumber
        if (paymentDoc.invoiceId) {
          try {
            const invoice = await findInvoiceById(
              paymentDoc.invoiceId,
              context.organizationId || undefined,
            );
            if (invoice) {
              invoiceNumber = invoice.invoiceNumber;
            }
          } catch (error) {
            console.error('Failed to fetch invoice for payment:', error);
            // Continue with "N/A" if invoice fetch fails
          }
        }

        activities.push({
          id: paymentDoc._id.toString(),
          type: 'payment',
          title: 'Payment Received',
          description: `Payment of ETB ${paymentDoc.amount.toLocaleString()}${invoiceNumber !== 'N/A' ? ` for invoice ${invoiceNumber}` : ''}`,
          timestamp: paymentDoc.createdAt || new Date(),
          link: `/org/payments/${paymentDoc._id}`,
        });
      }
    } catch (error) {
      console.error('Error fetching payments for activity:', error);
      // Continue with other activities even if payments fail
    }

    try {
      // Recent leases
      const leasesCollection = await getLeasesCollection();
      const leasesQuery = withOrganizationScope(context, {});
      const recentLeases = await leasesCollection
        .find(leasesQuery as Document)
        .sort({ createdAt: -1 })
        .limit(5)
        .toArray();

      for (const lease of recentLeases) {
        const leaseDoc = lease as Lease;
        activities.push({
          id: leaseDoc._id.toString(),
          type: 'lease',
          title: 'New Lease Created',
          description: `Lease for tenant ${leaseDoc.tenantId} - Unit ${leaseDoc.unitId} - ETB ${leaseDoc.rentAmount.toLocaleString()}/month`,
          timestamp: leaseDoc.createdAt || new Date(),
          link: `/org/leases/${leaseDoc._id}`,
        });
      }
    } catch (error) {
      console.error('Error fetching leases for activity:', error);
      // Continue with other activities even if leases fail
    }

    try {
      // Recent complaints
      const complaintsCollection = await getComplaintsCollection();
      const complaintsQuery = withOrganizationScope(context, {});
      const recentComplaints = await complaintsCollection
        .find(complaintsQuery as Document)
        .sort({ createdAt: -1 })
        .limit(5)
        .toArray();

      for (const complaint of recentComplaints) {
        const complaintDoc = complaint as Complaint;
        activities.push({
          id: complaintDoc._id.toString(),
          type: 'complaint',
          title: 'New Complaint',
          description: complaintDoc.title || complaintDoc.description || 'No description',
          timestamp: complaintDoc.createdAt || new Date(),
          link: `/org/complaints/${complaintDoc._id}`,
        });
      }
    } catch (error) {
      console.error('Error fetching complaints for activity:', error);
      // Continue with other activities even if complaints fail
    }

    // Sort by timestamp and limit to 20 most recent
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({
      activities: activities.slice(0, 20),
      count: activities.length,
    });
  } catch (error) {
    console.error('Dashboard activity error:', error);

    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('Organization ID is required')) {
        return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
      }
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }

    return NextResponse.json({ error: 'Failed to fetch recent activities' }, { status: 500 });
  }
}
