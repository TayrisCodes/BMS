import type { Document, OptionalUnlessRequiredId } from 'mongodb';
import {
  getNotificationsCollection,
  type Notification,
  type NotificationType,
  type NotificationChannel,
} from '@/lib/notifications/notifications';
import { EmailProvider } from './providers/email';
import { WhatsAppProvider } from './providers/whatsapp';
import { pushNotificationProvider } from './providers/push';
import { findTenantById } from '@/lib/tenants/tenants';
import { findUserById } from '@/lib/auth/users';

export interface CreateNotificationInput {
  organizationId?: string | null;
  userId?: string | null;
  tenantId?: string | null;
  type: NotificationType;
  title: string;
  message: string;
  channels: Array<NotificationChannel>;
  link?: string | null;
  metadata?: Record<string, unknown> | null;
}

export class NotificationService {
  private emailProvider: EmailProvider;
  private whatsappProvider: WhatsAppProvider;

  constructor() {
    this.emailProvider = new EmailProvider();
    this.whatsappProvider = new WhatsAppProvider();
  }

  /**
   * Create a notification record in the database.
   */
  async createNotification(input: CreateNotificationInput): Promise<Notification> {
    const collection = await getNotificationsCollection();
    const now = new Date();

    // Initialize delivery status based on channels
    const deliveryStatus: Notification['deliveryStatus'] = {};
    if (input.channels.includes('in_app')) {
      deliveryStatus.in_app = {
        sent: false,
        read: false,
        readAt: null,
      };
    }
    if (input.channels.includes('email')) {
      deliveryStatus.email = {
        sent: false,
        delivered: false,
        error: null,
      };
    }
    if (input.channels.includes('sms')) {
      deliveryStatus.sms = {
        sent: false,
        delivered: false,
        error: null,
      };
    }

    const doc: Omit<Notification, '_id'> = {
      organizationId: input.organizationId ?? null,
      userId: input.userId ?? null,
      tenantId: input.tenantId ?? null,
      type: input.type,
      title: input.title,
      message: input.message,
      channels: input.channels,
      deliveryStatus,
      link: input.link ?? null,
      metadata: input.metadata ?? null,
      createdAt: now,
      updatedAt: now,
    };

    const result = await collection.insertOne(doc as OptionalUnlessRequiredId<Notification>);

    const notification = {
      ...(doc as Notification),
      _id: result.insertedId.toString(),
    } as Notification;

    // Automatically send the notification via configured channels
    await this.sendNotification(notification).catch((error) => {
      console.error('[NotificationService] Failed to send notification:', error);
      // Don't throw - notification is created, sending can be retried later
    });

    return notification;
  }

  /**
   * Get user's notification preferences.
   */
  private async getUserPreferences(
    userId?: string | null,
    tenantId?: string | null,
  ): Promise<{
    emailEnabled: boolean;
    smsEnabled: boolean;
    inAppEnabled: boolean;
    pushEnabled?: boolean;
    emailTypes: string[];
    smsTypes: string[];
    pushTypes?: string[];
    quietHoursEnabled?: boolean;
    quietHoursStart?: string;
    quietHoursEnd?: string;
    doNotDisturbEnabled?: boolean;
    doNotDisturbUntil?: Date | null;
    preferredLanguage?: string;
  } | null> {
    // Default preferences
    const defaultPreferences = {
      emailEnabled: true,
      smsEnabled: true,
      inAppEnabled: true,
      pushEnabled: false,
      emailTypes: [
        'invoice_created',
        'payment_due',
        'payment_received',
        'complaint_status_changed',
        'lease_expiring',
      ],
      smsTypes: ['invoice_created', 'payment_due', 'payment_received', 'work_order_assigned'],
      pushTypes: ['visitor_arrived', 'payment_due', 'emergency'],
      quietHoursEnabled: false,
      quietHoursStart: '22:00',
      quietHoursEnd: '08:00',
      doNotDisturbEnabled: false,
      doNotDisturbUntil: null,
      preferredLanguage: 'en',
    };

    // Get preferences from tenant if available
    if (tenantId) {
      const tenant = await findTenantById(tenantId, undefined);
      if (tenant?.notificationPreferences) {
        return tenant.notificationPreferences;
      }
    }

    // Get preferences from user if available
    if (userId) {
      const user = await findUserById(userId);
      if (user?.notificationPreferences) {
        return user.notificationPreferences;
      }
    }

    // Return default preferences
    return defaultPreferences;
  }

