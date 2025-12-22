import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { getPushSubscriptionsCollection } from '@/lib/db/push-subscriptions';

export const dynamic = 'force-dynamic';

/**
 * POST /api/push/unsubscribe
 * Unsubscribe from push notifications
 */
export async function POST(request: NextRequest) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { endpoint } = body;

    if (!endpoint) {
      return NextResponse.json({ error: 'Endpoint is required' }, { status: 400 });
    }

    const subscriptionsCollection = await getPushSubscriptionsCollection();

    // Delete subscription
    await subscriptionsCollection.deleteOne({ endpoint });

    return NextResponse.json({ success: true, message: 'Unsubscribed from push notifications' });
  } catch (error) {
    console.error('Push unsubscription error:', error);
    return NextResponse.json(
      { error: 'Failed to unsubscribe from push notifications' },
      { status: 500 },
    );
  }
}
