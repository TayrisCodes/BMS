import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { validateOrganizationAccess } from '@/lib/organizations/scoping';
import { findInvoiceById } from '@/lib/invoices/invoices';
import { sendInvoiceToTenant } from '@/modules/notifications/invoice-sender';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/invoices/[id]/send
 * Manually send an existing invoice to the tenant.
 * Requires invoices.send permission.
 */
export async function POST(request: Request, routeParams: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    const { id } = await routeParams.params;

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to send invoices
    requirePermission(context, 'invoices', 'send');

    if (!context.organizationId) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 403 });
    }

    // Get invoice to validate organization access
    const invoice = await findInvoiceById(id, context.organizationId);

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Validate organization access
    validateOrganizationAccess(context, invoice.organizationId);

    // Parse request body for optional channels
    const body = await request.json().catch(() => ({}));
    const channels = body.channels || ['in_app', 'sms'];

    // Send invoice to tenant
    const sendResult = await sendInvoiceToTenant({
      invoiceId: id,
      organizationId: context.organizationId,
      tenantId: invoice.tenantId,
      channels,
    });

    if (!sendResult.success) {
      return NextResponse.json(
        {
          message: 'Invoice send attempted but some channels failed',
          result: sendResult,
        },
        { status: 207 }, // Multi-Status
      );
    }

    return NextResponse.json({
      message: 'Invoice sent successfully',
      result: sendResult,
    });
  } catch (error) {
    console.error('Send invoice error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
      if (error.message.includes('does not have an organization ID')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('belongs to a different organization')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }
    return NextResponse.json({ error: 'Unexpected error while sending invoice' }, { status: 500 });
  }
}
