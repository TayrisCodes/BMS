import { notificationService } from './notification-service';
import { findInvoiceById } from '@/lib/invoices/invoices';
import { findTenantById } from '@/lib/tenants/tenants';

export interface SendInvoiceOptions {
  invoiceId: string;
  organizationId: string;
  tenantId: string;
  channels?: Array<'in_app' | 'sms' | 'email'>;
}

export interface SendInvoiceResult {
  success: boolean;
  channels: {
    in_app?: { sent: boolean; error?: string };
    sms?: { sent: boolean; delivered: boolean; error?: string };
    email?: { sent: boolean; delivered: boolean; error?: string };
  };
  errors?: string[];
}

/**
 * Sends invoice to tenant via specified channels (in-app, SMS, email).
 * This is a wrapper around the notification service specifically for invoices.
 *
 * @param options - Send invoice options
 * @returns Result with delivery status for each channel
 */
export async function sendInvoiceToTenant(options: SendInvoiceOptions): Promise<SendInvoiceResult> {
  const { invoiceId, organizationId, tenantId, channels = ['in_app', 'sms'] } = options;

  try {
    // Fetch invoice and tenant details
    const invoice = await findInvoiceById(invoiceId, organizationId);
    const tenant = await findTenantById(tenantId, organizationId);

    if (!invoice) {
      return {
        success: false,
        channels: {},
        errors: ['Invoice not found'],
      };
    }

    if (!tenant) {
      return {
        success: false,
        channels: {},
        errors: ['Tenant not found'],
      };
    }

    // Format invoice details for notification
    const invoiceNumber = invoice.invoiceNumber || invoiceId;
    const amount = invoice.total;
    const dueDate = new Date(invoice.dueDate);

    // Create notification using the notification service
    const notification = await notificationService.createNotification({
      organizationId,
      tenantId,
      type: 'invoice_created',
      title: `New Invoice: ${invoiceNumber}`,
      message: `A new invoice has been created for you. Amount: ETB ${amount.toLocaleString('en-ET')}. Due date: ${dueDate.toLocaleDateString()}`,
      channels,
      link: `/tenant/invoices/${invoiceId}`,
      metadata: {
        invoiceId,
        invoiceNumber,
        amount,
        dueDate: invoice.dueDate,
        periodStart: invoice.periodStart,
        periodEnd: invoice.periodEnd,
      },
    });

    // Extract delivery status from notification
    const result: SendInvoiceResult = {
      success: true,
      channels: {},
    };

    if (notification.deliveryStatus.in_app) {
      result.channels.in_app = {
        sent: notification.deliveryStatus.in_app.sent,
        ...(notification.deliveryStatus.in_app.read ? {} : { error: 'Not read yet' }),
      };
    }

    if (notification.deliveryStatus.sms) {
      result.channels.sms = {
        sent: notification.deliveryStatus.sms.sent,
        delivered: notification.deliveryStatus.sms.delivered,
        ...(notification.deliveryStatus.sms.error
          ? { error: notification.deliveryStatus.sms.error }
          : {}),
      };
    }

    if (notification.deliveryStatus.email) {
      result.channels.email = {
        sent: notification.deliveryStatus.email.sent,
        delivered: notification.deliveryStatus.email.delivered,
        ...(notification.deliveryStatus.email.error
          ? { error: notification.deliveryStatus.email.error }
          : {}),
      };
    }

    // Check if any channel failed
    const hasErrors = Object.values(result.channels).some(
      (channel) => channel.error || ('delivered' in channel && channel.delivered === false),
    );

    if (hasErrors) {
      result.success = false;
      result.errors = Object.entries(result.channels)
        .filter(
          ([_, status]) => status.error || ('delivered' in status && status.delivered === false),
        )
        .map(([channel, status]) => `${channel}: ${status.error || 'Not delivered'}`);
    }

    return result;
  } catch (error) {
    console.error('[InvoiceSender] Error sending invoice:', error);
    return {
      success: false,
      channels: {},
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}
