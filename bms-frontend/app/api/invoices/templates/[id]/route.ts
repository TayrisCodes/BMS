import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import {
  findInvoiceTemplateById,
  updateInvoiceTemplate,
  deleteInvoiceTemplate,
  type UpdateInvoiceTemplateInput,
  type InvoiceItem,
} from '@/lib/invoices/templates';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/invoices/templates/[id]
 * Get a single invoice template by ID.
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

    const organizationId = context.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    const template = await findInvoiceTemplateById(id, organizationId);

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({
      template: {
        _id: template._id,
        organizationId: template.organizationId,
        name: template.name,
        description: template.description,
        defaultItems: template.defaultItems,
        defaultVATRate: template.defaultVATRate,
        headerText: template.headerText,
        footerText: template.footerText,
        customFields: template.customFields,
        isDefault: template.isDefault,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
      },
    });
  } catch (error) {
    console.error('Get invoice template error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
    }
    return NextResponse.json(
      { error: 'Unexpected error while fetching invoice template' },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/invoices/templates/[id]
 * Update an invoice template.
 * Requires invoices.update permission.
 */
export async function PUT(request: Request, routeParams: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    const { id } = await routeParams.params;

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to update invoices
    requirePermission(context, 'invoices', 'update');

    const organizationId = context.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    const body = (await request.json()) as Partial<UpdateInvoiceTemplateInput> & {
      defaultItems?: InvoiceItem[];
    };

    const input: UpdateInvoiceTemplateInput = {
      name: body.name,
      description: body.description,
      defaultItems: body.defaultItems,
      defaultVATRate: body.defaultVATRate,
      headerText: body.headerText,
      footerText: body.footerText,
      customFields: body.customFields,
      isDefault: body.isDefault,
    };

    try {
      const updatedTemplate = await updateInvoiceTemplate(id, input, organizationId);

      if (!updatedTemplate) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 });
      }

      return NextResponse.json({
        message: 'Invoice template updated successfully',
        template: {
          _id: updatedTemplate._id,
          organizationId: updatedTemplate.organizationId,
          name: updatedTemplate.name,
          description: updatedTemplate.description,
          defaultItems: updatedTemplate.defaultItems,
          defaultVATRate: updatedTemplate.defaultVATRate,
          headerText: updatedTemplate.headerText,
          footerText: updatedTemplate.footerText,
          customFields: updatedTemplate.customFields,
          isDefault: updatedTemplate.isDefault,
          createdAt: updatedTemplate.createdAt,
          updatedAt: updatedTemplate.updatedAt,
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('must have at least one')) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
      }
      throw error;
    }
  } catch (error) {
    console.error('Update invoice template error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
    }
    return NextResponse.json(
      { error: 'Unexpected error while updating invoice template' },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/invoices/templates/[id]
 * Delete an invoice template.
 * Requires invoices.delete permission.
 */
export async function DELETE(request: Request, routeParams: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    const { id } = await routeParams.params;

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to delete invoices
    requirePermission(context, 'invoices', 'delete');

    const organizationId = context.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    try {
      const deleted = await deleteInvoiceTemplate(id, organizationId);

      if (!deleted) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 });
      }

      return NextResponse.json({
        message: 'Invoice template deleted successfully',
      });
    } catch (error) {
      throw error;
    }
  } catch (error) {
    console.error('Delete invoice template error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
    }
    return NextResponse.json(
      { error: 'Unexpected error while deleting invoice template' },
      { status: 500 },
    );
  }
}

