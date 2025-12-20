import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { generateAgingReport } from '@/modules/reports/aging-report';

/**
 * GET /api/reports/aging
 * Generate an aging report for receivables.
 * Requires reports.read permission.
 */
export async function GET(request: Request) {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to read reports
    requirePermission(context, 'reports', 'read');

    const organizationId = context.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const asOfDateParam = searchParams.get('asOf');
    const buildingId = searchParams.get('buildingId');
    const tenantId = searchParams.get('tenantId');

    const asOfDate = asOfDateParam ? new Date(asOfDateParam) : undefined;

    const report = await generateAgingReport(organizationId, asOfDate, {
      buildingId: buildingId || null,
      tenantId: tenantId || null,
    });

    return NextResponse.json({
      report: {
        asOfDate: report.asOfDate.toISOString(),
        organizationId: report.organizationId,
        buildingId: report.buildingId,
        tenantId: report.tenantId,
        buckets: report.buckets.map((bucket) => ({
          ...bucket,
          invoices: bucket.invoices.map((inv) => ({
            ...inv,
            dueDate: inv.dueDate.toISOString(),
          })),
        })),
        totalReceivables: report.totalReceivables,
        totalInvoiceCount: report.totalInvoiceCount,
      },
    });
  } catch (error) {
    console.error('Generate aging report error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
    }
    return NextResponse.json(
      { error: 'Unexpected error while generating aging report' },
      { status: 500 },
    );
  }
}

