import { listInvoices, findInvoicesByLease } from '@/lib/invoices/invoices';
import { findLeasesByTenant, findActiveLeases } from '@/lib/leases/leases';
import type { Payment } from '@/lib/payments/payments';
import { getPaymentsCollection } from '@/lib/payments/payments';

/**
 * Revenue forecast module for calculating trends and forecasting future revenue.
 */

export type PeriodType = 'monthly' | 'quarterly' | 'yearly';

export interface RevenueDataPoint {
  period: string; // e.g., "2024-01", "2024-Q1", "2024"
  date: Date;
  revenue: number;
  invoiceCount: number;
  paymentCount: number;
}

export interface RevenueTrend {
  historical: RevenueDataPoint[];
  forecast: RevenueDataPoint[];
  periodType: PeriodType;
  startDate: Date;
  endDate: Date;
  forecastMonths: number;
}

export interface RevenueForecast {
  organizationId: string;
  buildingId?: string | null;
  trend: RevenueTrend;
  totalHistoricalRevenue: number;
  averageMonthlyRevenue: number;
  projectedRevenue: number; // Projected for next period
  growthRate?: number; // Percentage growth rate
}

/**
 * Formats a date into a period string based on period type.
 */
function formatPeriod(date: Date, periodType: PeriodType): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const quarter = Math.floor((month - 1) / 3) + 1;

  switch (periodType) {
    case 'monthly':
      return `${year}-${month.toString().padStart(2, '0')}`;
    case 'quarterly':
      return `${year}-Q${quarter}`;
    case 'yearly':
      return year.toString();
  }
}

/**
 * Gets the start date of a period.
 */
function getPeriodStart(date: Date, periodType: PeriodType): Date {
  const result = new Date(date);
  switch (periodType) {
    case 'monthly':
      result.setDate(1);
      result.setHours(0, 0, 0, 0);
      break;
    case 'quarterly':
      const quarter = Math.floor(result.getMonth() / 3);
      result.setMonth(quarter * 3, 1);
      result.setHours(0, 0, 0, 0);
      break;
    case 'yearly':
      result.setMonth(0, 1);
      result.setHours(0, 0, 0, 0);
      break;
  }
  return result;
}

/**
 * Gets the end date of a period.
 */
function getPeriodEnd(date: Date, periodType: PeriodType): Date {
  const result = new Date(date);
  switch (periodType) {
    case 'monthly':
      result.setMonth(result.getMonth() + 1, 0);
      result.setHours(23, 59, 59, 999);
      break;
    case 'quarterly':
      const quarter = Math.floor(result.getMonth() / 3);
      result.setMonth((quarter + 1) * 3, 0);
      result.setHours(23, 59, 59, 999);
      break;
    case 'yearly':
      result.setMonth(11, 31);
      result.setHours(23, 59, 59, 999);
      break;
  }
  return result;
}

/**
 * Generates revenue forecast based on historical data and active leases.
 */
export async function generateRevenueForecast(
  organizationId: string,
  startDate: Date,
  endDate: Date,
  periodType: PeriodType = 'monthly',
  forecastMonths: number = 3,
  filters?: {
    buildingId?: string | null;
  },
): Promise<RevenueForecast> {
  const paymentsCollection = await getPaymentsCollection();

  // Build query for completed payments
  const paymentQuery: Record<string, unknown> = {
    organizationId,
    status: 'completed',
    paymentDate: {
      $gte: startDate,
      $lte: endDate,
    },
  };

  // Get all completed payments in the date range
  const payments = await paymentsCollection.find(paymentQuery).sort({ paymentDate: 1 }).toArray();

  // Group payments by period
  const revenueByPeriod = new Map<string, RevenueDataPoint>();

  for (const payment of payments) {
    const period = formatPeriod(new Date(payment.paymentDate), periodType);
    const existing = revenueByPeriod.get(period);

    if (existing) {
      existing.revenue += payment.amount;
      existing.paymentCount += 1;
    } else {
      revenueByPeriod.set(period, {
        period,
        date: getPeriodStart(new Date(payment.paymentDate), periodType),
        revenue: payment.amount,
        invoiceCount: 0,
        paymentCount: 1,
      });
    }
  }

  // Get invoices for the period (for invoice count)
  const invoiceQuery: Record<string, unknown> = {
    organizationId,
    issueDate: {
      $gte: startDate,
      $lte: endDate,
    },
  };

  if (filters?.buildingId) {
    const { findUnitsByBuilding } = await import('@/lib/units/units');
    const units = await findUnitsByBuilding(filters.buildingId);
    const unitIds = units.map((u) => u._id);
    invoiceQuery.unitId = { $in: unitIds };
  }

  const invoices = await listInvoices(invoiceQuery);

  // Add invoice counts to periods
  for (const invoice of invoices) {
    const period = formatPeriod(new Date(invoice.issueDate), periodType);
    const dataPoint = revenueByPeriod.get(period);
    if (dataPoint) {
      dataPoint.invoiceCount += 1;
    }
  }

  // Convert to array and sort by date
  const historical = Array.from(revenueByPeriod.values()).sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  );

  // Calculate forecast
  // Simple forecast: average of last 3 periods, or use trend if available
  const forecast: RevenueDataPoint[] = [];
  const lastPeriods = historical.slice(-3);
  const averageRevenue =
    lastPeriods.length > 0
      ? lastPeriods.reduce((sum, p) => sum + p.revenue, 0) / lastPeriods.length
      : 0;

  // Calculate growth rate (if we have enough data)
  let growthRate: number | undefined;
  if (historical.length >= 2) {
    const recent = historical.slice(-3);
    if (recent.length >= 2) {
      const olderAvg = recent[0].revenue;
      const newerAvg = recent.slice(-2).reduce((sum, p) => sum + p.revenue, 0) / 2;
      if (olderAvg > 0) {
        growthRate = ((newerAvg - olderAvg) / olderAvg) * 100;
      }
    }
  }

  // Generate forecast periods
  const lastDate = historical.length > 0 ? historical[historical.length - 1].date : endDate;
  for (let i = 1; i <= forecastMonths; i++) {
    const forecastDate = new Date(lastDate);
    if (periodType === 'monthly') {
      forecastDate.setMonth(forecastDate.getMonth() + i);
    } else if (periodType === 'quarterly') {
      forecastDate.setMonth(forecastDate.getMonth() + i * 3);
    } else {
      forecastDate.setFullYear(forecastDate.getFullYear() + i);
    }

    const period = formatPeriod(forecastDate, periodType);
    const projectedRevenue = growthRate ? averageRevenue * (1 + growthRate / 100) : averageRevenue;

    forecast.push({
      period,
      date: getPeriodStart(forecastDate, periodType),
      revenue: projectedRevenue,
      invoiceCount: 0,
      paymentCount: 0,
    });
  }

  // Calculate totals
  const totalHistoricalRevenue = historical.reduce((sum, p) => sum + p.revenue, 0);
  const averageMonthlyRevenue =
    historical.length > 0 ? totalHistoricalRevenue / historical.length : 0;
  const projectedRevenue = forecast.length > 0 ? forecast[0].revenue : 0;

  return {
    organizationId,
    buildingId: filters?.buildingId || null,
    trend: {
      historical,
      forecast,
      periodType,
      startDate,
      endDate,
      forecastMonths,
    },
    totalHistoricalRevenue,
    averageMonthlyRevenue,
    projectedRevenue,
    growthRate,
  };
}
