import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { getUsersCollection } from '@/lib/auth/users';
import { getTenantsCollection } from '@/lib/tenants/tenants';
import { pushNotificationProvider } from '@/modules/notifications/providers/push';
import type webpush from 'web-push';

/**
 * POST /api/notifications/push/subscribe
 * Subscribe to push notifications.
 */
export async function POST(request: NextRequest) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { subscription } = body;

    if (!subscription || !pushNotificationProvider.validateSubscription(subscription)) {
      return NextResponse.json({ error: 'Invalid subscription object' }, { status: 400 });
    }

    // Store subscription in user or tenant record
    const { ObjectId } = await import('mongodb');

    if (context.tenantId) {
      const tenantsCollection = await getTenantsCollection();
      await tenantsCollection.updateOne(
        { _id: new ObjectId(context.tenantId) } as any,
        {
          $set: {
            pushSubscription: subscription as webpush.PushSubscription,
            updatedAt: new Date(),
          },
        } as any,
      );
    }

    if (context.userId) {
      const usersCollection = await getUsersCollection();
      await usersCollection.updateOne(
        { _id: new ObjectId(context.userId) } as any,
        {
          $set: {
            pushSubscription: subscription as webpush.PushSubscription,
            updatedAt: new Date(),
          },
        } as any,
      );
    }

    return NextResponse.json({ message: 'Successfully subscribed to push notifications' });
  } catch (error) {
    console.error('Failed to subscribe to push notifications:', error);
    return NextResponse.json(
      { error: 'Failed to subscribe to push notifications' },
      { status: 500 },
    );
  }
}
