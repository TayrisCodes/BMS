import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import {
  createParkingAssignment,
  listParkingAssignments,
  type CreateParkingAssignmentInput,
  type AssignmentType,
  type AssignmentStatus,
} from '@/lib/parking/parking-assignments';

/**
 * GET /api/parking/assignments
 * List parking assignments with optional filters.
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
      // Fallback: Allow SECURITY, BUILDING_MANAGER, FACILITY_MANAGER, ORG_ADMIN to read parking
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
    const tenantId = searchParams.get('tenantId');
    const visitorLogId = searchParams.get('visitorLogId');
    const parkingSpaceId = searchParams.get('parkingSpaceId');
    const status = searchParams.get('status') as AssignmentStatus | null;
    const type = searchParams.get('type') as AssignmentType | null;

    const filters: Parameters<typeof listParkingAssignments>[0] = {
      organizationId: context.organizationId,
    };

    if (buildingId) {
      filters.buildingId = buildingId;
    }

    if (tenantId) {
      filters.tenantId = tenantId;
    }

    if (visitorLogId) {
      filters.visitorLogId = visitorLogId;
    }

    if (parkingSpaceId) {
      filters.parkingSpaceId = parkingSpaceId;
    }

    if (status) {
      filters.status = status;
    }

    if (type) {
      filters.assignmentType = type;
    }

    const assignments = await listParkingAssignments(filters);

    return NextResponse.json({
      parkingAssignments: assignments.map((assignment) => ({
        _id: assignment._id,
        organizationId: assignment.organizationId,
        parkingSpaceId: assignment.parkingSpaceId,
        buildingId: assignment.buildingId,
        assignmentType: assignment.assignmentType,
        tenantId: assignment.tenantId,
        visitorLogId: assignment.visitorLogId,
        vehicleId: assignment.vehicleId,
        startDate: assignment.startDate,
        endDate: assignment.endDate,
        pricingId: assignment.pricingId,
        billingPeriod: assignment.billingPeriod,
        rate: assignment.rate,
        invoiceId: assignment.invoiceId,
        status: assignment.status,
        createdAt: assignment.createdAt,
        updatedAt: assignment.updatedAt,
      })),
      count: assignments.length,
    });
  } catch (error) {
    console.error('Get parking assignments error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
    }
    return NextResponse.json(
      { error: 'Unexpected error while fetching parking assignments' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/parking/assignments
 * Create a new parking assignment.
 * Requires parking.create permission.
 */
export async function POST(request: Request) {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to create parking assignments
    try {
      requirePermission(context, 'parking', 'create');
    } catch {
      // Fallback: Allow SECURITY, BUILDING_MANAGER, FACILITY_MANAGER, ORG_ADMIN to create parking
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

    const body = (await request.json()) as CreateParkingAssignmentInput;

    // Validate required fields
    if (!body.parkingSpaceId || !body.assignmentType || !body.startDate) {
      return NextResponse.json(
        {
          error: 'parkingSpaceId, assignmentType, and startDate are required',
        },
        { status: 400 },
      );
    }

    // Validate assignment type specific fields
    if (body.assignmentType === 'tenant' && !body.tenantId) {
      return NextResponse.json(
        {
          error: 'tenantId is required for tenant assignments',
        },
        { status: 400 },
      );
    }

    if (body.assignmentType === 'visitor' && !body.visitorLogId) {
      return NextResponse.json(
        {
          error: 'visitorLogId is required for visitor assignments',
        },
        { status: 400 },
      );
    }

    // Create parking assignment
    const input: CreateParkingAssignmentInput = {
      organizationId: context.organizationId,
      parkingSpaceId: body.parkingSpaceId,
      assignmentType: body.assignmentType,
      tenantId: body.tenantId || null,
      visitorLogId: body.visitorLogId || null,
      vehicleId: body.vehicleId || null,
      startDate: body.startDate,
      endDate: body.endDate || null,
      ...(body.pricingId !== undefined && { pricingId: body.pricingId }),
      ...(body.billingPeriod !== undefined && { billingPeriod: body.billingPeriod }),
      ...(body.rate !== undefined && { rate: body.rate }),
    };

    try {
      const assignment = await createParkingAssignment(input);

      return NextResponse.json(
        {
          message: 'Parking assignment created successfully',
          parkingAssignment: {
            _id: assignment._id,
            organizationId: assignment.organizationId,
            parkingSpaceId: assignment.parkingSpaceId,
            buildingId: assignment.buildingId,
            assignmentType: assignment.assignmentType,
            tenantId: assignment.tenantId,
            visitorLogId: assignment.visitorLogId,
            vehicleId: assignment.vehicleId,
            startDate: assignment.startDate,
            endDate: assignment.endDate,
            pricingId: assignment.pricingId,
            billingPeriod: assignment.billingPeriod,
            rate: assignment.rate,
            invoiceId: assignment.invoiceId,
            status: assignment.status,
            createdAt: assignment.createdAt,
            updatedAt: assignment.updatedAt,
          },
        },
        { status: 201 },
      );
    } catch (error) {
      if (error instanceof Error) {
        if (
          error.message.includes('not found') ||
          error.message.includes('does not belong to the same organization')
        ) {
          return NextResponse.json({ error: error.message }, { status: 404 });
        }
        if (error.message.includes('already assigned')) {
          return NextResponse.json({ error: error.message }, { status: 409 });
        }
        if (error.message.includes('Invalid') || error.message.includes('must be')) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
      }
      throw error;
    }
  } catch (error) {
    console.error('Create parking assignment error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
    }
    return NextResponse.json(
      { error: 'Unexpected error while creating parking assignment' },
      { status: 500 },
    );
  }
}
