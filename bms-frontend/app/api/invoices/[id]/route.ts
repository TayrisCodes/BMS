import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { validateOrganizationAccess } from '@/lib/organizations/scoping';
import {
  findInvoiceById,
  updateInvoice,
  updateInvoiceStatus,
  cancelInvoice,
  type Invoice,
  type InvoiceStatus,
} from '@/lib/invoices/invoices';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/invoices/[id]
 * Get a single invoice by ID.
 * Requires invoices.read permission.
 */
export async function GET(request: Request, routeParams: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    const { id } = await routeParams.params;

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to read invoices
    requirePermission(context, 'invoices', 'read');

    const invoice = await findInvoiceById(id, context.organizationId || undefined);

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Validate organization access
    validateOrganizationAccess(context, invoice.organizationId);

    return NextResponse.json({
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
        organizationId: invoice.organizationId,
        createdAt: invoice.createdAt,
        updatedAt: invoice.updatedAt,
      },
    });
  } catch (error) {
    console.error('Get invoice error', error);
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
    return NextResponse.json({ error: 'Unexpected error while fetching invoice' }, { status: 500 });
  }
}

/**
 * PATCH /api/invoices/[id]
 * Update an invoice.
 * Requires invoices.update permission.
 * Only draft invoices can be modified, or status updates can be made.
 */
export async function PATCH(request: Request, routeParams: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    const { id } = await routeParams.params;

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to update invoices
    requirePermission(context, 'invoices', 'update');

    // Get existing invoice to validate organization access
    const existingInvoice = await findInvoiceById(id, context.organizationId || undefined);

    if (!existingInvoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Validate organization access
    validateOrganizationAccess(context, existingInvoice.organizationId);

    const body = (await request.json()) as Partial<Invoice> & {
      status?: InvoiceStatus;
      paidAt?: Date | string;
    };

    // If only status is being updated, use updateInvoiceStatus
    if (
      body.status &&
      Object.keys(body).filter((k) => k !== 'status' && k !== 'paidAt' && k !== 'notes').length ===
        0
    ) {
      try {
        const paidAt = body.paidAt
          ? typeof body.paidAt === 'string'
            ? new Date(body.paidAt)
            : body.paidAt
          : undefined;

        const updatedInvoice = await updateInvoiceStatus(id, body.status, paidAt);

        if (!updatedInvoice) {
          return NextResponse.json({ error: 'Failed to update invoice status' }, { status: 500 });
        }

        return NextResponse.json({
          message: 'Invoice status updated successfully',
          invoice: {
            _id: updatedInvoice._id,
            leaseId: updatedInvoice.leaseId,
            tenantId: updatedInvoice.tenantId,
            unitId: updatedInvoice.unitId,
            invoiceNumber: updatedInvoice.invoiceNumber,
            issueDate: updatedInvoice.issueDate,
            dueDate: updatedInvoice.dueDate,
            periodStart: updatedInvoice.periodStart,
            periodEnd: updatedInvoice.periodEnd,
            items: updatedInvoice.items,
            subtotal: updatedInvoice.subtotal,
            tax: updatedInvoice.tax,
            total: updatedInvoice.total,
            status: updatedInvoice.status,
            paidAt: updatedInvoice.paidAt,
            notes: updatedInvoice.notes,
            organizationId: updatedInvoice.organizationId,
            createdAt: updatedInvoice.createdAt,
            updatedAt: updatedInvoice.updatedAt,
          },
        });
      } catch (error) {
        if (error instanceof Error) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
        throw error;
      }
    }

    // Otherwise, use updateInvoice (for draft invoices)
    const updates: Partial<Invoice> = {
      ...body,
    };
    delete updates._id;
    delete updates.organizationId;
    delete updates.createdAt;

    try {
      const updatedInvoice = await updateInvoice(id, updates);

      if (!updatedInvoice) {
        return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 });
      }

      return NextResponse.json({
        message: 'Invoice updated successfully',
        invoice: {
          _id: updatedInvoice._id,
          leaseId: updatedInvoice.leaseId,
          tenantId: updatedInvoice.tenantId,
          unitId: updatedInvoice.unitId,
          invoiceNumber: updatedInvoice.invoiceNumber,
          issueDate: updatedInvoice.issueDate,
          dueDate: updatedInvoice.dueDate,
          periodStart: updatedInvoice.periodStart,
          periodEnd: updatedInvoice.periodEnd,
          items: updatedInvoice.items,
          subtotal: updatedInvoice.subtotal,
          tax: updatedInvoice.tax,
          total: updatedInvoice.total,
          status: updatedInvoice.status,
          paidAt: updatedInvoice.paidAt,
          notes: updatedInvoice.notes,
          organizationId: updatedInvoice.organizationId,
          createdAt: updatedInvoice.createdAt,
          updatedAt: updatedInvoice.updatedAt,
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Only draft invoices can be modified')) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
        if (error.message.includes('Invalid') || error.message.includes('must be')) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
      }
      throw error;
    }
  } catch (error) {
    console.error('Update invoice error', error);
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
    return NextResponse.json({ error: 'Unexpected error while updating invoice' }, { status: 500 });
  }
}

/**
 * DELETE /api/invoices/[id]
 * Cancel an invoice (sets status to cancelled, only if not paid).
 * Requires invoices.delete permission.
 */
export async function DELETE(request: Request, routeParams: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    const { id } = await routeParams.params;

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to delete/cancel invoices
    requirePermission(context, 'invoices', 'delete');

    // Get existing invoice to validate organization access
    const existingInvoice = await findInvoiceById(id, context.organizationId || undefined);

    if (!existingInvoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Validate organization access
    validateOrganizationAccess(context, existingInvoice.organizationId);

    try {
      const cancelledInvoice = await cancelInvoice(id);

      if (!cancelledInvoice) {
        return NextResponse.json({ error: 'Failed to cancel invoice' }, { status: 500 });
      }

      return NextResponse.json({
        message: 'Invoice cancelled successfully',
        invoice: {
          _id: cancelledInvoice._id,
          status: cancelledInvoice.status,
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Cannot cancel a paid invoice')) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
      }
      throw error;
    }
  } catch (error) {
    console.error('Cancel invoice error', error);
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
    return NextResponse.json(
      { error: 'Unexpected error while cancelling invoice' },
      { status: 500 },
    );
  }
}
