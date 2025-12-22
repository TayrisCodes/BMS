import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { generateERCAExport, type ERCAExportType } from '@/modules/reports/erca-export';

/**
 * GET /api/reports/erca
 * Generate ERCA-compliant report data.
 * Requires reports.read permission.
 */
export async function GET(request: Request) {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to read reports
    requirePermission(context, 'reporting', 'read');

    const organizationId = context.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const typeParam = searchParams.get('type') as ERCAExportType | null;
    const periodTypeParam = searchParams.get('periodType') as 'monthly' | 'quarterly' | null;

    if (!startDateParam || !endDateParam) {
      return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 });
    }

    const startDate = new Date(startDateParam);
    const endDate = new Date(endDateParam);
    const type = typeParam || 'summary';
    const periodType = periodTypeParam || 'monthly';

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }

    const data = await generateERCAExport(organizationId, startDate, endDate, type, periodType);

    return NextResponse.json({
      report: {
        organizationName: data.organizationName,
        organizationTIN: data.organizationTIN,
        periodStart: data.periodStart.toISOString(),
        periodEnd: data.periodEnd.toISOString(),
        invoices: data.invoices || [],
        payments: data.payments || [],
        summary: data.summary || [],
      },
    });
  } catch (error) {
    console.error('Generate ERCA report error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
    }
    return NextResponse.json(
      { error: 'Unexpected error while generating ERCA report' },
      { status: 500 },
    );
  }
}
