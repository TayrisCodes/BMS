import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { generateMonthlyInvoices } from '@/modules/billing/scheduled-invoice-generation';

/**
 * POST /api/admin/billing/generate-monthly
 * Manual trigger for monthly invoice generation.
 * Requires ORG_ADMIN or ACCOUNTANT permission.
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

    const body = (await request.json().catch(() => ({}))) as {
      periodStart?: string;
      periodEnd?: string;
      autoSend?: boolean;
      forceRegenerate?: boolean;
    };

    // Generate invoices for the current organization
    const results = await generateMonthlyInvoices({
      organizationId,
      periodStart: body.periodStart ? new Date(body.periodStart) : undefined,
      periodEnd: body.periodEnd ? new Date(body.periodEnd) : undefined,
      autoSend: body.autoSend ?? true,
      forceRegenerate: body.forceRegenerate ?? false,
    });

    if (results.length === 0) {
      return NextResponse.json({ error: 'No results generated' }, { status: 500 });
    }

    const result = results[0]; // Should only be one result for single organization
    if (!result) {
      return NextResponse.json({ error: 'No results generated' }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Monthly invoice generation completed',
      result,
      summary: result.summary,
    });
  } catch (error) {
    console.error('Generate monthly invoices error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
    }
    return NextResponse.json(
      { error: 'Unexpected error while generating monthly invoices' },
      { status: 500 },
    );
  }
}
