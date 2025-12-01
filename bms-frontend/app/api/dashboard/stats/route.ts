import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
import { isSuperAdmin } from '@/lib/auth/authz';
import { getDb } from '@/lib/db';
import { findBuildingsByOrganization } from '@/lib/buildings/buildings';
import { listTenants } from '@/lib/tenants/tenants';
import { listUnits } from '@/lib/units/units';
import { listInvoices } from '@/lib/invoices/invoices';
import { listPayments } from '@/lib/payments/payments';
import { listComplaints } from '@/lib/complaints/complaints';
import { findActiveLeaseForUnit } from '@/lib/leases/leases';

export async function GET() {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = await getDb();

    if (isSuperAdmin(context)) {
      // SUPER_ADMIN sees cross-org stats
      const [organizations, buildings, tenants, users] = await Promise.all([
        db.collection('organizations').countDocuments({}),
        db.collection('buildings').countDocuments({}),
        db.collection('tenants').countDocuments({}),
        db.collection('users').countDocuments({}),
      ]);

      return NextResponse.json({
        stats: {
          totalOrganizations: organizations,
          totalBuildings: buildings,
          totalTenants: tenants,
          totalUsers: users,
          systemHealth: 'healthy',
        },
      });
    } else {
      // Org-scoped stats
      const organizationId = context.organizationId;
      if (!organizationId) {
        return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
      }

      // Use the new collection functions for proper org scoping
      const [buildings, tenants, units, unpaidInvoices] = await Promise.all([
        findBuildingsByOrganization(organizationId),
        listTenants({ organizationId }),
        listUnits({ organizationId }),
        listInvoices({ organizationId, status: { $in: ['sent', 'overdue'] } }),
      ]);

      // Calculate stats
      let occupiedUnits = 0;
      for (const unit of units) {
        if (unit.status === 'occupied') {
          // Double-check by finding active lease
          const activeLease = await findActiveLeaseForUnit(unit._id, organizationId);
          if (activeLease) {
            occupiedUnits += 1;
          }
        }
      }

      const totalUnits = units.length;
      const vacancyRate = totalUnits > 0 ? ((totalUnits - occupiedUnits) / totalUnits) * 100 : 0;

      // Calculate total revenue from completed payments
      const completedPayments = await listPayments({
        organizationId,
        status: 'completed',
      });
      const totalRevenue = completedPayments.reduce((sum, payment) => sum + payment.amount, 0);

      // Calculate outstanding receivables from unpaid invoices
      const outstandingReceivables = unpaidInvoices.reduce((sum, inv) => sum + inv.total, 0);

      // Get pending complaints
      const complaints = await listComplaints({ organizationId });
      const pendingComplaints = complaints.filter(
        (c) => c.status !== 'resolved' && c.status !== 'closed',
      ).length;

      return NextResponse.json({
        stats: {
          totalBuildings: buildings.length,
          totalUnits,
          occupiedUnits,
          vacancyRate: Math.round(vacancyRate * 100) / 100,
          totalRevenue,
          outstandingReceivables,
          pendingComplaints,
        },
      });
    }
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard stats' }, { status: 500 });
  }
}
