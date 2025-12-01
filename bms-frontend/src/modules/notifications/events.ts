import { notificationService, type CreateNotificationInput } from './notification-service';
import { findTenantById } from '@/lib/tenants/tenants';
import { findInvoiceById } from '@/lib/invoices/invoices';
import { findUserById } from '@/lib/auth/users';

/**
 * Event-driven notification handlers.
 * These functions are called when specific events occur in the system.
 */

/**
 * Notify tenant when invoice is created.
 */
export async function notifyInvoiceCreated(
  invoiceId: string,
  organizationId: string,
  tenantId: string,
): Promise<void> {
  try {
    const invoice = await findInvoiceById(invoiceId, organizationId);
    const tenant = await findTenantById(tenantId, organizationId);

    if (!invoice || !tenant) {
      console.warn(`[Notifications] Invoice or tenant not found for invoice_created event:`, {
        invoiceId,
        tenantId,
      });
      return;
    }

    const input: CreateNotificationInput = {
      organizationId,
      tenantId,
      type: 'invoice_created',
      title: `New Invoice: ${invoice.invoiceNumber || invoiceId}`,
      message: `A new invoice has been created for you. Amount: ETB ${invoice.total.toLocaleString()}. Due date: ${invoice.dueDate.toLocaleDateString()}`,
      channels: ['in_app', 'email', 'sms'],
      link: `/tenant/invoices/${invoiceId}`,
      metadata: {
        invoiceId,
        invoiceNumber: invoice.invoiceNumber,
        amount: invoice.total,
        dueDate: invoice.dueDate,
      },
    };

    await notificationService.createNotification(input);
  } catch (error) {
    console.error('[Notifications] Error in notifyInvoiceCreated:', error);
  }
}

/**
 * Notify tenant when payment is due (reminder).
 */
export async function notifyPaymentDue(
  invoiceId: string,
  organizationId: string,
  tenantId: string,
  daysUntilDue: number,
): Promise<void> {
  try {
    const invoice = await findInvoiceById(invoiceId, organizationId);
    const tenant = await findTenantById(tenantId, organizationId);

    if (!invoice || !tenant) {
      console.warn(`[Notifications] Invoice or tenant not found for payment_due event:`, {
        invoiceId,
        tenantId,
      });
      return;
    }

    const input: CreateNotificationInput = {
      organizationId,
      tenantId,
      type: 'payment_due',
      title: `Payment Reminder: ${daysUntilDue} day(s) remaining`,
      message: `Your invoice payment is due in ${daysUntilDue} day(s). Amount: ETB ${invoice.total.toLocaleString()}. Due date: ${invoice.dueDate.toLocaleDateString()}`,
      channels: ['in_app', 'email', 'sms'],
      link: `/tenant/invoices/${invoiceId}`,
      metadata: {
        invoiceId,
        invoiceNumber: invoice.invoiceNumber,
        amount: invoice.total,
        dueDate: invoice.dueDate,
        daysUntilDue,
      },
    };

    await notificationService.createNotification(input);
  } catch (error) {
    console.error('[Notifications] Error in notifyPaymentDue:', error);
  }
}

/**
 * Notify tenant and accountant when payment is received.
 */
export async function notifyPaymentReceived(
  paymentId: string,
  organizationId: string,
  tenantId: string,
  invoiceId: string | null,
  amount: number,
): Promise<void> {
  try {
    const tenant = await findTenantById(tenantId, organizationId);

    if (!tenant) {
      console.warn(`[Notifications] Tenant not found for payment_received event:`, { tenantId });
      return;
    }

    // Notify tenant
    const tenantInput: CreateNotificationInput = {
      organizationId,
      tenantId,
      type: 'payment_received',
      title: `Payment Received: ETB ${amount.toLocaleString()}`,
      message: `Your payment of ETB ${amount.toLocaleString()} has been received successfully.`,
      channels: ['in_app'],
      link: invoiceId ? `/tenant/invoices/${invoiceId}` : `/tenant/payments`,
      metadata: {
        paymentId,
        invoiceId,
        amount,
      },
    };

    await notificationService.createNotification(tenantInput);

    // TODO: Notify accountant (need to find accountant users for the organization)
    // For now, we'll skip accountant notification as it requires finding users by role
  } catch (error) {
    console.error('[Notifications] Error in notifyPaymentReceived:', error);
  }
}

/**
 * Notify tenant when complaint status changes.
 */
export async function notifyComplaintStatusChanged(
  complaintId: string,
  organizationId: string,
  tenantId: string,
  status: string,
  message?: string,
): Promise<void> {
  try {
    const tenant = await findTenantById(tenantId, organizationId);

    if (!tenant) {
      console.warn(`[Notifications] Tenant not found for complaint_status_changed event:`, {
        tenantId,
      });
      return;
    }

    const input: CreateNotificationInput = {
      organizationId,
      tenantId,
      type: 'complaint_status_changed',
      title: `Complaint Status Updated: ${status}`,
      message: message || `Your complaint status has been updated to: ${status}`,
      channels: ['in_app', 'email'],
      link: `/tenant/complaints/${complaintId}`,
      metadata: {
        complaintId,
        status,
        message,
      },
    };

    await notificationService.createNotification(input);
  } catch (error) {
    console.error('[Notifications] Error in notifyComplaintStatusChanged:', error);
  }
}

