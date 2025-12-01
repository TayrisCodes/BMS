/**
 * Index initialization utility.
 * Call this on app startup or via API route to ensure all database indexes are created.
 */
import { ensureOrganizationIndexes } from '@/lib/organizations/organizations';
import { ensureUserIndexes } from '@/lib/auth/users';
import { ensureOtpIndexes } from '@/lib/auth/otp';
import { ensureTenantIndexes } from '@/lib/tenants/tenants';
import { ensureBuildingIndexes } from '@/lib/buildings/buildings';
import { ensureUnitIndexes } from '@/lib/units/units';
import { ensureLeaseIndexes } from '@/lib/leases/leases';
import { ensureInvoiceIndexes } from '@/lib/invoices/invoices';
import { ensurePaymentIndexes } from '@/lib/payments/payments';
import { ensureComplaintIndexes } from '@/lib/complaints/complaints';
import { ensureWorkOrderIndexes } from '@/lib/work-orders/work-orders';
import { ensureMeterIndexes } from '@/lib/meters/meters';
import { ensureMeterReadingIndexes } from '@/lib/meter-readings/meter-readings';
import { ensureParkingSpaceIndexes } from '@/lib/parking/parking-spaces';
import { ensureVehicleIndexes } from '@/lib/parking/vehicles';
import { ensureVisitorLogIndexes } from '@/lib/security/visitor-logs';
import { ensureVisitorQRCodeIndexes } from '@/lib/security/visitor-qr-codes';
import { ensurePaymentIntentIndexes } from '@/modules/payments/payment-intent';
import { ensureNotificationIndexes } from '@/lib/notifications/notifications';

/**
 * Ensures all database indexes are created.
 * This should be called on app startup or via a seed/initialization script.
 */
export async function ensureAllIndexes(): Promise<void> {
  try {
    console.log('Ensuring database indexes...');

    await Promise.all([
      ensureOrganizationIndexes(),
      ensureUserIndexes(),
      ensureOtpIndexes(),
      ensureTenantIndexes(),
      ensureBuildingIndexes(),
      ensureUnitIndexes(),
      ensureLeaseIndexes(),
      ensureInvoiceIndexes(),
      ensurePaymentIndexes(),
      ensureComplaintIndexes(),
      ensureWorkOrderIndexes(),
      ensureMeterIndexes(),
      ensureMeterReadingIndexes(),
      ensureParkingSpaceIndexes(),
      ensureVehicleIndexes(),
      ensureVisitorLogIndexes(),
      ensureVisitorQRCodeIndexes(),
      ensurePaymentIntentIndexes(),
      ensureNotificationIndexes(),
      // Add more index functions here as collections are implemented
      // etc.
    ]);

    console.log('All database indexes ensured successfully.');
  } catch (error) {
    console.error('Error ensuring database indexes:', error);
    throw error;
  }
}
