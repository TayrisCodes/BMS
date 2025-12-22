import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { validateOrganizationAccess } from '@/lib/organizations/scoping';
import {
  createParkingViolation,
  listParkingViolations,
  type CreateParkingViolationInput,
} from '@/lib/parking/parking-violations';

/**
 * GET /api/parking/violations
 * Lists all parking violations for the organization, with optional filters.
 * Requires parking.read permission.
 */
export async function GET(request: NextRequest) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    requirePermission(context, 'parking', 'read');
    if (!context.organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }
    validateOrganizationAccess(context, context.organizationId);

    const { searchParams } = request.nextUrl;
    const buildingId = searchParams.get('buildingId');
    const violationType = searchParams.get('violationType');
    const severity = searchParams.get('severity');
    const status = searchParams.get('status');
    const vehicleId = searchParams.get('vehicleId');
    const tenantId = searchParams.get('tenantId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const filters: Record<string, unknown> = {};
    if (buildingId) filters.buildingId = buildingId;
    if (violationType) filters.violationType = violationType;
    if (severity) filters.severity = severity;
    if (status) filters.status = status;
    if (vehicleId) filters.vehicleId = vehicleId;
    if (tenantId) filters.tenantId = tenantId;
    if (startDate) filters.reportedAt = { $gte: new Date(startDate) };
    if (endDate) filters.reportedAt = { ...filters.reportedAt, $lte: new Date(endDate) };

    const violations = await listParkingViolations(context.organizationId, filters);

    return NextResponse.json({ violations });
  } catch (error) {
    console.error('Failed to fetch parking violations:', error);
    return NextResponse.json({ error: 'Failed to fetch parking violations' }, { status: 500 });
  }
}

/**
 * POST /api/parking/violations
 * Creates a new parking violation report.
 * Requires parking.create permission.
 */
export async function POST(request: NextRequest) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    requirePermission(context, 'parking', 'create');
    if (!context.organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }
    validateOrganizationAccess(context, context.organizationId);

    const input: CreateParkingViolationInput = await request.json();

    const newViolation = await createParkingViolation({
      ...input,
      organizationId: context.organizationId,
      reportedBy: context.userId,
    });

    return NextResponse.json({ violation: newViolation }, { status: 201 });
  } catch (error) {
    console.error('Failed to create parking violation:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
