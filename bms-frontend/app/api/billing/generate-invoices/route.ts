import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import {
  generateInvoicesForLeases,
  type GenerateInvoicesOptions,
} from '@/modules/billing/invoice-generation';

/**
 * POST /api/billing/generate-invoices
 * Generate invoices for all active leases in an organization for a given period.
 * Requires ORG_ADMIN or ACCOUNTANT permission.
 */
export async function POST(request: Request) {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to create invoices (ORG_ADMIN or ACCOUNTANT)
    requirePermission(context, 'invoices', 'create');

    const organizationId = context.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    const body = (await request.json()) as Partial<GenerateInvoicesOptions> & {
      periodStart?: string;
      periodEnd?: string;
      forceRegenerate?: boolean;
    };

    // Default period: current month if not provided
    let periodStart: Date;
    let periodEnd: Date;

    if (body.periodStart && body.periodEnd) {
      periodStart = new Date(body.periodStart);
      periodEnd = new Date(body.periodEnd);
    } else {
      // Default to current month
      const now = new Date();
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    // Validate dates
    if (isNaN(periodStart.getTime()) || isNaN(periodEnd.getTime())) {
      return NextResponse.json({ error: 'Invalid period dates' }, { status: 400 });
    }

    if (periodEnd <= periodStart) {
      return NextResponse.json(
        { error: 'Period end date must be after period start date' },
        { status: 400 },
      );
    }

    try {
      const results = await generateInvoicesForLeases({
        organizationId,
        periodStart,
        periodEnd,
        forceRegenerate: body.forceRegenerate ?? false,
      });

      const successCount = results.filter((r) => r.success).length;
      const errorCount = results.filter((r) => !r.success).length;

      return NextResponse.json({
        message: `Invoice generation completed: ${successCount} created, ${errorCount} skipped/failed`,
        results,
        summary: {
          total: results.length,
          successful: successCount,
          failed: errorCount,
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        if (
          error.message.includes('Invalid period dates') ||
          error.message.includes('must be after')
        ) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
      }
      throw error;
    }
  } catch (error) {
    console.error('Generate invoices error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
    }
    return NextResponse.json(
      { error: 'Unexpected error while generating invoices' },
      { status: 500 },
    );
  }
}