  /**
   * Check if notification should be sent via a specific channel based on user preferences.
   */
  private shouldSendViaChannel(
    channel: 'in_app' | 'email' | 'sms' | 'push',
    notificationType: NotificationType,
    preferences: {
      emailEnabled: boolean;
      smsEnabled: boolean;
      inAppEnabled: boolean;
      pushEnabled?: boolean;
      emailTypes: string[];
      smsTypes: string[];
      pushTypes?: string[];
    },
  ): boolean {
    if (channel === 'in_app') {
      return preferences.inAppEnabled;
    }

    if (channel === 'email') {
      if (!preferences.emailEnabled) {
        return false;
      }
      // If emailTypes is empty, allow all types
      if (preferences.emailTypes.length === 0) {
        return true;
      }
      return preferences.emailTypes.includes(notificationType);
    }

    if (channel === 'sms') {
      if (!preferences.smsEnabled) {
        return false;
      }
      // If smsTypes is empty, allow all types
      if (preferences.smsTypes.length === 0) {
        return true;
      }
      return preferences.smsTypes.includes(notificationType);
    }

    if (channel === 'push') {
      if (!preferences.pushEnabled) {
        return false;
      }
      // If pushTypes is empty, allow all types
      if (!preferences.pushTypes || preferences.pushTypes.length === 0) {
        return true;
      }
      return preferences.pushTypes.includes(notificationType);
    }

    return false;
  }

  /**
   * Check if notification should be sent based on quiet hours and do-not-disturb.
   */
  private shouldSendNotification(
    notification: Notification,
    preferences: {
      quietHoursEnabled?: boolean;
      quietHoursStart?: string;
      quietHoursEnd?: string;
      doNotDisturbEnabled?: boolean;
      doNotDisturbUntil?: Date | null;
    } | null,
  ): boolean {
    if (!preferences) {
      return true; // Default to sending if preferences not found
    }

    // Emergency alerts and urgent notices bypass quiet hours and do-not-disturb
    const isEmergency =
      notification.type === 'system' &&
      notification.metadata &&
      (notification.metadata.priority === 'urgent' ||
        notification.metadata.priority === 'emergency');

    if (isEmergency) {
      return true;
    }

    // Check do-not-disturb
    if (preferences.doNotDisturbEnabled && preferences.doNotDisturbUntil) {
      const now = new Date();
      if (now < new Date(preferences.doNotDisturbUntil)) {
        return false; // Do not disturb is active
      }
    }

    // Check quiet hours
    if (preferences.quietHoursEnabled && preferences.quietHoursStart && preferences.quietHoursEnd) {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentTime = currentHour * 60 + currentMinute; // Time in minutes

      const [startHour, startMinute] = preferences.quietHoursStart.split(':').map(Number);
      const [endHour, endMinute] = preferences.quietHoursEnd.split(':').map(Number);
      const startTime = startHour * 60 + startMinute;
      const endTime = endHour * 60 + endMinute;

      // Handle quiet hours that span midnight
      if (startTime > endTime) {
        // Quiet hours span midnight (e.g., 22:00 to 08:00)
        if (currentTime >= startTime || currentTime < endTime) {
          return false; // Within quiet hours
        }
      } else {
        // Quiet hours within same day
        if (currentTime >= startTime && currentTime < endTime) {
          return false; // Within quiet hours
        }
      }
    }

    return true;
  }

