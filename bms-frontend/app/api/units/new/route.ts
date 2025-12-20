import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { withOrganizationScope } from '@/lib/organizations/scoping';
import { listBuildings } from '@/lib/buildings/buildings';
import type { UnitType, UnitStatus } from '@/lib/units/units';

/**
 * GET /api/units/new
 * Returns metadata for creating a new unit (available types, statuses, buildings, etc.)
 * Requires units.create permission.
 */
export async function GET() {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to create units
    requirePermission(context, 'units', 'create');

    // Get buildings for the organization
    const baseQuery = withOrganizationScope(context, {});
    const buildings = await listBuildings(baseQuery);

    // Return available options for unit creation
    const unitTypes: { value: UnitType; label: string }[] = [
      { value: 'apartment', label: 'Apartment' },
      { value: 'office', label: 'Office' },
      { value: 'shop', label: 'Shop' },
      { value: 'warehouse', label: 'Warehouse' },
      { value: 'parking', label: 'Parking' },
    ];

    const statuses: { value: UnitStatus; label: string }[] = [
      { value: 'available', label: 'Available' },
      { value: 'occupied', label: 'Occupied' },
      { value: 'maintenance', label: 'Maintenance' },
      { value: 'reserved', label: 'Reserved' },
    ];

    return NextResponse.json({
      unitTypes,
      statuses,
      buildings: buildings.map((b) => ({
        _id: b._id,
        name: b.name,
        address: b.address,
      })),
      defaults: {
        unitType: 'apartment' as UnitType,
        status: 'available' as UnitStatus,
      },
    });
  } catch (error) {
    console.error('Get unit creation metadata error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
    }
    return NextResponse.json(
      { error: 'Unexpected error while fetching unit creation metadata' },
      { status: 500 },
    );
  }
}
