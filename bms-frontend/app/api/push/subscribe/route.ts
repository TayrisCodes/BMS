import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import {
  getPushSubscriptionsCollection,
  ensurePushSubscriptionIndexes,
} from '@/lib/db/push-subscriptions';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * POST /api/push/subscribe
 * Subscribe to push notifications (tenant-only)
 */
export async function POST(request: NextRequest) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Only tenants can subscribe to push notifications
    if (!context.roles.includes('TENANT')) {
      return NextResponse.json(
        { error: 'Only tenants can subscribe to push notifications' },
        { status: 403 },
      );
    }

    if (!context.organizationId) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
    }

    const body = await request.json();
    const { endpoint, keys } = body;

    if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
      return NextResponse.json({ error: 'Invalid subscription data' }, { status: 400 });
    }

    // Ensure indexes exist
    await ensurePushSubscriptionIndexes();

    const subscriptionsCollection = await getPushSubscriptionsCollection();

    // Check if subscription already exists
    const existing = await subscriptionsCollection.findOne({ endpoint });

    const subscriptionData = {
      userId: null,
      tenantId: context.tenantId ? new ObjectId(context.tenantId) : null,
      organizationId: new ObjectId(context.organizationId),
      endpoint,
      keys: {
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (existing) {
      // Update existing subscription
      await subscriptionsCollection.updateOne(
        { endpoint },
        {
          $set: {
            tenantId: subscriptionData.tenantId,
            organizationId: subscriptionData.organizationId,
            keys: subscriptionData.keys,
            updatedAt: subscriptionData.updatedAt,
          },
        },
      );
    } else {
      // Create new subscription
      await subscriptionsCollection.insertOne(subscriptionData);
    }

    return NextResponse.json({ success: true, message: 'Subscribed to push notifications' });
  } catch (error) {
    console.error('Push subscription error:', error);
    return NextResponse.json(
      { error: 'Failed to subscribe to push notifications' },
      { status: 500 },
    );
  }
}

