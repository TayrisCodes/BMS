import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import {
  createParkingPricing,
  listParkingPricing,
  type CreateParkingPricingInput,
  type ParkingSpaceType,
} from '@/lib/parking/parking-pricing';

/**
 * GET /api/parking/pricing
 * List parking pricing configurations with optional filters.
 * Requires parking.read permission.
 */
export async function GET(request: Request) {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to read parking
    try {
      requirePermission(context, 'parking', 'read');
    } catch {
      if (
        !context.roles.includes('SECURITY') &&
        !context.roles.includes('BUILDING_MANAGER') &&
        !context.roles.includes('FACILITY_MANAGER') &&
        !context.roles.includes('ORG_ADMIN')
      ) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    if (!context.organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const buildingId = searchParams.get('buildingId');
    const spaceType = searchParams.get('spaceType') as ParkingSpaceType | null;
    const isActive = searchParams.get('isActive');

    const filters: Parameters<typeof listParkingPricing>[0] = {
      organizationId: context.organizationId,
    };

    if (buildingId) {
      filters.buildingId = buildingId;
    }

    if (spaceType) {
      filters.spaceType = spaceType;
    }

    if (isActive !== null) {
      filters.isActive = isActive === 'true';
    }

    const pricing = await listParkingPricing(filters);

    return NextResponse.json({
      parkingPricing: pricing.map((p) => ({
        _id: p._id,
        organizationId: p.organizationId,
        buildingId: p.buildingId,
        spaceType: p.spaceType,
        pricingModel: p.pricingModel,
        monthlyRate: p.monthlyRate,
        dailyRate: p.dailyRate,
        hourlyRate: p.hourlyRate,
        currency: p.currency,
        effectiveFrom: p.effectiveFrom,
        effectiveTo: p.effectiveTo,
        isActive: p.isActive,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
      count: pricing.length,
    });
  } catch (error) {
    console.error('Get parking pricing error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }
    return NextResponse.json(
      { error: 'Unexpected error while fetching parking pricing' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/parking/pricing
 * Create a new parking pricing configuration.
 * Requires parking.update permission.
 */
export async function POST(request: Request) {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to update parking
    try {
      requirePermission(context, 'parking', 'update');
    } catch {
      if (
        !context.roles.includes('BUILDING_MANAGER') &&
        !context.roles.includes('FACILITY_MANAGER') &&
        !context.roles.includes('ORG_ADMIN')
      ) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    if (!context.organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    const body = (await request.json()) as CreateParkingPricingInput;

    // Validate required fields
    if (!body.buildingId || !body.spaceType || !body.pricingModel || !body.effectiveFrom) {
      return NextResponse.json(
        {
          error: 'buildingId, spaceType, pricingModel, and effectiveFrom are required',
        },
        { status: 400 },
      );
    }

    // Validate pricing model matches rates
    if (body.spaceType === 'tenant' && body.pricingModel === 'monthly' && !body.monthlyRate) {
      return NextResponse.json(
        {
          error: 'monthlyRate is required for tenant monthly parking',
        },
        { status: 400 },
      );
    }

    if (body.spaceType === 'visitor') {
      if (body.pricingModel === 'daily' && !body.dailyRate) {
        return NextResponse.json(
          {
            error: 'dailyRate is required for visitor daily parking',
          },
          { status: 400 },
        );
      }
      if (body.pricingModel === 'hourly' && !body.hourlyRate) {
        return NextResponse.json(
          {
            error: 'hourlyRate is required for visitor hourly parking',
          },
          { status: 400 },
        );
      }
    }

    // Create parking pricing
    const input: CreateParkingPricingInput = {
      organizationId: context.organizationId,
      buildingId: body.buildingId,
      spaceType: body.spaceType,
      pricingModel: body.pricingModel,
      monthlyRate: body.monthlyRate || null,
      dailyRate: body.dailyRate || null,
      hourlyRate: body.hourlyRate || null,
      currency: body.currency || 'ETB',
      effectiveFrom: body.effectiveFrom,
      effectiveTo: body.effectiveTo || null,
      isActive: body.isActive ?? true,
    };

    try {
      const pricing = await createParkingPricing(input);

      return NextResponse.json(
        {
          message: 'Parking pricing created successfully',
          parkingPricing: {
            _id: pricing._id,
            organizationId: pricing.organizationId,
            buildingId: pricing.buildingId,
            spaceType: pricing.spaceType,
            pricingModel: pricing.pricingModel,
            monthlyRate: pricing.monthlyRate,
            dailyRate: pricing.dailyRate,
            hourlyRate: pricing.hourlyRate,
            currency: pricing.currency,
            effectiveFrom: pricing.effectiveFrom,
            effectiveTo: pricing.effectiveTo,
            isActive: pricing.isActive,
            createdAt: pricing.createdAt,
            updatedAt: pricing.updatedAt,
          },
        },
        { status: 201 },
      );
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return NextResponse.json({ error: error.message }, { status: 404 });
        }
        if (error.message.includes('does not belong to the same organization')) {
          return NextResponse.json({ error: error.message }, { status: 403 });
        }
        if (error.message.includes('Invalid') || error.message.includes('must be')) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
      }
      throw error;
    }
  } catch (error) {
    console.error('Create parking pricing error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }
    return NextResponse.json(
      { error: 'Unexpected error while creating parking pricing' },
      { status: 500 },
    );
  }
}
