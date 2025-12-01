import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { withOrganizationScope } from '@/lib/organizations/scoping';
import {
  createInvoice,
  listInvoices,
  findInvoicesByTenant,
  findInvoicesByLease,
  findOverdueInvoices,
  type CreateInvoiceInput,
  type InvoiceStatus,
  type InvoiceItem,
} from '@/lib/invoices/invoices';
import { findBuildingById } from '@/lib/buildings/buildings';
import { generateInvoiceForLease } from '@/modules/billing/invoice-generation';

/**
 * GET /api/invoices
 * List invoices with optional filters.
 * Requires invoices.read permission.
 */
export async function GET(request: Request) {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to read invoices
    requirePermission(context, 'invoices', 'read');

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const leaseId = searchParams.get('leaseId');
    const unitId = searchParams.get('unitId');
    const buildingId = searchParams.get('buildingId');
    const status = searchParams.get('status') as InvoiceStatus | null;
    const dueDateFrom = searchParams.get('dueDateFrom');
    const dueDateTo = searchParams.get('dueDateTo');
    const overdue = searchParams.get('overdue') === 'true';

    let invoices;

    // If overdue is requested, use findOverdueInvoices
    if (overdue && context.organizationId) {
      invoices = await findOverdueInvoices(
        context.organizationId,
        dueDateFrom ? new Date(dueDateFrom) : undefined,
      );
    }
    // If tenantId is specified, use findInvoicesByTenant
    else if (tenantId) {
      const filters: Record<string, unknown> = {};
      if (status) {
        filters.status = status;
      }
      if (dueDateFrom) {
        filters.dueDate = { $gte: new Date(dueDateFrom) };
      }
      if (dueDateTo) {
        filters.dueDate = {
          ...((filters.dueDate as Record<string, unknown>) || {}),
          $lte: new Date(dueDateTo),
        };
      }
      invoices = await findInvoicesByTenant(tenantId, context.organizationId || undefined, filters);
    }
    // If leaseId is specified, use findInvoicesByLease
    else if (leaseId) {
      invoices = await findInvoicesByLease(leaseId, context.organizationId || undefined);
      // Apply additional filters
      if (status) {
        invoices = invoices.filter((inv) => inv.status === status);
      }
    }
    // Otherwise, list all invoices with organization scope
    else {
      const baseQuery: Record<string, unknown> = withOrganizationScope(context, {});

      // Add filters
      if (status) {
        baseQuery.status = status;
      }

      if (unitId) {
        baseQuery.unitId = unitId;
      }

      if (dueDateFrom || dueDateTo) {
        const dueDateFilter: Record<string, unknown> = {};
        if (dueDateFrom) {
          dueDateFilter.$gte = new Date(dueDateFrom);
        }
        if (dueDateTo) {
          dueDateFilter.$lte = new Date(dueDateTo);
        }
        baseQuery.dueDate = dueDateFilter;
      }

      // If buildingId is specified, we need to find units in that building first
      if (buildingId) {
        // Validate building belongs to same org
        const building = await findBuildingById(buildingId, context.organizationId || undefined);
        if (building && building.organizationId === context.organizationId) {
          // Get all units in this building
          const { findUnitsByBuilding } = await import('@/lib/units/units');
          const units = await findUnitsByBuilding(buildingId);
          const unitIds = units.map((u) => u._id);
          baseQuery.unitId = { $in: unitIds };
        } else {
          baseQuery.unitId = { $in: [] }; // Empty result
        }
      }

      invoices = await listInvoices(baseQuery);
    }

    return NextResponse.json({
      invoices: invoices.map((inv) => ({
        _id: inv._id,
        leaseId: inv.leaseId,
        tenantId: inv.tenantId,
        unitId: inv.unitId,
        invoiceNumber: inv.invoiceNumber,
        issueDate: inv.issueDate,
        dueDate: inv.dueDate,
        periodStart: inv.periodStart,
        periodEnd: inv.periodEnd,
        items: inv.items,
        subtotal: inv.subtotal,
        tax: inv.tax,
        total: inv.total,
        status: inv.status,
        paidAt: inv.paidAt,
        notes: inv.notes,
        createdAt: inv.createdAt,
        updatedAt: inv.updatedAt,
      })),
      count: invoices.length,
    });
  } catch (error) {
    console.error('Get invoices error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
      if (error.message.includes('Organization ID is required')) {
        return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
      }
    }
    return NextResponse.json(
      { error: 'Unexpected error while fetching invoices' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/invoices
 * Create a new invoice.
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

    const body = (await request.json()) as Partial<CreateInvoiceInput> & {
      leaseId?: string;
      periodStart?: string | Date;
      periodEnd?: string | Date;
      items?: InvoiceItem[];
    };

    // If leaseId is provided and items are not provided, use invoice generation logic
    if (body.leaseId && (!body.items || body.items.length === 0)) {
      try {
        // Generate invoice using invoice generation service
        const invoice = await generateInvoiceForLease(
          body.leaseId,
          organizationId,
          body.periodStart,
          body.periodEnd,
          body.items, // Custom items if provided
        );

        // Apply any overrides (status, notes, etc.)
        if (body.status || body.notes) {
          const { updateInvoice } = await import('@/lib/invoices/invoices');
          const updates: Partial<typeof invoice> = {};
          if (body.status) {
            updates.status = body.status;
          }
          if (body.notes !== undefined) {
            updates.notes = body.notes;
          }
          const updatedInvoice = await updateInvoice(invoice._id, updates);
          if (updatedInvoice) {
            return NextResponse.json(
              {
                message: 'Invoice generated successfully',
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
                  createdAt: updatedInvoice.createdAt,
                  updatedAt: updatedInvoice.updatedAt,
                },
              },
              { status: 201 },
            );
          }
        }

        // Trigger notification for invoice creation
        try {
          const { notifyInvoiceCreated } = await import('@/modules/notifications/events');
          await notifyInvoiceCreated(invoice._id.toString(), organizationId, invoice.tenantId);
        } catch (notifError) {
          console.error('[Invoices] Failed to send invoice creation notification:', notifError);
          // Don't fail the request if notification fails
        }

        return NextResponse.json(
          {
            message: 'Invoice generated successfully',
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
              createdAt: invoice.createdAt,
              updatedAt: invoice.updatedAt,
            },
          },
          { status: 201 },
        );
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('Lease not found')) {
            return NextResponse.json({ error: error.message }, { status: 404 });
          }
          if (error.message.includes('does not belong to the same organization')) {
            return NextResponse.json({ error: error.message }, { status: 403 });
          }
          if (error.message.includes('not active')) {
            return NextResponse.json({ error: error.message }, { status: 400 });
          }
          if (error.message.includes('already exists')) {
            return NextResponse.json({ error: error.message }, { status: 409 });
          }
          if (error.message.includes('Invalid') || error.message.includes('must be')) {
            return NextResponse.json({ error: error.message }, { status: 400 });
          }
        }
        throw error;
      }
    }

    // Otherwise, use manual invoice creation (existing logic)
    // Validate required fields
    if (
      !body.leaseId ||
      !body.tenantId ||
      !body.unitId ||
      !body.issueDate ||
      !body.dueDate ||
      !body.periodStart ||
      !body.periodEnd ||
      !body.items ||
      body.items.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            'leaseId, tenantId, unitId, issueDate, dueDate, periodStart, periodEnd, and items are required (or use leaseId with optional periodStart/periodEnd for auto-generation)',
        },
        { status: 400 },
      );
    }

    // Create invoice
    const input: CreateInvoiceInput = {
      organizationId,
      leaseId: body.leaseId,
      tenantId: body.tenantId,
      unitId: body.unitId,
      ...(body.invoiceNumber && { invoiceNumber: body.invoiceNumber }),
      issueDate: body.issueDate,
      dueDate: body.dueDate,
      periodStart: body.periodStart,
      periodEnd: body.periodEnd,
      items: body.items,
      tax: body.tax ?? null,
      status: body.status ?? 'draft',
      notes: body.notes ?? null,
    };

    try {
      const invoice = await createInvoice(input);

      // Trigger notification for invoice creation
      try {
        const { notifyInvoiceCreated } = await import('@/modules/notifications/events');
        await notifyInvoiceCreated(invoice._id.toString(), organizationId, invoice.tenantId);
      } catch (notifError) {
        console.error('[Invoices] Failed to send invoice creation notification:', notifError);
        // Don't fail the request if notification fails
      }

      return NextResponse.json(
        {
          message: 'Invoice created successfully',
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
            createdAt: invoice.createdAt,
            updatedAt: invoice.updatedAt,
          },
        },
        { status: 201 },
      );
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Lease not found')) {
          return NextResponse.json({ error: error.message }, { status: 404 });
        }
        if (error.message.includes('does not belong to the same organization')) {
          return NextResponse.json({ error: error.message }, { status: 403 });
        }
        if (error.message.includes('does not match')) {
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
    console.error('Create invoice error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
    }
    return NextResponse.json({ error: 'Unexpected error while creating invoice' }, { status: 500 });
  }
}
