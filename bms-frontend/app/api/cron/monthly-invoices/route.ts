import { NextResponse } from 'next/server';
import { generateMonthlyInvoices } from '@/modules/billing/scheduled-invoice-generation';

/**
 * POST /api/cron/monthly-invoices
 * Cron job endpoint for automated monthly invoice generation.
 * This endpoint should be called by a cron service (e.g., Vercel Cron, external cron service).
 *
 * Security: Protected by CRON_SECRET environment variable.
 */
export async function POST(request: Request) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret) {
      const expectedAuth = `Bearer ${cronSecret}`;
      if (authHeader !== expectedAuth) {
        console.warn('[Cron] Unauthorized cron request - invalid secret');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    } else {
      // In development, allow without secret but log warning
      if (process.env.NODE_ENV === 'production') {
        console.warn('[Cron] CRON_SECRET not set in production');
        return NextResponse.json({ error: 'Cron secret not configured' }, { status: 500 });
      }
    }

    console.log('[Cron] Starting monthly invoice generation...');

    // Get optional parameters from request body
    const body = await request.json().catch(() => ({}));
    const {
      organizationId,
      periodStart,
      periodEnd,
      autoSend = true,
      forceRegenerate = false,
    } = body as {
      organizationId?: string;
      periodStart?: string;
      periodEnd?: string;
      autoSend?: boolean;
      forceRegenerate?: boolean;
    };

    // Generate invoices for all organizations (or specific one if provided)
    const results = await generateMonthlyInvoices({
      organizationId,
      periodStart: periodStart ? new Date(periodStart) : undefined,
      periodEnd: periodEnd ? new Date(periodEnd) : undefined,
      autoSend,
      forceRegenerate,
    });

    // Calculate totals across all organizations
    const totalInvoices = results.reduce((sum, r) => sum + r.summary.total, 0);
    const totalSuccessful = results.reduce((sum, r) => sum + r.summary.successful, 0);
    const totalFailed = results.reduce((sum, r) => sum + r.summary.failed, 0);
    const totalSent = results.reduce((sum, r) => sum + r.sentCount, 0);
    const totalSentErrors = results.reduce((sum, r) => sum + r.sentErrors, 0);

    console.log('[Cron] Monthly invoice generation completed:', {
      organizationsProcessed: results.length,
      totalInvoices,
      totalSuccessful,
      totalFailed,
      totalSent,
      totalSentErrors,
    });

    return NextResponse.json({
      message: 'Monthly invoice generation completed',
      timestamp: new Date().toISOString(),
      summary: {
        organizationsProcessed: results.length,
        totalInvoices,
        totalSuccessful,
        totalFailed,
        totalSent,
        totalSentErrors,
      },
      results,
    });
  } catch (error) {
    console.error('[Cron] Error in monthly invoice generation:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate monthly invoices',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

/**
 * GET endpoint for health check and manual testing
 */
export async function GET(request: Request) {
  return NextResponse.json({
    message: 'Monthly invoice generation cron endpoint',
    endpoint: '/api/cron/monthly-invoices',
    method: 'POST',
    description: 'Generates monthly invoices for all active leases',
    security: 'Protected by CRON_SECRET environment variable',
  });
}

