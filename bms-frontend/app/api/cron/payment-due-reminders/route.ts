import { NextResponse } from 'next/server';
import { processPaymentReminders } from '@/modules/notifications/payment-reminders';
import { listOrganizations } from '@/lib/organizations/organizations';

export const dynamic = 'force-dynamic';

/**
 * Scheduled job for payment due reminders.
 * This endpoint should be called by a cron service (e.g., Vercel Cron, external scheduler).
 *
 * Uses organization-specific payment reminder settings to send reminders.
 * Processes reminders for all active organizations.
 */
export async function GET(request: Request) {
  try {
    // Verify this is a cron request (add authentication header check in production)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all active organizations
    // Note: You may need to implement listOrganizations or get organizations differently
    const organizations = await listOrganizations({ status: 'active' });

    let totalRemindersSent = 0;
    const allErrors: Array<{ organizationId: string; errors: string[] }> = [];

    // Process reminders for each organization
    for (const org of organizations) {
      try {
        const result = await processPaymentReminders(org._id);
        totalRemindersSent += result.remindersSent;
        if (result.errors.length > 0) {
          allErrors.push({
            organizationId: org._id,
            errors: result.errors,
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(
          `[PaymentDueReminders] Error processing reminders for organization ${org._id}:`,
          error,
        );
        allErrors.push({
          organizationId: org._id,
          errors: [errorMessage],
        });
      }
    }

    return NextResponse.json({
      success: true,
      remindersSent: totalRemindersSent,
      organizationsProcessed: organizations.length,
      errors: allErrors.length > 0 ? allErrors : undefined,
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
