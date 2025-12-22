import { NextResponse } from 'next/server';
import { getAuthContextFromCookies, getCurrentUserFromCookies } from '@/lib/auth/session';
import { recordTermsAcceptance, findLeaseById } from '@/lib/leases/leases';
import { findTenantByPhone } from '@/lib/tenants/tenants';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, routeParams: RouteParams) {
  const context = await getAuthContextFromCookies();
  const { id } = await routeParams.params;

  if (!context) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  if (!context.roles.includes('TENANT')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const lease = await findLeaseById(id, context.organizationId || undefined);
  if (!lease) {
    return NextResponse.json({ error: 'Lease not found' }, { status: 404 });
  }

  // Ensure current tenant belongs to this lease
  const user = await getCurrentUserFromCookies();
  if (!user?.phone) {
    return NextResponse.json({ error: 'User phone not found' }, { status: 404 });
  }

  const tenant = await findTenantByPhone(user.phone, context.organizationId);
  if (!tenant || tenant._id.toString() !== lease.tenantId) {
    return NextResponse.json({ error: 'Lease does not belong to this tenant' }, { status: 403 });
  }

  await recordTermsAcceptance(id, context.userId || tenant._id.toString(), 'TENANT');

  return NextResponse.json({ message: 'Terms accepted' });
}
