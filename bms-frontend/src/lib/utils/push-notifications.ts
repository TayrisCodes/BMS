/**
 * Client-side utilities for push notifications
 */

/**
 * Request notification permission and subscribe to push notifications
 */
export async function subscribeToPushNotifications(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push notifications are not supported in this browser');
    return null;
  }

  try {
    // Request notification permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('Notification permission denied');
      return null;
    }

    // Register service worker
    const registration = await navigator.serviceWorker.ready;

    // Get VAPID public key from server
    const response = await fetch('/api/notifications/push/status');
    const data = await response.json();
    const vapidPublicKey = data.vapidPublicKey;

    if (!vapidPublicKey) {
      console.warn('VAPID public key not available');
      return null;
    }

    // Convert VAPID key to Uint8Array
    const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

    // Subscribe to push notifications
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });

    // Send subscription to server
    await fetch('/api/notifications/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ subscription }),
    });

    return subscription;
  } catch (error) {
    console.error('Failed to subscribe to push notifications:', error);
    return null;
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPushNotifications(): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      await subscription.unsubscribe();
      await fetch('/api/notifications/push/unsubscribe', {
        method: 'POST',
      });
      return true;
    }

    return false;
  } catch (error) {
    console.error('Failed to unsubscribe from push notifications:', error);
    return false;
  }
}

/**
 * Check if push notifications are supported and subscribed
 */
export async function getPushNotificationStatus(): Promise<{
  supported: boolean;
  subscribed: boolean;
  permission: NotificationPermission;
  vapidPublicKey: string | null;
}> {
  const supported = 'serviceWorker' in navigator && 'PushManager' in window;
  const permission = Notification.permission;

  if (!supported) {
    return {
      supported: false,
      subscribed: false,
      permission,
      vapidPublicKey: null,
    };
  }

  try {
    const response = await fetch('/api/notifications/push/status');
    const data = await response.json();

    return {
      supported: true,
      subscribed: data.subscribed || false,
      permission,
      vapidPublicKey: data.vapidPublicKey || null,
    };
  } catch (error) {
    console.error('Failed to get push notification status:', error);
    return {
      supported: true,
      subscribed: false,
      permission,
      vapidPublicKey: null,
    };
  }
}

/**
 * Convert VAPID key from base64 URL to Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

