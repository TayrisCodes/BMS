import { NextResponse } from 'next/server';
import { runLeaseInvoicingForOrg } from '@/modules/leases/invoicing-service';

function isAuthorized(request: Request): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return process.env.NODE_ENV !== 'production';
  }
  return authHeader === `Bearer ${cronSecret}`;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    organizationId?: string;
  };

  const orgId = body.organizationId;
  if (!orgId) {
    return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
  }

  await runLeaseInvoicingForOrg(orgId);

  return NextResponse.json({
    message: 'Lease invoicing run completed',
    organizationId: orgId,
    timestamp: new Date().toISOString(),
  });
}

export async function GET() {
  return NextResponse.json({
    message: 'Lease invoicing cron endpoint',
    endpoint: '/api/cron/lease-invoicing',
    method: 'POST',
    security: 'Protected by CRON_SECRET',
    body: { organizationId: 'string' },
  });
}