/**
 * Notify technician when work order is assigned.
 */
export async function notifyWorkOrderAssigned(
  workOrderId: string,
  organizationId: string,
  technicianUserId: string,
  priority: string,
  dueDate?: Date,
): Promise<void> {
  try {
    const user = await findUserById(technicianUserId);

    if (!user) {
      console.warn(`[Notifications] User not found for work_order_assigned event:`, {
        technicianUserId,
      });
      return;
    }

    const input: CreateNotificationInput = {
      organizationId,
      userId: technicianUserId,
      type: 'work_order_assigned',
      title: `Work Order Assigned: ${workOrderId}`,
      message: `A new work order has been assigned to you. Priority: ${priority}${dueDate ? `. Due date: ${dueDate.toLocaleDateString()}` : ''}`,
      channels: ['in_app', 'sms'],
      link: `/technician/work-orders/${workOrderId}`,
      metadata: {
        workOrderId,
        priority,
        dueDate,
      },
    };

    await notificationService.createNotification(input);
  } catch (error) {
    console.error('[Notifications] Error in notifyWorkOrderAssigned:', error);
  }
}

/**
 * Notify facility manager when work order is completed.
 */
export async function notifyWorkOrderCompleted(
  workOrderId: string,
  organizationId: string,
  facilityManagerUserId?: string,
): Promise<void> {
  try {
    if (!facilityManagerUserId) {
      // If no specific facility manager, we could notify all facility managers
      // For now, we'll skip
      return;
    }

    const user = await findUserById(facilityManagerUserId);

    if (!user) {
      console.warn(`[Notifications] User not found for work_order_completed event:`, {
        facilityManagerUserId,
      });
      return;
    }

    const input: CreateNotificationInput = {
      organizationId,
      userId: facilityManagerUserId,
      type: 'work_order_completed',
      title: `Work Order Completed: ${workOrderId}`,
      message: `Work order ${workOrderId} has been completed.`,
      channels: ['in_app'],
      link: `/org/work-orders/${workOrderId}`,
      metadata: {
        workOrderId,
      },
    };

    await notificationService.createNotification(input);
  } catch (error) {
    console.error('[Notifications] Error in notifyWorkOrderCompleted:', error);
  }
}

/**
 * Notify tenant and building manager when lease is expiring.
 */
export async function notifyLeaseExpiring(input: {
  organizationId: string;
  tenantId: string;
  tenantName: string;
  unitNumber: string;
  endDate: Date;
  daysUntilExpiry: number;
  channels: Array<'in_app' | 'email' | 'sms'>;
  buildingManagerUserId?: string;
}): Promise<void> {
  try {
    const tenant = await findTenantById(input.tenantId, input.organizationId);

    if (!tenant) {
      console.warn(`[Notifications] Tenant not found for lease_expiring event:`, {
        tenantId: input.tenantId,
      });
      return;
    }

    // Notify tenant
    const tenantNotificationInput: CreateNotificationInput = {
      organizationId: input.organizationId,
      tenantId: input.tenantId,
      type: 'lease_expiring',
      title: `Lease Expiring in ${input.daysUntilExpiry} day(s)`,
      message: `Dear ${input.tenantName}, your lease for unit ${input.unitNumber} is expiring in ${input.daysUntilExpiry} day(s) on ${input.endDate.toLocaleDateString()}. Please contact management to discuss renewal options.`,
      channels: input.channels,
      link: `/tenant/lease`,
      metadata: {
        tenantName: input.tenantName,
        unitNumber: input.unitNumber,
        endDate: input.endDate.toISOString(),
        daysUntilExpiry: input.daysUntilExpiry,
      },
    };

    await notificationService.createNotification(tenantNotificationInput);

    // Notify building manager if provided
    if (input.buildingManagerUserId) {
      const user = await findUserById(input.buildingManagerUserId);

      if (user) {
        const managerInput: CreateNotificationInput = {
          organizationId: input.organizationId,
          userId: input.buildingManagerUserId,
          type: 'lease_expiring',
          title: `Lease Expiring: ${input.tenantName} - Unit ${input.unitNumber}`,
          message: `Lease for tenant ${input.tenantName} (unit ${input.unitNumber}) is expiring in ${input.daysUntilExpiry} day(s) on ${input.endDate.toLocaleDateString()}.`,
          channels: ['in_app'],
          link: `/admin/leases`,
          metadata: {
            tenantId: input.tenantId,
            tenantName: input.tenantName,
            unitNumber: input.unitNumber,
            endDate: input.endDate.toISOString(),
            daysUntilExpiry: input.daysUntilExpiry,
          },
        };

        await notificationService.createNotification(managerInput);
      }
    }
  } catch (error) {
    console.error('[Notifications] Error in notifyLeaseExpiring:', error);
  }
}
