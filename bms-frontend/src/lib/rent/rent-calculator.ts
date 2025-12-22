import type { BuildingRentPolicy } from '@/lib/buildings/buildings';

export interface RentCalculationInput {
  baseRatePerSqm: number;
  decrementPerFloor?: number | null;
  groundFloorMultiplier?: number | null;
  minRatePerSqm?: number | null;
  floor?: number | null;
  area?: number | null;
  floorOverrideRate?: number | null;
  ratePerSqmOverride?: number | null;
  flatRentOverride?: number | null;
}

export interface RentCalculationResult {
  appliedRatePerSqm: number;
  total: number;
  breakdown: {
    baseRatePerSqm: number;
    floorAdjustment: number | null;
    groundFloorMultiplier: number | null;
    appliedRatePerSqm: number;
    area: number | null;
    total: number;
  };
  rateSource: 'unit_override' | 'floor_override' | 'building_policy' | 'manual';
}

export function calculateRent(input: RentCalculationInput): RentCalculationResult {
  const {
    baseRatePerSqm,
    decrementPerFloor = 0,
    groundFloorMultiplier = 1,
    minRatePerSqm = 0,
    floor = 0,
    area = null,
    floorOverrideRate,
    ratePerSqmOverride,
    flatRentOverride,
  } = input;

  // Manual flat override wins
  if (flatRentOverride !== null && flatRentOverride !== undefined) {
    return {
      appliedRatePerSqm: 0,
      total: flatRentOverride,
      breakdown: {
        baseRatePerSqm: 0,
        floorAdjustment: null,
        groundFloorMultiplier: null,
        appliedRatePerSqm: 0,
        area,
        total: flatRentOverride,
      },
      rateSource: 'manual',
    };
  }

  // Per-sqm override at unit level
  if (ratePerSqmOverride !== null && ratePerSqmOverride !== undefined) {
    const total = area ? Math.round(ratePerSqmOverride * area) : Math.round(ratePerSqmOverride);
    return {
      appliedRatePerSqm: ratePerSqmOverride,
      total,
      breakdown: {
        baseRatePerSqm,
        floorAdjustment: null,
        groundFloorMultiplier: null,
        appliedRatePerSqm: ratePerSqmOverride,
        area,
        total,
      },
      rateSource: 'unit_override',
    };
  }

  // Floor override (per building policy)
  if (floorOverrideRate !== null && floorOverrideRate !== undefined) {
    const total = area ? Math.round(floorOverrideRate * area) : Math.round(floorOverrideRate);
    return {
      appliedRatePerSqm: floorOverrideRate,
      total,
      breakdown: {
        baseRatePerSqm,
        floorAdjustment: null,
        groundFloorMultiplier: null,
        appliedRatePerSqm: floorOverrideRate,
        area,
        total,
      },
      rateSource: 'floor_override',
    };
  }

  // Building policy formula
  const effectiveFloor = floor ?? 0;
  const isGround = effectiveFloor === 0 || effectiveFloor === 1;
  const floorAdjustment = Math.max(0, effectiveFloor - 1) * decrementPerFloor * -1;
  const groundMultiplier = isGround ? groundFloorMultiplier : 1;
  const computedRate = Math.max(
    minRatePerSqm,
    (baseRatePerSqm + floorAdjustment) * groundMultiplier,
  );

  const appliedRatePerSqm = computedRate;
  const total = area ? Math.round(appliedRatePerSqm * area) : Math.round(appliedRatePerSqm);

  return {
    appliedRatePerSqm,
    total,
    breakdown: {
      baseRatePerSqm,
      floorAdjustment,
      groundFloorMultiplier: groundMultiplier,
      appliedRatePerSqm,
      area,
      total,
    },
    rateSource: 'building_policy',
  };
}

export function resolveRentFromPolicy(opts: {
  policy: BuildingRentPolicy | null | undefined;
  unit: {
    floor?: number | null;
    area?: number | null;
    ratePerSqmOverride?: number | null;
    flatRentOverride?: number | null;
  };
}): RentCalculationResult | null {
  const { policy, unit } = opts;
  if (!policy) return null;

  const floorOverrideRate =
    policy.floorOverrides?.find((fo) => fo.floor === unit.floor)?.ratePerSqm ?? undefined;

  return calculateRent({
    baseRatePerSqm: policy.baseRatePerSqm,
    decrementPerFloor: policy.decrementPerFloor ?? undefined,
    groundFloorMultiplier: policy.groundFloorMultiplier ?? undefined,
    minRatePerSqm: policy.minRatePerSqm ?? undefined,
    floor: unit.floor ?? null,
    area: unit.area ?? null,
    floorOverrideRate,
    ratePerSqmOverride: unit.ratePerSqmOverride ?? undefined,
    flatRentOverride: unit.flatRentOverride ?? undefined,
  });
}
