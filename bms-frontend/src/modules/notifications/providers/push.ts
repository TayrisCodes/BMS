/**
 * Push notification provider for PWA using Web Push API.
 * Supports VAPID keys for authentication.
 */
export class PushNotificationProvider {
  private vapidPublicKey: string | null = null;
  private vapidPrivateKey: string | null = null;
  private vapidSubject: string | null = null;
  private initialized: boolean = false;

  constructor() {
    // Get VAPID keys from environment
    this.vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null;
    this.vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || null;
    this.vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@bms.com';

    if (this.vapidPublicKey && this.vapidPrivateKey) {
      // Initialize VAPID details asynchronously
      this.initializeVapid();
    } else {
      console.warn(
        '[PushNotificationProvider] VAPID keys not configured. Push notifications will not work.',
      );
    }
  }

  private async initializeVapid() {
    try {
      const webpush = await import('web-push');
      webpush.default.setVapidDetails(
        this.vapidSubject!,
        this.vapidPublicKey!,
        this.vapidPrivateKey!,
      );
      this.initialized = true;
      console.log('[PushNotificationProvider] VAPID keys configured successfully');
    } catch (error) {
      console.error('[PushNotificationProvider] Failed to set VAPID details:', error);
    }
  }

  /**
   * Send a push notification to a subscription.
   * @param subscription - Push subscription object from the client
   * @param payload - Notification payload (title, body, etc.)
   * @returns Promise with success status and error if any
   */
  async sendPushNotification(
    subscription: any,
    payload: {
      title: string;
      body: string;
      icon?: string;
      badge?: string;
      image?: string;
      data?: Record<string, unknown>;
      tag?: string;
      requireInteraction?: boolean;
      silent?: boolean;
    },
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.initialized) {
      return {
        success: false,
        error: 'Push notification provider not initialized. VAPID keys required.',
      };
    }

    try {
      const webpush = await import('web-push');
      const notificationPayload = JSON.stringify({
        title: payload.title,
        body: payload.body,
        icon: payload.icon || '/icon-192x192.png',
        badge: payload.badge || '/icon-96x96.png',
        image: payload.image,
        data: payload.data || {},
        tag: payload.tag,
        requireInteraction: payload.requireInteraction || false,
        silent: payload.silent || false,
      });

      await webpush.default.sendNotification(subscription, notificationPayload);

      console.log('[PushNotificationProvider] Push notification sent successfully');
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Handle specific error cases
      if (errorMessage.includes('410') || errorMessage.includes('Gone')) {
        // Subscription expired or invalid
        return {
          success: false,
          error: 'Subscription expired or invalid',
        };
      }

      console.error('[PushNotificationProvider] Failed to send push notification:', errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Get the VAPID public key for client-side subscription.
   */
  getVapidPublicKey(): string | null {
    return this.vapidPublicKey;
  }

  /**
   * Validate a push subscription object.
   */
  validateSubscription(subscription: unknown): boolean {
    if (!subscription || typeof subscription !== 'object') {
      return false;
    }

    const sub = subscription as Record<string, unknown>;
    return (
      typeof sub.endpoint === 'string' &&
      sub.keys &&
      typeof sub.keys === 'object' &&
      typeof (sub.keys as Record<string, unknown>).p256dh === 'string' &&
      typeof (sub.keys as Record<string, unknown>).auth === 'string'
    );
  }
}

// Export singleton instance
export const pushNotificationProvider = new PushNotificationProvider();
