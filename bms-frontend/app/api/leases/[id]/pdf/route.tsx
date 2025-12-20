import React from 'react';
import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { validateOrganizationAccess } from '@/lib/organizations/scoping';
import { findLeaseById } from '@/lib/leases/leases';
import { findTenantById } from '@/lib/tenants/tenants';
import { findUnitById } from '@/lib/units/units';
import { findBuildingById } from '@/lib/buildings/buildings';
import { pdf } from '@react-pdf/renderer';
import { LeasePdf } from '@/lib/pdf/LeasePdf';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, routeParams: RouteParams) {
  const context = await getAuthContextFromCookies();
  const { id } = await routeParams.params;

  if (!context) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  requirePermission(context, 'leases', 'read');
  const lease = await findLeaseById(id, context.organizationId || undefined);
  if (!lease) {
    return NextResponse.json({ error: 'Lease not found' }, { status: 404 });
  }
  validateOrganizationAccess(context, lease.organizationId);

  const tenant = await findTenantById(lease.tenantId, lease.organizationId);
  const unit = await findUnitById(lease.unitId, lease.organizationId);
  const building = unit?.buildingId
    ? await findBuildingById(unit.buildingId, lease.organizationId)
    : null;

  const doc = await pdf(
    <LeasePdf
      lease={lease}
      tenant={tenant ?? undefined}
      unit={unit ?? undefined}
      building={building ?? undefined}
    />,
  ).toBuffer();

  return new Response(doc, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="lease-${lease._id}.pdf"`,
    },
  });
}