  /**
   * Send notification via configured channels (in-app, email, WhatsApp, push).
   */
  async sendNotification(notification: Notification): Promise<void> {
    const collection = await getNotificationsCollection();
    const updates: Partial<Notification> = {};

    // Get user preferences
    const preferences = await this.getUserPreferences(notification.userId, notification.tenantId);

    // Check if notification should be sent (quiet hours, do-not-disturb)
    const shouldSend = this.shouldSendNotification(notification, preferences);
    if (!shouldSend) {
      // Still create the notification record, but mark as deferred
      console.log(
        `[NotificationService] Notification deferred due to quiet hours or do-not-disturb`,
      );
      return;
    }

    // Send via in-app channel (check preferences)
    if (notification.channels.includes('in_app')) {
      const shouldSend = preferences
        ? this.shouldSendViaChannel('in_app', notification.type, preferences)
        : true; // Default to true if preferences not found

      if (shouldSend) {
        // Initialize in_app delivery status if not present
        if (!notification.deliveryStatus.in_app) {
          updates.deliveryStatus = {
            ...notification.deliveryStatus,
            in_app: {
              sent: true,
              read: false,
              readAt: null,
            },
          };
        } else if (!notification.deliveryStatus.in_app.sent) {
          updates.deliveryStatus = {
            ...notification.deliveryStatus,
            in_app: {
              ...notification.deliveryStatus.in_app,
              sent: true,
            },
          };
        }
      }
    }

    // Send via email (check preferences)
    if (notification.channels.includes('email') && notification.deliveryStatus.email) {
      const shouldSendEmail = preferences
        ? this.shouldSendViaChannel('email', notification.type, preferences)
        : true; // Default to true if preferences not found

      if (shouldSendEmail && !notification.deliveryStatus.email.sent) {
        try {
          // Get recipient email from tenant or user
          let recipientEmail: string | null = null;

          if (notification.tenantId) {
            const tenant = await findTenantById(
              notification.tenantId,
              notification.organizationId || undefined,
            );
            recipientEmail = tenant?.email || null;
          } else if (notification.userId) {
            const user = await findUserById(notification.userId);
            recipientEmail = user?.email || null;
          }

          if (recipientEmail) {
            // Use email templates if available based on notification type
            let emailSubject = notification.title;
            let emailBody = notification.message;
            let emailHtmlBody: string | undefined;

            if (notification.type === 'invoice_created' && notification.metadata) {
              const template = this.emailProvider.generateInvoiceCreatedEmail(
                (notification.metadata.invoiceNumber as string) || '',
                (notification.metadata.amount as number) || 0,
                new Date(notification.metadata.dueDate as string),
              );
              emailSubject = template.subject;
              emailBody = template.body;
              emailHtmlBody = template.htmlBody;
            } else if (notification.type === 'payment_due' && notification.metadata) {
              const template = this.emailProvider.generatePaymentDueEmail(
                (notification.metadata.invoiceNumber as string) || '',
                (notification.metadata.amount as number) || 0,
                new Date(notification.metadata.dueDate as string),
                (notification.metadata.daysUntilDue as number) || 0,
              );
              emailSubject = template.subject;
              emailBody = template.body;
              emailHtmlBody = template.htmlBody;
            } else if (notification.type === 'payment_received' && notification.metadata) {
              const template = this.emailProvider.generatePaymentReceivedEmail(
                (notification.metadata.amount as number) || 0,
                notification.metadata.invoiceNumber as string | undefined,
              );
              emailSubject = template.subject;
              emailBody = template.body;
              emailHtmlBody = template.htmlBody;
            } else if (notification.type === 'complaint_status_changed' && notification.metadata) {
              const template = this.emailProvider.generateComplaintStatusChangedEmail(
                (notification.metadata.complaintId as string) || '',
                (notification.metadata.status as string) || '',
                notification.metadata.message as string | undefined,
              );
              emailSubject = template.subject;
              emailBody = template.body;
              emailHtmlBody = template.htmlBody;
            } else if (notification.type === 'visitor_arrived' && notification.metadata) {
              const template = this.emailProvider.generateVisitorArrivedEmail(
                (notification.metadata.visitorName as string) || '',
                (notification.metadata.visitorPhone as string) || null,
                (notification.metadata.buildingName as string) || '',
                (notification.metadata.unitNumber as string) || null,
                (notification.metadata.floor as number) || null,
                notification.metadata.entryTime
                  ? new Date(notification.metadata.entryTime as string)
                  : new Date(),
              );
              emailSubject = template.subject;
              emailBody = template.body;
              emailHtmlBody = template.htmlBody;
            }

            const result = await this.emailProvider.sendEmail(
              recipientEmail,
              emailSubject,
              emailBody,
              emailHtmlBody,
            );

            updates.deliveryStatus = {
              ...(updates.deliveryStatus || notification.deliveryStatus),
              email: {
                sent: true,
                delivered: result.success,
                error: result.error || null,
              },
            };
          } else {
            updates.deliveryStatus = {
              ...(updates.deliveryStatus || notification.deliveryStatus),
              email: {
                sent: true,
                delivered: false,
                error: 'Recipient email not found',
              },
            };
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          updates.deliveryStatus = {
            ...(updates.deliveryStatus || notification.deliveryStatus),
            email: {
              sent: true,
              delivered: false,
              error: errorMessage,
            },
          };
        }
      }
    }

    // Send via WhatsApp (using SMS channel for now) - check preferences
    if (notification.channels.includes('sms') && notification.deliveryStatus.sms) {
      const shouldSendSms = preferences
        ? this.shouldSendViaChannel('sms', notification.type, preferences)
        : true; // Default to true if preferences not found

      if (shouldSendSms && !notification.deliveryStatus.sms.sent) {
        try {
          // Get recipient phone from tenant or user
          let recipientPhone: string | null = null;

          if (notification.tenantId) {
            const tenant = await findTenantById(
              notification.tenantId,
              notification.organizationId || undefined,
            );
            recipientPhone = tenant?.primaryPhone || null;
          } else if (notification.userId) {
            const user = await findUserById(notification.userId);
            recipientPhone = user?.phone || null;
          }

          if (recipientPhone) {
            // Use WhatsApp templates if available based on notification type
            let whatsappMessage = notification.message;

            if (notification.type === 'invoice_created' && notification.metadata) {
              whatsappMessage = this.whatsappProvider.generateInvoiceCreatedMessage(
                (notification.metadata.invoiceNumber as string) || '',
                (notification.metadata.amount as number) || 0,
                new Date(notification.metadata.dueDate as string),
              );
            } else if (notification.type === 'payment_due' && notification.metadata) {
              whatsappMessage = this.whatsappProvider.generatePaymentDueMessage(
                (notification.metadata.invoiceNumber as string) || '',
                (notification.metadata.amount as number) || 0,
                new Date(notification.metadata.dueDate as string),
                (notification.metadata.daysUntilDue as number) || 0,
              );
            } else if (notification.type === 'payment_received' && notification.metadata) {
              whatsappMessage = this.whatsappProvider.generatePaymentReceivedMessage(
                (notification.metadata.amount as number) || 0,
                notification.metadata.invoiceNumber as string | undefined,
              );
            } else if (notification.type === 'complaint_status_changed' && notification.metadata) {
              whatsappMessage = this.whatsappProvider.generateComplaintStatusChangedMessage(
                (notification.metadata.complaintId as string) || '',
                (notification.metadata.status as string) || '',
                notification.metadata.message as string | undefined,
              );
            } else if (notification.type === 'work_order_assigned' && notification.metadata) {
              whatsappMessage = this.whatsappProvider.generateWorkOrderAssignedMessage(
                (notification.metadata.workOrderId as string) || '',
                (notification.metadata.priority as string) || '',
                notification.metadata.dueDate
                  ? new Date(notification.metadata.dueDate as string)
                  : undefined,
              );
            } else if (notification.type === 'visitor_arrived' && notification.metadata) {
              whatsappMessage = this.whatsappProvider.generateVisitorArrivedMessage(
                (notification.metadata.visitorName as string) || '',
                (notification.metadata.visitorPhone as string) || null,
                (notification.metadata.buildingName as string) || '',
                (notification.metadata.unitNumber as string) || null,
                (notification.metadata.floor as number) || null,
                notification.metadata.entryTime
                  ? new Date(notification.metadata.entryTime as string)
                  : new Date(),
              );
            }

            const result = await this.whatsappProvider.sendWhatsApp(
              recipientPhone,
              whatsappMessage,
            );

            updates.deliveryStatus = {
              ...(updates.deliveryStatus || notification.deliveryStatus),
              sms: {
                sent: true,
                delivered: result.success,
                error: result.error || null,
              },
            };
          } else {
            updates.deliveryStatus = {
              ...(updates.deliveryStatus || notification.deliveryStatus),
              sms: {
                sent: true,
                delivered: false,
                error: 'Recipient phone not found',
              },
            };
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          updates.deliveryStatus = {
            ...(updates.deliveryStatus || notification.deliveryStatus),
            sms: {
              sent: true,
              delivered: false,
              error: errorMessage,
            },
          };
        }
      }
    }

    // Send via push notification - check preferences
    if (notification.channels.includes('push') && notification.deliveryStatus.push) {
      const shouldSendPush = preferences
        ? this.shouldSendViaChannel('push', notification.type, preferences)
        : true; // Default to true if preferences not found

      if (shouldSendPush && !notification.deliveryStatus.push.sent) {
        try {
          // Get push subscription from tenant or user
          let subscription: any = null;

          if (notification.tenantId) {
            const tenant = await findTenantById(
              notification.tenantId,
              notification.organizationId || undefined,
            );
            subscription = tenant?.pushSubscription || null;
          } else if (notification.userId) {
            const user = await findUserById(notification.userId);
            subscription = user?.pushSubscription || null;
          }

          if (subscription && pushNotificationProvider.validateSubscription(subscription)) {
            const result = await pushNotificationProvider.sendPushNotification(subscription, {
              title: notification.title,
              body: notification.message,
              data: {
                notificationId: notification._id,
                type: notification.type,
                link: notification.link || null,
                ...notification.metadata,
              },
              tag: notification.type,
            });

            updates.deliveryStatus = {
              ...(updates.deliveryStatus || notification.deliveryStatus),
              push: {
                sent: true,
                delivered: result.success,
                error: result.error || null,
              },
            };
          } else {
            updates.deliveryStatus = {
              ...(updates.deliveryStatus || notification.deliveryStatus),
              push: {
                sent: true,
                delivered: false,
                error: 'Push subscription not found',
              },
            };
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          updates.deliveryStatus = {
            ...(updates.deliveryStatus || notification.deliveryStatus),
            push: {
              sent: true,
              delivered: false,
              error: errorMessage,
            },
          };
        }
      }
    }

    // Update notification with delivery status
    if (Object.keys(updates).length > 0) {
      updates.updatedAt = new Date();
      await collection.updateOne(
        { _id: notification._id } as Document,
        { $set: updates } as Document,
      );
    }
  }

  /**
   * Mark in-app notification as read.
   */
  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    const collection = await getNotificationsCollection();
    const { ObjectId } = await import('mongodb');

    try {
      // First, find the notification to check if user has access
      const notification = await collection.findOne({
        _id: new ObjectId(notificationId),
      } as Document);

      if (!notification) {
        return false;
      }

      // Check if user has access (userId matches OR notification is for tenant and user is that tenant)
      // For now, we'll allow marking as read if userId matches or if notification has no userId (org-wide)
      const hasAccess =
        notification.userId === userId ||
        notification.userId === null ||
        notification.userId === undefined;

      if (!hasAccess) {
        return false;
      }

      // Update: mark as read and also ensure sent is true
      const result = await collection.updateOne(
        {
          _id: new ObjectId(notificationId),
        } as Document,
        {
          $set: {
            'deliveryStatus.in_app.read': true,
            'deliveryStatus.in_app.readAt': new Date(),
            'deliveryStatus.in_app.sent': true, // Also set sent to true if not already
            updatedAt: new Date(),
          },
        } as Document,
      );

      return result.modifiedCount > 0;
    } catch {
      return false;
    }
  }

  /**
   * Get count of unread notifications for a user.
   */
  async getUnreadCount(
    userId?: string,
    tenantId?: string,
    organizationId?: string,
  ): Promise<number> {
    const collection = await getNotificationsCollection();

    // Use the same query logic as getNotifications, but filter for unread
    const notifications = await this.getNotifications(userId, tenantId, organizationId, 1000);

    // Count unread notifications (not read, regardless of sent status)
    return notifications.filter((n) => {
      if (!n.channels.includes('in_app')) return false;
      const inAppStatus = n.deliveryStatus.in_app;
      return inAppStatus && !inAppStatus.read;
    }).length;
  }

  /**
   * Get notifications for a user or tenant.
   * If organizationId is provided, shows all notifications in that organization (for admins).
   * Otherwise, filters by userId or tenantId.
   */
  async getNotifications(
    userId?: string,
    tenantId?: string,
    organizationId?: string,
    limit: number = 20,
  ): Promise<Notification[]> {
    const collection = await getNotificationsCollection();

    const query: Record<string, unknown> = {};

    // If organizationId is provided, show all notifications in that organization
    // This allows admins to see all notifications
    if (organizationId) {
      // Always filter by organizationId
      query.organizationId = organizationId;

      // If we have both userId and tenantId, show notifications for both
      if (userId && tenantId) {
        query.$or = [
          { userId },
          { tenantId },
          { userId: null, tenantId: null }, // org-wide
        ];
      }
      // If we only have userId (admin/staff), show their notifications + all tenant notifications in org
      else if (userId && !tenantId) {
        // Show all notifications in the organization (admin can see everything)
        // No additional filter needed - already filtered by organizationId
      }
      // If we only have tenantId, show tenant's notifications
      else if (tenantId && !userId) {
        query.tenantId = tenantId;
      }
      // If no userId or tenantId, show all org notifications
      // (already filtered by organizationId above)
    } else {
      // If no organizationId, filter by userId or tenantId only
      if (userId && tenantId) {
        query.$or = [{ userId }, { tenantId }];
      } else if (userId) {
        query.userId = userId;
      } else if (tenantId) {
        query.tenantId = tenantId;
      }
    }

    return collection
      .find(query as Document)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
