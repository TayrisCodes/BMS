import { NextResponse } from 'next/server';
import { getAuthContextFromCookies, getCurrentUserFromCookies } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
import { findTenantByPhone } from '@/lib/tenants/tenants';
import { findLeasesByTenant } from '@/lib/leases/leases';
import { findUnitById } from '@/lib/units/units';
import { findBuildingById } from '@/lib/buildings/buildings';

export async function GET() {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!context.roles.includes('TENANT')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get user to find tenant by phone
    const user = await getCurrentUserFromCookies();
    if (!user || !user.phone) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Find tenant by phone
    const tenant = await findTenantByPhone(user.phone, context.organizationId);

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // Find active lease for tenant using domain model
    const leases = await findLeasesByTenant(tenant._id.toString(), context.organizationId);

    const lease = leases.find((l) => l.status === 'active');

    if (!lease) {
      return NextResponse.json({ error: 'No active lease found' }, { status: 404 });
    }

    // Fetch unit and building info using domain models
    const unit = lease.unitId ? await findUnitById(lease.unitId, context.organizationId) : null;

    const building = unit?.buildingId
      ? await findBuildingById(unit.buildingId, context.organizationId)
      : null;

    // Format lease data
    const leaseInfo = {
      startDate: lease.startDate || lease.createdAt,
      endDate: lease.endDate,
      rentAmount: lease.rentAmount || 0,
      status: lease.status || 'active',
    };

    const unitInfo = {
      unitId: lease.unitId?.toString() || null,
      number: unit?.unitNumber || 'N/A',
      buildingId: building?._id?.toString() || null,
      buildingName: building?.name || 'Unknown Building',
      address: building?.address
        ? typeof building.address === 'string'
          ? building.address
          : `${building.address.street || ''}, ${building.address.city || ''}`.trim()
        : '',
    };

    const terms = {
      deposit: lease.depositAmount || 0,
      utilitiesIncluded: false, // Can be derived from additionalCharges if needed
      petsAllowed: false, // Not in current lease model
      noticePeriod: 30, // Default, can be added to lease model if needed
    };

    // Calculate monthly charges from lease data
    const charges = [
      {
        name: 'Rent',
        amount: lease.rentAmount || 0,
        frequency: lease.billingCycle === 'monthly' ? 'Monthly' : 'Yearly',
      },
    ];

    // Add additional charges if present
    if (lease.additionalCharges && Array.isArray(lease.additionalCharges)) {
      lease.additionalCharges.forEach((charge: { name: string; amount: number }) => {
        charges.push({
          name: charge.name,
          amount: charge.amount,
          frequency: 'Monthly',
        });
      });
    }

    return NextResponse.json({
      lease: {
        leaseInfo,
        unitInfo,
        terms,
        charges,
      },
    });
  } catch (error) {
    console.error('Tenant lease error:', error);
    return NextResponse.json({ error: 'Failed to fetch lease information' }, { status: 500 });
  }
}
