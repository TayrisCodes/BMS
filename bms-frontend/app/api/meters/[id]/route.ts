import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { validateOrganizationAccess } from '@/lib/organizations/scoping';
import { findMeterById, updateMeter, deleteMeter, type Meter } from '@/lib/meters/meters';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/meters/[id]
 * Get a single meter by ID.
 * Requires meters.read or utilities.read permission.
 */
export async function GET(request: Request, routeParams: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    const { id } = await routeParams.params;

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to read meters
    try {
      requirePermission(context, 'utilities', 'read');
    } catch {
      // Allow FACILITY_MANAGER, BUILDING_MANAGER, ORG_ADMIN to read meters
      if (
        !context.roles.includes('FACILITY_MANAGER') &&
        !context.roles.includes('BUILDING_MANAGER') &&
        !context.roles.includes('ORG_ADMIN')
      ) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    const meter = await findMeterById(id, context.organizationId || undefined);

    if (!meter) {
      return NextResponse.json({ error: 'Meter not found' }, { status: 404 });
    }

    // Validate organization access
    validateOrganizationAccess(context, meter.organizationId);

    return NextResponse.json({
      meter: {
        _id: meter._id,
        organizationId: meter.organizationId,
        buildingId: meter.buildingId,
        unitId: meter.unitId,
        assetId: meter.assetId,
        meterType: meter.meterType,
        meterNumber: meter.meterNumber,
        unit: meter.unit,
        installationDate: meter.installationDate,
        status: meter.status,
        lastReading: meter.lastReading,
        lastReadingDate: meter.lastReadingDate,
        createdAt: meter.createdAt,
        updatedAt: meter.updatedAt,
      },
    });
  } catch (error) {
    console.error('Get meter error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
      if (error.message.includes('does not have an organization ID')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('belongs to a different organization')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }
    return NextResponse.json({ error: 'Unexpected error while fetching meter' }, { status: 500 });
  }
}

/**
 * PATCH /api/meters/[id]
 * Update a meter.
 * Requires meters.update or utilities.update permission.
 */
export async function PATCH(request: Request, routeParams: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    const { id } = await routeParams.params;

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to update meters
    try {
      requirePermission(context, 'utilities', 'update');
    } catch {
      // Check if user has appropriate role
      if (!context.roles.includes('FACILITY_MANAGER') && !context.roles.includes('ORG_ADMIN')) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // Get existing meter to validate organization access
    const existingMeter = await findMeterById(id, context.organizationId || undefined);

    if (!existingMeter) {
      return NextResponse.json({ error: 'Meter not found' }, { status: 404 });
    }

    // Validate organization access
    validateOrganizationAccess(context, existingMeter.organizationId);

    const body = (await request.json()) as Partial<Meter>;

    // Remove fields that shouldn't be updated directly
    const updates: Partial<Meter> = {
      ...body,
    };
    delete updates._id;
    delete updates.organizationId;
    delete updates.createdAt;

    // Convert date strings to Date objects if present
    if (updates.installationDate && typeof updates.installationDate === 'string') {
      updates.installationDate = new Date(updates.installationDate);
    }
    if (updates.lastReadingDate && typeof updates.lastReadingDate === 'string') {
      updates.lastReadingDate = new Date(updates.lastReadingDate);
    }

    try {
      const updatedMeter = await updateMeter(id, updates);

      if (!updatedMeter) {
        return NextResponse.json({ error: 'Failed to update meter' }, { status: 500 });
      }

      return NextResponse.json({
        message: 'Meter updated successfully',
        meter: {
          _id: updatedMeter._id,
          organizationId: updatedMeter.organizationId,
          buildingId: updatedMeter.buildingId,
          unitId: updatedMeter.unitId,
          assetId: updatedMeter.assetId,
          meterType: updatedMeter.meterType,
          meterNumber: updatedMeter.meterNumber,
          unit: updatedMeter.unit,
          installationDate: updatedMeter.installationDate,
          status: updatedMeter.status,
          lastReading: updatedMeter.lastReading,
          lastReadingDate: updatedMeter.lastReadingDate,
          createdAt: updatedMeter.createdAt,
          updatedAt: updatedMeter.updatedAt,
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Building not found')) {
          return NextResponse.json({ error: error.message }, { status: 404 });
        }
        if (error.message.includes('Unit not found')) {
          return NextResponse.json({ error: error.message }, { status: 404 });
        }
        if (error.message.includes('does not belong to the same organization')) {
          return NextResponse.json({ error: error.message }, { status: 403 });
        }
        if (error.message.includes('already exists')) {
          return NextResponse.json({ error: error.message }, { status: 409 });
        }
      }
      throw error;
    }
  } catch (error) {
    console.error('Update meter error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
      if (error.message.includes('does not have an organization ID')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('belongs to a different organization')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }
    return NextResponse.json({ error: 'Unexpected error while updating meter' }, { status: 500 });
  }
}

/**
 * DELETE /api/meters/[id]
 * Soft delete a meter (sets status to inactive).
 * Requires meters.delete or utilities.delete permission.
 */
export async function DELETE(request: Request, routeParams: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    const { id } = await routeParams.params;

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to delete meters
    try {
      requirePermission(context, 'utilities', 'delete');
    } catch {
      // Check if user has appropriate role
      if (!context.roles.includes('FACILITY_MANAGER') && !context.roles.includes('ORG_ADMIN')) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // Get existing meter to validate organization access
    const existingMeter = await findMeterById(id, context.organizationId || undefined);

    if (!existingMeter) {
      return NextResponse.json({ error: 'Meter not found' }, { status: 404 });
    }

    // Validate organization access
    validateOrganizationAccess(context, existingMeter.organizationId);

    const deleted = await deleteMeter(id);

    if (!deleted) {
      return NextResponse.json({ error: 'Failed to delete meter' }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Meter deleted successfully (soft delete - status set to inactive)',
    });
  } catch (error) {
    console.error('Delete meter error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
      if (error.message.includes('does not have an organization ID')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('belongs to a different organization')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }
    return NextResponse.json({ error: 'Unexpected error while deleting meter' }, { status: 500 });
  }
}
