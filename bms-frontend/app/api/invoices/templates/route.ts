import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import {
  createInvoiceTemplate,
  listInvoiceTemplates,
  type CreateInvoiceTemplateInput,
} from '@/lib/invoices/templates';
import { type InvoiceItem } from '@/lib/invoices/invoices';

/**
 * GET /api/invoices/templates
 * List invoice templates for the organization.
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

    const organizationId = context.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const defaultOnly = searchParams.get('defaultOnly') === 'true';

    const templates = await listInvoiceTemplates(organizationId, defaultOnly);

    return NextResponse.json({
      templates: templates.map((template) => ({
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
      })),
      count: templates.length,
    });
  } catch (error) {
    console.error('Get invoice templates error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
    }
    return NextResponse.json(
      { error: 'Unexpected error while fetching invoice templates' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/invoices/templates
 * Create a new invoice template.
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

    const body = (await request.json()) as Partial<CreateInvoiceTemplateInput> & {
      defaultItems?: InvoiceItem[];
    };

    // Validate required fields
    if (!body.name || !body.defaultItems || body.defaultItems.length === 0) {
      return NextResponse.json(
        {
          error: 'name and defaultItems (at least one) are required',
        },
        { status: 400 },
      );
    }

    // Create template
    const input: CreateInvoiceTemplateInput = {
      organizationId,
      name: body.name,
      description: body.description ?? null,
      defaultItems: body.defaultItems,
      defaultVATRate: body.defaultVATRate ?? 15,
      headerText: body.headerText ?? null,
      footerText: body.footerText ?? null,
      customFields: body.customFields ?? null,
      isDefault: body.isDefault ?? false,
    };

    try {
      const template = await createInvoiceTemplate(input);

      return NextResponse.json(
        {
          message: 'Invoice template created successfully',
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
        },
        { status: 201 },
      );
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('must have at least one')) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
      }
      throw error;
    }
  } catch (error) {
    console.error('Create invoice template error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
    }
    return NextResponse.json(
      { error: 'Unexpected error while creating invoice template' },
      { status: 500 },
    );
  }
}
