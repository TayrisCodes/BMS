import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import {
  createAdHocInvoice,
  type CreateAdHocInvoiceInput,
  type InvoiceItem,
} from '@/lib/invoices/invoices';

/**
 * POST /api/invoices/ad-hoc
 * Create an ad-hoc invoice for maintenance, penalties, or other charges.
 * Requires invoices.create permission.
 */
export async function POST(request: Request) {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to create invoices
    requirePermission(context, 'invoices', 'create');

    const organizationId = context.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    const body = (await request.json()) as Partial<CreateAdHocInvoiceInput> & {
      items?: InvoiceItem[];
      issueDate?: string;
      dueDate?: string;
      periodStart?: string;
      periodEnd?: string;
    };

    // Validate required fields
    if (
      !body.invoiceType ||
      !body.tenantId ||
      !body.items ||
      body.items.length === 0 ||
      !body.dueDate
    ) {
      return NextResponse.json(
        {
          error: 'invoiceType, tenantId, items (at least one), and dueDate are required',
        },
        { status: 400 },
      );
    }

    // Validate invoice type
    const validInvoiceTypes = ['maintenance', 'penalty', 'other'];
    if (!validInvoiceTypes.includes(body.invoiceType)) {
      return NextResponse.json(
        { error: `invoiceType must be one of: ${validInvoiceTypes.join(', ')}` },
        { status: 400 },
      );
    }

    // Validate maintenance invoice has work order
    if (body.invoiceType === 'maintenance' && !body.linkedWorkOrderId) {
      return NextResponse.json(
        { error: 'linkedWorkOrderId is required for maintenance invoices' },
        { status: 400 },
      );
    }

    // Validate penalty invoice has linked invoice
    if (body.invoiceType === 'penalty' && !body.linkedInvoiceId) {
      return NextResponse.json(
        { error: 'linkedInvoiceId is required for penalty invoices' },
        { status: 400 },
      );
    }

    // Create ad-hoc invoice
    const input: CreateAdHocInvoiceInput = {
      organizationId,
      invoiceType: body.invoiceType,
      tenantId: body.tenantId,
      unitId: body.unitId ?? null,
      items: body.items,
      issueDate: body.issueDate,
      dueDate: body.dueDate,
      periodStart: body.periodStart,
      periodEnd: body.periodEnd,
      vatRate: body.vatRate ?? 15,
      notes: body.notes ?? null,
      linkedWorkOrderId: body.linkedWorkOrderId ?? null,
      linkedInvoiceId: body.linkedInvoiceId ?? null,
      leaseId: body.leaseId ?? null,
      currency: body.currency ?? 'ETB',
      exchangeRate: body.exchangeRate ?? null,
    };

    try {
      const invoice = await createAdHocInvoice(input);

      // Trigger notification for invoice creation
      try {
        const { notifyInvoiceCreated } = await import('@/modules/notifications/events');
        await notifyInvoiceCreated(invoice._id.toString(), organizationId, invoice.tenantId);
      } catch (notifError) {
        console.error(
          '[Invoices] Failed to send ad-hoc invoice creation notification:',
          notifError,
        );
        // Don't fail the request if notification fails
      }

      return NextResponse.json(
        {
          message: 'Ad-hoc invoice created successfully',
          invoice: {
            _id: invoice._id,
            leaseId: invoice.leaseId,
            tenantId: invoice.tenantId,
            unitId: invoice.unitId,
            invoiceNumber: invoice.invoiceNumber,
            issueDate: invoice.issueDate,
            dueDate: invoice.dueDate,
            periodStart: invoice.periodStart,
            periodEnd: invoice.periodEnd,
            items: invoice.items,
            subtotal: invoice.subtotal,
            tax: invoice.tax,
            total: invoice.total,
            status: invoice.status,
            paidAt: invoice.paidAt,
            notes: invoice.notes,
            invoiceType: invoice.invoiceType,
            linkedWorkOrderId: invoice.linkedWorkOrderId,
            linkedInvoiceId: invoice.linkedInvoiceId,
            currency: invoice.currency,
            exchangeRate: invoice.exchangeRate,
            createdAt: invoice.createdAt,
            updatedAt: invoice.updatedAt,
          },
        },
        { status: 201 },
      );
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return NextResponse.json({ error: error.message }, { status: 404 });
        }
        if (error.message.includes('does not belong to the same organization')) {
          return NextResponse.json({ error: error.message }, { status: 403 });
        }
        if (error.message.includes('must have an active lease')) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
        if (error.message.includes('must have at least one item')) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
        if (error.message.includes('Invalid') || error.message.includes('must be')) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
      }
      throw error;
    }
  } catch (error) {
    console.error('Create ad-hoc invoice error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
    }
    return NextResponse.json(
      { error: 'Unexpected error while creating ad-hoc invoice' },
      { status: 500 },
    );
  }
}

