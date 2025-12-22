import {
  generateInvoicesForLeases,
  type GenerateInvoicesOptions,
  type GenerateInvoiceResult,
} from './invoice-generation';
import { sendInvoiceToTenant } from '@/modules/notifications/invoice-sender';
import {
  getOrganizationsCollection,
  findOrganizationById,
  type Organization,
} from '@/lib/organizations/organizations';

export interface MonthlyInvoiceGenerationOptions {
  organizationId?: string | undefined; // If provided, only generate for this organization
  periodStart?: Date | undefined; // If not provided, uses current month start
  periodEnd?: Date | undefined; // If not provided, uses current month end
  autoSend?: boolean | undefined; // Auto-send invoices to tenants (default: true)
  forceRegenerate?: boolean | undefined; // Force regenerate even if invoice exists (default: false)
}

export interface MonthlyInvoiceGenerationResult {
  organizationId: string;
  organizationName?: string;
  periodStart: Date;
  periodEnd: Date;
  results: GenerateInvoiceResult[];
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
  sentCount: number;
  sentErrors: number;
}

/**
 * Generates monthly invoices for all active leases in an organization.
 * Automatically sends invoices to tenants if autoSend is true.
 *
 * @param options - Generation options
 * @returns Generation results with send status
 */
export async function generateMonthlyInvoices(
  options: MonthlyInvoiceGenerationOptions = {},
): Promise<MonthlyInvoiceGenerationResult[]> {
  const {
    organizationId,
    periodStart,
    periodEnd,
    autoSend = true,
    forceRegenerate = false,
  } = options;

  // Calculate period (default to current month)
  const now = new Date();
  const calculatedPeriodStart = periodStart || new Date(now.getFullYear(), now.getMonth(), 1);
  const calculatedPeriodEnd =
    periodEnd || new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  // Determine which organizations to process
  let organizations: Array<{ _id: string; name?: string }> = [];

  if (organizationId) {
    // Single organization
    const org = await findOrganizationById(organizationId);
    if (org) {
      organizations = [{ _id: org._id, name: org.name }];
    }
  } else {
    // All active organizations
    const collection = await getOrganizationsCollection();
    const allOrgs = await collection.find({ status: { $in: ['active', null] } }).toArray();
    organizations = allOrgs.map((org) => ({
      _id: org._id.toString(),
      name: org.name,
    }));
  }

  const allResults: MonthlyInvoiceGenerationResult[] = [];

  // Process each organization
  for (const org of organizations) {
    try {
      console.log(`[Scheduled Invoice Generation] Processing organization: ${org._id}`);

      // Generate invoices for this organization
      const results = await generateInvoicesForLeases({
        organizationId: org._id,
        periodStart: calculatedPeriodStart,
        periodEnd: calculatedPeriodEnd,
        forceRegenerate,
      });

      // Auto-send invoices if enabled
      let sentCount = 0;
      let sentErrors = 0;

      if (autoSend) {
        for (const result of results) {
          if (result.success && result.invoiceId) {
            try {
              // Get tenantId from the lease (we need to fetch it)
              const { findLeaseById } = await import('@/lib/leases/leases');
              const { findInvoiceById } = await import('@/lib/invoices/invoices');

              const invoice = await findInvoiceById(result.invoiceId, org._id);
              if (invoice) {
                const sendResult = await sendInvoiceToTenant({
                  invoiceId: result.invoiceId,
                  organizationId: org._id,
                  tenantId: invoice.tenantId,
                  channels: ['in_app', 'sms'],
                });

                if (sendResult.success) {
                  sentCount++;
                } else {
                  sentErrors++;
                  console.warn(
                    `[Scheduled Invoice Generation] Failed to send invoice ${result.invoiceId}:`,
                    sendResult.errors,
                  );
                }
              }
            } catch (sendError) {
              sentErrors++;
              console.error(
                `[Scheduled Invoice Generation] Error sending invoice ${result.invoiceId}:`,
                sendError,
              );
            }
          }
        }
      }

      const successCount = results.filter((r) => r.success).length;
      const errorCount = results.filter((r) => !r.success).length;

      allResults.push({
        organizationId: org._id,
        ...(org.name ? { organizationName: org.name } : {}),
        periodStart: calculatedPeriodStart,
        periodEnd: calculatedPeriodEnd,
        results,
        summary: {
          total: results.length,
          successful: successCount,
          failed: errorCount,
        },
        sentCount,
        sentErrors,
      });

      console.log(
        `[Scheduled Invoice Generation] Completed for organization ${org._id}: ${successCount} invoices generated, ${sentCount} sent`,
      );
    } catch (error) {
      console.error(
        `[Scheduled Invoice Generation] Error processing organization ${org._id}:`,
        error,
      );
      // Continue with other organizations even if one fails
      allResults.push({
        organizationId: org._id,
        ...(org.name ? { organizationName: org.name } : {}),
        periodStart: calculatedPeriodStart,
        periodEnd: calculatedPeriodEnd,
        results: [],
        summary: {
          total: 0,
          successful: 0,
          failed: 1,
        },
        sentCount: 0,
        sentErrors: 0,
      });
    }
  }

  return allResults;
}
