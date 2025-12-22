import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { generateRevenueForecast, type PeriodType } from '@/modules/reports/revenue-forecast';

/**
 * GET /api/reports/revenue-trends
 * Generate revenue trends and forecast.
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
    const buildingId = searchParams.get('buildingId');
    const periodParam = searchParams.get('period') as PeriodType | null;
    const forecastMonthsParam = searchParams.get('forecastMonths');

    // Default to last 12 months if not specified
    const endDate = endDateParam ? new Date(endDateParam) : new Date();
    const startDate = startDateParam
      ? new Date(startDateParam)
      : new Date(new Date().setFullYear(endDate.getFullYear() - 1));

    const periodType = periodParam || 'monthly';
    const forecastMonths = forecastMonthsParam ? parseInt(forecastMonthsParam, 10) : 3;

    const forecast = await generateRevenueForecast(
      organizationId,
      startDate,
      endDate,
      periodType,
      forecastMonths,
      {
        buildingId: buildingId || null,
      },
    );

    return NextResponse.json({
      forecast: {
        organizationId: forecast.organizationId,
        buildingId: forecast.buildingId,
        trend: {
          ...forecast.trend,
          historical: forecast.trend.historical.map((p) => ({
            ...p,
            date: p.date.toISOString(),
          })),
          forecast: forecast.trend.forecast.map((p) => ({
            ...p,
            date: p.date.toISOString(),
          })),
          startDate: forecast.trend.startDate.toISOString(),
          endDate: forecast.trend.endDate.toISOString(),
        },
        totalHistoricalRevenue: forecast.totalHistoricalRevenue,
        averageMonthlyRevenue: forecast.averageMonthlyRevenue,
        projectedRevenue: forecast.projectedRevenue,
        growthRate: forecast.growthRate,
      },
    });
  } catch (error) {
    console.error('Generate revenue forecast error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
    }
    return NextResponse.json(
      { error: 'Unexpected error while generating revenue forecast' },
      { status: 500 },
    );
  }
}
