import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { withOrganizationScope } from '@/lib/organizations/scoping';
import { getBuildingsCollection, updateBuilding } from '@/lib/buildings/buildings';
import { getUnitsCollection } from '@/lib/units/units';
import { findLeaseById, updateLease } from '@/lib/leases/leases';
import { resolveRentFromPolicy } from '@/lib/rent/rent-calculator';
import { notifyRentChange } from '@/modules/notifications/events';

interface BulkUpdateBody {
  buildingId: string;
  policy?: {
    baseRatePerSqm: number;
    decrementPerFloor?: number | null;
    groundFloorMultiplier?: number | null;
    minRatePerSqm?: number | null;
    effectiveDate?: string | null;
    floorOverrides?: { floor: number; ratePerSqm: number }[];
  };
  unitOverrides?: Array<{
    unitId: string;
    ratePerSqmOverride?: number | null;
    flatRentOverride?: number | null;
  }>;
  floorFilter?: { from: number; to: number };
  apply?: boolean;
  effectiveFrom?: string;
}

export async function POST(request: Request) {
  const context = await getAuthContextFromCookies();
  if (!context) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  requirePermission(context, 'leases', 'update');

  const body = (await request.json()) as BulkUpdateBody;
  const { buildingId, policy, unitOverrides, floorFilter, apply = false, effectiveFrom } = body;
  if (!buildingId) {
    return NextResponse.json({ error: 'buildingId is required' }, { status: 400 });
  }

  const orgQuery = withOrganizationScope(context, { _id: buildingId });

  const buildingsCollection = await getBuildingsCollection();
  const building = await buildingsCollection.findOne(orgQuery);
  if (!building) {
    return NextResponse.json({ error: 'Building not found or not accessible' }, { status: 404 });
  }

  const unitsCollection = await getUnitsCollection();
  const unitQuery: Record<string, unknown> = { buildingId };
  if (floorFilter) {
    unitQuery.floor = { $gte: floorFilter.from, $lte: floorFilter.to };
  }
  const units = await unitsCollection.find(unitQuery).toArray();

  // Prepare updated policy
  const updatedPolicy = policy
    ? {
        ...building.rentPolicy,
        ...policy,
        effectiveDate: policy.effectiveDate
          ? new Date(policy.effectiveDate)
          : (policy.effectiveDate ?? null),
      }
    : building.rentPolicy;

  // Apply unit overrides to collection update doc
  if (unitOverrides && unitOverrides.length > 0 && apply) {
    for (const override of unitOverrides) {
      await unitsCollection.updateOne(
        { _id: override.unitId, buildingId } as never,
        {
          $set: {
            ratePerSqmOverride: override.ratePerSqmOverride ?? null,
            flatRentOverride: override.flatRentOverride ?? null,
            updatedAt: new Date(),
          },
        } as never,
      );
    }
  }

  // Update building policy if provided
  if (policy && apply) {
    await updateBuilding(buildingId, { rentPolicy: updatedPolicy });
  }

  // Preview/apply lease recalculations
  const effectiveDate = effectiveFrom ? new Date(effectiveFrom) : new Date();
  const results: Array<{
    leaseId: string;
    unitId: string;
    oldRent?: number | null;
    newRent?: number | null;
    rateSource?: string;
  }> = [];

  for (const unit of units) {
    const leaseCursor = await import('@/lib/leases/leases').then(({ listLeases }) =>
      listLeases({ unitId: unit._id, status: 'active' }),
    );
    const policyResult = resolveRentFromPolicy({
      policy: updatedPolicy ?? null,
      unit: {
        floor: unit.floor ?? null,
        area: unit.area ?? null,
        ratePerSqmOverride: unit.ratePerSqmOverride ?? null,
        flatRentOverride: unit.flatRentOverride ?? null,
      },
    });

    for (const lease of leaseCursor) {
      const newRent = policyResult?.total ?? lease.rentAmount ?? lease.terms?.rent ?? null;
      results.push({
        leaseId: lease._id,
        unitId: unit._id,
        oldRent: lease.rentAmount ?? lease.terms?.rent ?? lease.calculatedRent ?? null,
        newRent,
        rateSource: policyResult?.rateSource,
      });

      if (apply && policyResult) {
        await updateLease(lease._id, {
          calculatedRent: policyResult.total,
          rentAmount: policyResult.total,
          terms: {
            ...(lease.terms ?? { rent: 0 }),
            rent: policyResult.total,
          },
          rateSource: policyResult.rateSource,
          rentBreakdown: {
            ...policyResult.breakdown,
            effectiveFrom: effectiveDate,
          },
          updatedAt: new Date(),
        });

        await notifyRentChange({
          leaseId: lease._id,
          tenantId: lease.tenantId,
          organizationId: lease.organizationId,
          unitLabel: unit.unitNumber,
          oldRent: lease.rentAmount ?? lease.terms?.rent ?? lease.calculatedRent ?? null,
          newRent: policyResult.total,
          effectiveDate,
        });
      }
    }
  }

  return NextResponse.json({
    message: apply ? 'Rent updates applied' : 'Preview only',
    count: results.length,
    results,
  });
}
