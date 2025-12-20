import React from 'react';
import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { findPaymentById } from '@/lib/payments/payments';
import { findInvoiceById } from '@/lib/invoices/invoices';
import { findOrganizationById } from '@/lib/organizations/organizations';
import { PaymentReceiptPdf } from '@/lib/pdf/PaymentReceiptPdf';
import { pdf } from '@react-pdf/renderer';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/payments/[id]/receipt
 * Generate and download a PDF receipt for a payment.
 * Accessible by tenant (for their own payments) or organization staff.
 */
export async function GET(request: Request, routeParams: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    const { id } = await routeParams.params;

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const organizationId = context.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    // Get payment
    const payment = await findPaymentById(id, organizationId);
    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    // Check access: tenant can only access their own payments
    if (context.roles.includes('TENANT')) {
      const { findTenantByPhone } = await import('@/lib/tenants/tenants');
      const { getCurrentUserFromCookies } = await import('@/lib/auth/session');
      const user = await getCurrentUserFromCookies();
      if (!user || !user.phone) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      const tenant = await findTenantByPhone(user.phone, organizationId);
      if (!tenant || tenant._id.toString() !== payment.tenantId) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // Get invoice if linked
    let invoice = null;
    if (payment.invoiceId) {
      invoice = await findInvoiceById(payment.invoiceId, organizationId);
    }

    // Get organization details
    const organization = await findOrganizationById(organizationId);

    // Generate PDF
    const doc = await pdf(
      <PaymentReceiptPdf payment={payment} invoice={invoice} organization={organization} />,
    ).toBuffer();

    // Return PDF as response
    return new Response(doc, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="receipt-${payment._id.slice(-8)}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Generate payment receipt error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Not authenticated')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
    }
    return NextResponse.json(
      { error: 'Unexpected error while generating receipt' },
      { status: 500 },
    );
  }
}
