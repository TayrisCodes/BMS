import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { validateOrganizationAccess } from '@/lib/organizations/scoping';
import {
  findMeterReadingById,
  updateMeterReading,
  deleteMeterReading,
  type MeterReading,
  type MeterReadingSource,
} from '@/lib/meter-readings/meter-readings';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/meter-readings/[id]
 * Get a single meter reading by ID.
 * Requires meter-readings.read or utilities.read permission.
 */
export async function GET(request: Request, routeParams: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    const { id } = await routeParams.params;

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to read meter readings
    try {
      requirePermission(context, 'utilities', 'read');
    } catch {
      // Allow FACILITY_MANAGER, BUILDING_MANAGER, ORG_ADMIN to read meter readings
      if (
        !context.roles.includes('FACILITY_MANAGER') &&
        !context.roles.includes('BUILDING_MANAGER') &&
        !context.roles.includes('ORG_ADMIN')
      ) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    const reading = await findMeterReadingById(id, context.organizationId || undefined);

    if (!reading) {
      return NextResponse.json({ error: 'Meter reading not found' }, { status: 404 });
    }

    // Validate organization access
    validateOrganizationAccess(context, reading.organizationId);

    return NextResponse.json({
      reading: {
        _id: reading._id,
        organizationId: reading.organizationId,
        meterId: reading.meterId,
        reading: reading.reading,
        readingDate: reading.readingDate,
        readBy: reading.readBy,
        source: reading.source,
        notes: reading.notes,
        createdAt: reading.createdAt,
        updatedAt: reading.updatedAt,
      },
    });
  } catch (error) {
    console.error('Get meter reading error', error);
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
    return NextResponse.json(
      { error: 'Unexpected error while fetching meter reading' },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/meter-readings/[id]
 * Update a meter reading (for corrections).
 * Requires meter-readings.update or utilities.update permission.
 */
export async function PATCH(request: Request, routeParams: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    const { id } = await routeParams.params;

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to update meter readings
    try {
      requirePermission(context, 'utilities', 'update');
    } catch {
      // Check if user has appropriate role
      if (
        !context.roles.includes('FACILITY_MANAGER') &&
        !context.roles.includes('BUILDING_MANAGER') &&
        !context.roles.includes('ORG_ADMIN')
      ) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // Get existing reading to validate organization access
    const existingReading = await findMeterReadingById(id, context.organizationId || undefined);

    if (!existingReading) {
      return NextResponse.json({ error: 'Meter reading not found' }, { status: 404 });
    }

    // Validate organization access
    validateOrganizationAccess(context, existingReading.organizationId);

    const body = (await request.json()) as Partial<MeterReading>;

    // Remove fields that shouldn't be updated directly
    const updates: Partial<MeterReading> = {
      ...body,
    };
    delete updates._id;
    delete updates.organizationId;
    delete updates.meterId;
    delete updates.createdAt;

    // Convert date strings to Date objects if present
    if (updates.readingDate && typeof updates.readingDate === 'string') {
      updates.readingDate = new Date(updates.readingDate);
    }

    // Validate reading if being updated
    if (updates.reading !== undefined && updates.reading < 0) {
      return NextResponse.json({ error: 'reading must be a non-negative number' }, { status: 400 });
    }

    try {
      const updatedReading = await updateMeterReading(id, updates);

      if (!updatedReading) {
        return NextResponse.json({ error: 'Failed to update meter reading' }, { status: 500 });
      }

      return NextResponse.json({
        message: 'Meter reading updated successfully',
        reading: {
          _id: updatedReading._id,
          organizationId: updatedReading.organizationId,
          meterId: updatedReading.meterId,
          reading: updatedReading.reading,
          readingDate: updatedReading.readingDate,
          readBy: updatedReading.readBy,
          source: updatedReading.source,
          notes: updatedReading.notes,
          createdAt: updatedReading.createdAt,
          updatedAt: updatedReading.updatedAt,
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('must be a non-negative number')) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
      }
      throw error;
    }
  } catch (error) {
    console.error('Update meter reading error', error);
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
    return NextResponse.json(
      { error: 'Unexpected error while updating meter reading' },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/meter-readings/[id]
 * Delete a meter reading (with caution, may affect consumption calculations).
 * Requires meter-readings.delete or utilities.delete permission.
 */
export async function DELETE(request: Request, routeParams: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    const { id } = await routeParams.params;

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to delete meter readings
    try {
      requirePermission(context, 'utilities', 'delete');
    } catch {
      // Check if user has appropriate role
      if (!context.roles.includes('FACILITY_MANAGER') && !context.roles.includes('ORG_ADMIN')) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // Get existing reading to validate organization access
    const existingReading = await findMeterReadingById(id, context.organizationId || undefined);

    if (!existingReading) {
      return NextResponse.json({ error: 'Meter reading not found' }, { status: 404 });
    }

    // Validate organization access
    validateOrganizationAccess(context, existingReading.organizationId);

    const deleted = await deleteMeterReading(id);

    if (!deleted) {
      return NextResponse.json({ error: 'Failed to delete meter reading' }, { status: 500 });
    }

    return NextResponse.json({
      message:
        "Meter reading deleted successfully. Note: This may affect consumption calculations and the meter's last reading has been updated.",
    });
  } catch (error) {
    console.error('Delete meter reading error', error);
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
    return NextResponse.json(
      { error: 'Unexpected error while deleting meter reading' },
      { status: 500 },
    );
  }
}
