import { NextResponse } from 'next/server';
import { listInvoices } from '@/lib/invoices/invoices';

export const dynamic = 'force-dynamic';
import { notifyPaymentDue } from '@/modules/notifications/events';

/**
 * Scheduled job for payment due reminders.
 * This endpoint should be called by a cron service (e.g., Vercel Cron, external scheduler).
 *
 * Checks invoices due in 3 days and 1 day, and sends reminders to tenants.
 */
export async function GET(request: Request) {
  try {
    // Verify this is a cron request (add authentication header check in production)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const threeDaysFromNow = new Date(now);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    const oneDayFromNow = new Date(now);
    oneDayFromNow.setDate(oneDayFromNow.getDate() + 1);

    // Find invoices due in 3 days (within 3-4 day range to avoid duplicates)
    const threeDaysStart = new Date(threeDaysFromNow);
    threeDaysStart.setHours(0, 0, 0, 0);
    const threeDaysEnd = new Date(threeDaysFromNow);
    threeDaysEnd.setHours(23, 59, 59, 999);

    // Find invoices due in 1 day (within 1-2 day range)
    const oneDayStart = new Date(oneDayFromNow);
    oneDayStart.setHours(0, 0, 0, 0);
    const oneDayEnd = new Date(oneDayFromNow);
    oneDayEnd.setHours(23, 59, 59, 999);

    // Get all unpaid invoices due in 3 days
    const invoicesDueIn3Days = await listInvoices({
      status: { $in: ['sent', 'overdue'] },
      dueDate: {
        $gte: threeDaysStart,
        $lte: threeDaysEnd,
      },
    });

    // Get all unpaid invoices due in 1 day
    const invoicesDueIn1Day = await listInvoices({
      status: { $in: ['sent', 'overdue'] },
      dueDate: {
        $gte: oneDayStart,
        $lte: oneDayEnd,
      },
    });

    let remindersSent = 0;
    const errors: string[] = [];

    // Send 3-day reminders
    for (const invoice of invoicesDueIn3Days) {
      try {
        await notifyPaymentDue(invoice._id, invoice.organizationId, invoice.tenantId, 3);
        remindersSent++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Invoice ${invoice._id}: ${errorMessage}`);
        console.error(
          `[PaymentDueReminders] Error sending 3-day reminder for invoice ${invoice._id}:`,
          error,
        );
      }
    }

    // Send 1-day reminders
    for (const invoice of invoicesDueIn1Day) {
      try {
        await notifyPaymentDue(invoice._id, invoice.organizationId, invoice.tenantId, 1);
        remindersSent++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Invoice ${invoice._id}: ${errorMessage}`);
        console.error(
          `[PaymentDueReminders] Error sending 1-day reminder for invoice ${invoice._id}:`,
          error,
        );
      }
    }

    return NextResponse.json({
      success: true,
      remindersSent,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[PaymentDueReminders] Error in scheduled job:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
