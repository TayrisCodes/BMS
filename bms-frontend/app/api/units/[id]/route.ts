import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { validateOrganizationAccess } from '@/lib/organizations/scoping';
import { findUnitById, updateUnit, deleteUnit, type Unit } from '@/lib/units/units';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/units/[id]
 * Get a single unit by ID.
 * Requires units.read permission.
 */
export async function GET(request: Request, routeParams: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    const { id } = await routeParams.params;

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to read units
    requirePermission(context, 'units', 'read');

    const unit = await findUnitById(id, context.organizationId || undefined);

    if (!unit) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }

    // Validate organization access
    validateOrganizationAccess(context, unit.organizationId);

    return NextResponse.json({
      unit: {
        _id: unit._id,
        buildingId: unit.buildingId,
        unitNumber: unit.unitNumber,
        floor: unit.floor,
        unitType: unit.unitType,
        area: unit.area,
        bedrooms: unit.bedrooms,
        bathrooms: unit.bathrooms,
        status: unit.status,
        rentAmount: unit.rentAmount,
        organizationId: unit.organizationId,
        createdAt: unit.createdAt,
        updatedAt: unit.updatedAt,
      },
    });
  } catch (error) {
    console.error('Get unit error', error);
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
    return NextResponse.json({ error: 'Unexpected error while fetching unit' }, { status: 500 });
  }
}

/**
 * PATCH /api/units/[id]
 * Update a unit.
 * Requires units.update permission.
 */
export async function PATCH(request: Request, routeParams: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    const { id } = await routeParams.params;

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to update units
    requirePermission(context, 'units', 'update');

    // Get existing unit to validate organization access
    const existingUnit = await findUnitById(id, context.organizationId || undefined);

    if (!existingUnit) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }

    // Validate organization access
    validateOrganizationAccess(context, existingUnit.organizationId);

    const body = (await request.json()) as Partial<Unit>;

    // Remove fields that shouldn't be updated directly
    const updates: Partial<Unit> = {
      ...body,
    };
    delete updates._id;
    delete updates.organizationId;
    delete updates.createdAt;

    try {
      const updatedUnit = await updateUnit(id, updates);

      if (!updatedUnit) {
        return NextResponse.json({ error: 'Failed to update unit' }, { status: 500 });
      }

      return NextResponse.json({
        message: 'Unit updated successfully',
        unit: {
          _id: updatedUnit._id,
          buildingId: updatedUnit.buildingId,
          unitNumber: updatedUnit.unitNumber,
          floor: updatedUnit.floor,
          unitType: updatedUnit.unitType,
          area: updatedUnit.area,
          bedrooms: updatedUnit.bedrooms,
          bathrooms: updatedUnit.bathrooms,
          status: updatedUnit.status,
          rentAmount: updatedUnit.rentAmount,
          organizationId: updatedUnit.organizationId,
          createdAt: updatedUnit.createdAt,
          updatedAt: updatedUnit.updatedAt,
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Building not found')) {
          return NextResponse.json({ error: error.message }, { status: 404 });
        }
        if (error.message.includes('does not belong to the same organization')) {
          return NextResponse.json({ error: error.message }, { status: 403 });
        }
        if (error.message.includes('already exists in this building')) {
          return NextResponse.json({ error: error.message }, { status: 409 });
        }
      }
      throw error;
    }
  } catch (error) {
    console.error('Update unit error', error);
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
      if (error.message.includes('duplicate key')) {
        return NextResponse.json(
          { error: 'Unit number already exists in this building' },
          { status: 409 },
        );
      }
    }
    return NextResponse.json({ error: 'Unexpected error while updating unit' }, { status: 500 });
  }
}

/**
 * DELETE /api/units/[id]
 * Soft delete a unit (sets status to maintenance).
 * Requires units.delete permission.
 */
export async function DELETE(request: Request, routeParams: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    const { id } = await routeParams.params;

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to delete units
    requirePermission(context, 'units', 'delete');

    // Get existing unit to validate organization access
    const existingUnit = await findUnitById(id, context.organizationId || undefined);

    if (!existingUnit) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }

    // Validate organization access
    validateOrganizationAccess(context, existingUnit.organizationId);

    // TODO: Check if unit has active lease before deleting
    // For now, just soft delete

    const deleted = await deleteUnit(id);

    if (!deleted) {
      return NextResponse.json({ error: 'Failed to delete unit' }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Unit deleted successfully (soft delete - status set to maintenance)',
    });
  } catch (error) {
    console.error('Delete unit error', error);
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
    return NextResponse.json({ error: 'Unexpected error while deleting unit' }, { status: 500 });
  }
}

