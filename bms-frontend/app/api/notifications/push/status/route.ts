import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { getUsersCollection } from '@/lib/auth/users';
import { getTenantsCollection } from '@/lib/tenants/tenants';
import { pushNotificationProvider } from '@/modules/notifications/providers/push';

/**
 * GET /api/notifications/push/status
 * Get push notification subscription status and VAPID public key.
 */
export async function GET(request: NextRequest) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { ObjectId } = await import('mongodb');
    let subscription = null;

    if (context.tenantId) {
      const tenantsCollection = await getTenantsCollection();
      const tenant = await tenantsCollection.findOne({
        _id: new ObjectId(context.tenantId),
      } as any);
      subscription = tenant?.pushSubscription || null;
    }

    if (!subscription && context.userId) {
      const usersCollection = await getUsersCollection();
      const user = await usersCollection.findOne({ _id: new ObjectId(context.userId) } as any);
      subscription = user?.pushSubscription || null;
    }

    const vapidPublicKey = pushNotificationProvider.getVapidPublicKey();

    return NextResponse.json({
      subscribed: !!subscription,
      subscription: subscription || null,
      vapidPublicKey,
    });
  } catch (error) {
    console.error('Failed to get push notification status:', error);
    return NextResponse.json({ error: 'Failed to get push notification status' }, { status: 500 });
  }
}

