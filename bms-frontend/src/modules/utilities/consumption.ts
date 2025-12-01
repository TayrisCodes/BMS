import {
  findMeterReadingsByMeter,
  getLatestReading,
  calculateConsumption as calculateConsumptionBase,
} from '@/lib/meter-readings/meter-readings';

/**
 * Calculate consumption for a specific month.
 * Returns the consumption between the first and last reading in that month, or null if insufficient data.
 */
export async function calculateMonthlyConsumption(
  meterId: string,
  year: number,
  month: number,
  organizationId?: string,
): Promise<number | null> {
  // Month is 0-indexed in JavaScript Date, but we receive 1-indexed (1-12)
  const startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999); // Last day of the month

  return calculateConsumptionBase(meterId, startDate, endDate, organizationId);
}

/**
 * Calculate consumption for a specific period (between two dates).
 * This is a wrapper around the base calculateConsumption function.
 */
export async function calculatePeriodConsumption(
  meterId: string,
  startDate: Date,
  endDate: Date,
  organizationId?: string,
): Promise<number | null> {
  return calculateConsumptionBase(meterId, startDate, endDate, organizationId);
}

/**
 * Detect anomalies in consumption based on threshold percentage.
 * Compares recent consumption to historical average and flags if it exceeds threshold.
 * Returns an object with anomaly status, current consumption, average consumption, and percentage change.
 */
export async function detectAnomalies(
  meterId: string,
  thresholdPercent: number = 30,
  organizationId?: string,
): Promise<{
  hasAnomaly: boolean;
  currentConsumption: number | null;
  averageConsumption: number | null;
  percentageChange: number | null;
  message: string | null;
}> {
  // Get readings for the last 6 months
  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);

  // Get all readings in this period
  const readings = await findMeterReadingsByMeter(meterId, organizationId);
  const recentReadings = readings.filter((r) => new Date(r.readingDate) >= sixMonthsAgo);

  if (recentReadings.length < 2) {
    return {
      hasAnomaly: false,
      currentConsumption: null,
      averageConsumption: null,
      percentageChange: null,
      message: 'Insufficient data to detect anomalies (need at least 2 readings)',
    };
  }

  // Sort by date
  recentReadings.sort(
    (a, b) => new Date(a.readingDate).getTime() - new Date(b.readingDate).getTime(),
  );

  // Calculate current period consumption (last month)
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentPeriodStart = lastMonth;
  const currentPeriodEnd = thisMonth;

  const currentReadings = recentReadings.filter((r) => {
    const readingDate = new Date(r.readingDate);
    return readingDate >= currentPeriodStart && readingDate < currentPeriodEnd;
  });

  if (currentReadings.length < 2) {
    return {
      hasAnomaly: false,
      currentConsumption: null,
      averageConsumption: null,
      percentageChange: null,
      message: 'Insufficient data for current period',
    };
  }

  const lastReading = currentReadings[currentReadings.length - 1];
  const firstReading = currentReadings[0];
  if (!lastReading || !firstReading) {
    return {
      hasAnomaly: false,
      currentConsumption: null,
      averageConsumption: null,
      percentageChange: null,
      message: 'Insufficient data for current period',
    };
  }
  const currentConsumption = lastReading.reading - firstReading.reading;

  // Calculate average monthly consumption (excluding current month)
  const historicalReadings = recentReadings.filter(
    (r) => new Date(r.readingDate) < currentPeriodStart,
  );

  if (historicalReadings.length < 2) {
    return {
      hasAnomaly: false,
      currentConsumption,
      averageConsumption: null,
      percentageChange: null,
      message: 'Insufficient historical data',
    };
  }

  // Group historical readings by month and calculate monthly consumption
  const monthlyConsumptions: number[] = [];
  const monthGroups: Record<string, typeof historicalReadings> = {};

  historicalReadings.forEach((reading) => {
    const date = new Date(reading.readingDate);
    const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
    if (!monthGroups[monthKey]) {
      monthGroups[monthKey] = [];
    }
    monthGroups[monthKey].push(reading);
  });

  Object.values(monthGroups).forEach((readings) => {
    if (readings.length >= 2) {
      readings.sort(
        (a, b) => new Date(a.readingDate).getTime() - new Date(b.readingDate).getTime(),
      );
      const lastReading = readings[readings.length - 1];
      const firstReading = readings[0];
      if (lastReading && firstReading) {
        const consumption = lastReading.reading - firstReading.reading;
        monthlyConsumptions.push(consumption);
      }
    }
  });

  if (monthlyConsumptions.length === 0) {
    return {
      hasAnomaly: false,
      currentConsumption,
      averageConsumption: null,
      percentageChange: null,
      message: 'Insufficient historical monthly data',
    };
  }

  // Calculate average
  const averageConsumption =
    monthlyConsumptions.reduce((sum, val) => sum + val, 0) / monthlyConsumptions.length;

  // Calculate percentage change
  const percentageChange =
    averageConsumption > 0
      ? ((currentConsumption - averageConsumption) / averageConsumption) * 100
      : null;

  // Check if anomaly exists
  const hasAnomaly = percentageChange !== null && Math.abs(percentageChange) > thresholdPercent;

  let message: string | null = null;
  if (hasAnomaly && percentageChange !== null) {
    if (percentageChange > 0) {
      message = `Consumption increased by ${percentageChange.toFixed(1)}% compared to average`;
    } else {
      message = `Consumption decreased by ${Math.abs(percentageChange).toFixed(1)}% compared to average`;
    }
  }

  return {
    hasAnomaly,
    currentConsumption,
    averageConsumption,
    percentageChange,
    message,
  };
}

/**
 * Get consumption for multiple months (returns array of monthly consumption values).
 * Useful for displaying trends/charts.
 */
export async function getMonthlyConsumptionTrend(
  meterId: string,
  months: number = 12,
  organizationId?: string,
): Promise<Array<{ year: number; month: number; consumption: number | null }>> {
  const now = new Date();
  const results: Array<{ year: number; month: number; consumption: number | null }> = [];

  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // 1-indexed

    const consumption = await calculateMonthlyConsumption(meterId, year, month, organizationId);
    results.push({ year, month, consumption });
  }

  return results;
}
