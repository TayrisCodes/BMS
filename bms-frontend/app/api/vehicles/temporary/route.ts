import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { validateOrganizationAccess } from '@/lib/organizations/scoping';
import { createVehicle, type CreateVehicleInput } from '@/lib/parking/vehicles';
import { findVisitorLogById } from '@/lib/security/visitor-logs';

/**
 * POST /api/vehicles/temporary
 * Creates a temporary vehicle for a visitor.
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

    const body = await request.json();
    const { visitorLogId, plateNumber, make, model, color, expiresAt } = body;

    if (!visitorLogId || !plateNumber) {
      return NextResponse.json(
        { error: 'visitorLogId and plateNumber are required' },
        { status: 400 },
      );
    }

    // Validate visitor log exists
    const visitorLog = await findVisitorLogById(visitorLogId, context.organizationId);
    if (!visitorLog) {
      return NextResponse.json({ error: 'Visitor log not found' }, { status: 404 });
    }

    // Set expiration to end of day or visitor exit time, whichever is earlier
    let expirationDate: Date | null = null;
    if (expiresAt) {
      expirationDate = new Date(expiresAt);
    } else {
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      expirationDate = endOfDay;
    }

    // Get tenant ID from visitor log (host tenant)
    const input: CreateVehicleInput = {
      organizationId: context.organizationId,
      tenantId: visitorLog.hostTenantId,
      plateNumber,
      make: make || null,
      model: model || null,
      color: color || null,
      isTemporary: true,
      visitorLogId,
      expiresAt: expirationDate,
      status: 'active',
    };

    const vehicle = await createVehicle(input);

    return NextResponse.json({ vehicle }, { status: 201 });
  } catch (error) {
    console.error('Failed to create temporary vehicle:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
