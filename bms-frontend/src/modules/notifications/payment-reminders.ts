import { findOrganizationById } from '@/lib/organizations/organizations';
import { listInvoices, findOverdueInvoices, type Invoice } from '@/lib/invoices/invoices';
import { notificationService, type CreateNotificationInput } from './notification-service';
import { findTenantById } from '@/lib/tenants/tenants';

/**
 * Enhanced payment reminder system with configurable schedules.
 * Uses organization's payment reminder settings to determine when to send reminders.
 */

export interface PaymentReminderSettings {
  daysBeforeDue: number[]; // e.g., [7, 3, 0] - send reminders 7 days, 3 days, and on due date
  daysAfterDue: number[]; // e.g., [3, 7, 14, 30] - send reminders 3, 7, 14, 30 days after due
  escalationEnabled: boolean; // Enable daily reminders after due date
  reminderChannels: ('in_app' | 'email' | 'sms')[];
}

const DEFAULT_REMINDER_SETTINGS: PaymentReminderSettings = {
  daysBeforeDue: [7, 3, 0],
  daysAfterDue: [3, 7, 14, 30],
  escalationEnabled: true,
  reminderChannels: ['in_app', 'email', 'sms'],
};

/**
 * Gets payment reminder settings for an organization.
 * Returns default settings if not configured.
 */
export async function getPaymentReminderSettings(
  organizationId: string,
): Promise<PaymentReminderSettings> {
  const organization = await findOrganizationById(organizationId);
  if (!organization) {
    return DEFAULT_REMINDER_SETTINGS;
  }

  const settings = organization.paymentReminderSettings;
  if (!settings) {
    return DEFAULT_REMINDER_SETTINGS;
  }

  return {
    daysBeforeDue: settings.daysBeforeDue || DEFAULT_REMINDER_SETTINGS.daysBeforeDue,
    daysAfterDue: settings.daysAfterDue || DEFAULT_REMINDER_SETTINGS.daysAfterDue,
    escalationEnabled: settings.escalationEnabled ?? DEFAULT_REMINDER_SETTINGS.escalationEnabled,
    reminderChannels: settings.reminderChannels || DEFAULT_REMINDER_SETTINGS.reminderChannels,
  };
}

/**
 * Sends a payment reminder for an invoice.
 */
export async function sendPaymentReminder(
  invoice: Invoice,
  daysUntilDue: number,
  organizationId: string,
  settings?: PaymentReminderSettings,
): Promise<{ success: boolean; error?: string }> {
  try {
    const tenant = await findTenantById(invoice.tenantId, organizationId);
    if (!tenant) {
      return { success: false, error: 'Tenant not found' };
    }

    const reminderSettings = settings || (await getPaymentReminderSettings(organizationId));

    // Determine message based on days until due
    let title: string;
    let message: string;
    if (daysUntilDue > 0) {
      title = `Payment Reminder: Invoice ${invoice.invoiceNumber}`;
      message = `Your invoice ${invoice.invoiceNumber} is due in ${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''}. Amount: ${invoice.currency || 'ETB'} ${invoice.total.toLocaleString()}. Due date: ${invoice.dueDate.toLocaleDateString()}`;
    } else if (daysUntilDue === 0) {
      title = `Payment Due Today: Invoice ${invoice.invoiceNumber}`;
      message = `Your invoice ${invoice.invoiceNumber} is due today. Amount: ${invoice.currency || 'ETB'} ${invoice.total.toLocaleString()}. Please make payment as soon as possible.`;
    } else {
      const daysOverdue = Math.abs(daysUntilDue);
      title = `Overdue Invoice: ${invoice.invoiceNumber}`;
      message = `Your invoice ${invoice.invoiceNumber} is ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue. Amount: ${invoice.currency || 'ETB'} ${invoice.total.toLocaleString()}. Please make payment immediately.`;
    }

    const input: CreateNotificationInput = {
      organizationId,
      tenantId: invoice.tenantId,
      type: 'payment_due',
      title,
      message,
      channels: reminderSettings.reminderChannels,
      link: `/tenant/invoices/${invoice._id}`,
      metadata: {
        invoiceId: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        amount: invoice.total,
        dueDate: invoice.dueDate,
        daysUntilDue,
      },
    };

    await notificationService.createNotification(input);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[PaymentReminders] Error sending reminder for invoice ${invoice._id}:`, error);
    return { success: false, error: errorMessage };
  }
}

/**
 * Processes payment reminders for an organization based on configured settings.
 * This function should be called by a cron job.
 */
export async function processPaymentReminders(organizationId: string): Promise<{
  remindersSent: number;
  errors: string[];
}> {
  const settings = await getPaymentReminderSettings(organizationId);
  const now = new Date();
  const remindersSent: string[] = [];
  const errors: string[] = [];

  // Process reminders before due date
  for (const daysBefore of settings.daysBeforeDue) {
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + daysBefore);
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const invoices = await listInvoices({
      organizationId,
      status: { $in: ['sent', 'overdue'] },
      dueDate: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
    });

    for (const invoice of invoices) {
      try {
        const result = await sendPaymentReminder(invoice, daysBefore, organizationId, settings);
        if (result.success) {
          remindersSent.push(invoice._id);
        } else {
          errors.push(`Invoice ${invoice._id}: ${result.error || 'Unknown error'}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Invoice ${invoice._id}: ${errorMessage}`);
      }
    }
  }

  // Process reminders after due date
  for (const daysAfter of settings.daysAfterDue) {
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() - daysAfter);
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const invoices = await listInvoices({
      organizationId,
      status: { $in: ['sent', 'overdue'] },
      dueDate: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
    });

    for (const invoice of invoices) {
      try {
        const daysUntilDue = -daysAfter; // Negative for overdue
        const result = await sendPaymentReminder(invoice, daysUntilDue, organizationId, settings);
        if (result.success) {
          remindersSent.push(invoice._id);
        } else {
          errors.push(`Invoice ${invoice._id}: ${result.error || 'Unknown error'}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Invoice ${invoice._id}: ${errorMessage}`);
      }
    }
  }

  // Process escalation reminders (daily for overdue invoices)
  if (settings.escalationEnabled) {
    const overdueInvoices = await findOverdueInvoices(organizationId, now);
    for (const invoice of overdueInvoices) {
      // Only send escalation if invoice is overdue by more than the last configured day
      const daysOverdue = Math.ceil(
        (now.getTime() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24),
      );
      const maxDaysAfter = Math.max(...settings.daysAfterDue, 0);
      if (daysOverdue > maxDaysAfter) {
        try {
          const result = await sendPaymentReminder(invoice, -daysOverdue, organizationId, settings);
          if (result.success) {
            remindersSent.push(invoice._id);
          } else {
            errors.push(`Invoice ${invoice._id}: ${result.error || 'Unknown error'}`);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Invoice ${invoice._id}: ${errorMessage}`);
        }
      }
    }
  }

  return {
    remindersSent: remindersSent.length,
    errors,
  };
}

