import { NextResponse } from 'next/server';
import { getAuthContextFromCookies, getCurrentUserFromCookies } from '@/lib/auth/session';
import { findTenantByPhone } from '@/lib/tenants/tenants';
import { findLeasesByTenant } from '@/lib/leases/leases';
import { findUnitById } from '@/lib/units/units';
import { findBuildingById } from '@/lib/buildings/buildings';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!context.roles.includes('TENANT')) {
      return NextResponse.json({ error: 'Forbidden: Tenant access required' }, { status: 403 });
    }

    const organizationId = context.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    // Get user to find tenant by phone
    const user = await getCurrentUserFromCookies();
    if (!user || !user.phone) {
      return NextResponse.json(
        { error: 'User not found or phone number missing' },
        { status: 404 },
      );
    }

    // Find tenant by phone
    const tenant = await findTenantByPhone(user.phone, organizationId);
    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found. Please contact your building manager.' },
        { status: 404 },
      );
    }

    // Get tenant's active lease to find building
    const leases = await findLeasesByTenant(tenant._id.toString(), organizationId);
    const activeLease = leases.find((l) => l.status === 'active');

    if (!activeLease?.unitId) {
      return NextResponse.json({
        name: null,
        email: null,
        phone: null,
      });
    }

    // Get unit and building
    const unit = await findUnitById(activeLease.unitId, organizationId);
    if (!unit?.buildingId) {
      return NextResponse.json({
        name: null,
        email: null,
        phone: null,
      });
    }

    const building = await findBuildingById(unit.buildingId, organizationId);
    if (!building) {
      return NextResponse.json({
        name: null,
        email: null,
        phone: null,
      });
    }

    // Find building manager user
    const db = await getDb();
    const buildingManager = await db.collection('users').findOne({
      organizationId,
      roles: 'BUILDING_MANAGER',
      // Optionally filter by building if users are assigned to specific buildings
    });

    if (buildingManager) {
      return NextResponse.json({
        name: buildingManager.name || buildingManager.firstName + ' ' + buildingManager.lastName,
        email: buildingManager.email || null,
        phone: buildingManager.phone || null,
      });
    }

    // Fallback - no building manager found
    return NextResponse.json({
      name: null,
      email: null,
      phone: null,
    });
  } catch (error) {
    console.error('Building manager fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch building manager information' },
      { status: 500 },
    );
  }
}
