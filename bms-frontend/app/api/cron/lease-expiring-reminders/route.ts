import { NextResponse } from 'next/server';
import { runLeaseExpiryReminders } from '@/modules/leases/expiry-reminders';

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

  const body = (await request.json().catch(() => ({}))) as { organizationId?: string };
  const organizationId = body.organizationId;
  if (!organizationId) {
    return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
  }

  await runLeaseExpiryReminders(organizationId);

  return NextResponse.json({
    message: 'Lease expiry reminders processed',
    organizationId,
    timestamp: new Date().toISOString(),
  });
}

export async function GET() {
  return NextResponse.json({
    message: 'Lease expiry reminders cron endpoint',
    endpoint: '/api/cron/lease-expiring-reminders',
    method: 'POST',
    security: 'Protected by CRON_SECRET',
    body: { organizationId: 'string' },
  });
}

