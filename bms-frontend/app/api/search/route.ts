import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
import { getDb } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');

    if (!query || query.trim().length === 0) {
      return NextResponse.json({ results: [] });
    }

    const db = await getDb();
    const organizationId = context.organizationId;
    const searchRegex = new RegExp(query, 'i');

    const results: Array<{
      id: string;
      type: string;
      title: string;
      subtitle: string;
      path: string;
    }> = [];

    // Search buildings
    const buildings = await db
      .collection('buildings')
      .find({
        ...(organizationId && { organizationId }),
        $or: [{ name: searchRegex }, { address: searchRegex }],
      })
      .limit(5)
      .toArray();

    buildings.forEach((building) => {
      results.push({
        id: building._id.toString(),
        type: 'building',
        title: building.name || 'Unnamed Building',
        subtitle: building.address || '',
        path: `/org/buildings/${building._id}`,
      });
    });

    // Search tenants
    const tenants = await db
      .collection('tenants')
      .find({
        ...(organizationId && { organizationId }),
        $or: [{ name: searchRegex }, { phone: searchRegex }, { email: searchRegex }],
      })
      .limit(5)
      .toArray();

    tenants.forEach((tenant) => {
      results.push({
        id: tenant._id.toString(),
        type: 'tenant',
        title: tenant.name || 'Unnamed Tenant',
        subtitle: tenant.phone || tenant.email || '',
        path: `/org/tenants/${tenant._id}`,
      });
    });

    // Search invoices
    const invoices = await db
      .collection('invoices')
      .find({
        ...(organizationId && { organizationId }),
        $or: [{ number: searchRegex }, { tenantId: searchRegex }],
      })
      .limit(5)
      .toArray();

    invoices.forEach((invoice) => {
      results.push({
        id: invoice._id.toString(),
        type: 'invoice',
        title: `Invoice ${invoice.number || invoice._id}`,
        subtitle: `ETB ${invoice.amount || 0}`,
        path: `/org/invoices/${invoice._id}`,
      });
    });

    // Search units
    const units = await db
      .collection('units')
      .find({
        ...(organizationId && { organizationId }),
        $or: [{ number: searchRegex }, { buildingId: searchRegex }],
      })
      .limit(5)
      .toArray();

    units.forEach((unit) => {
      results.push({
        id: unit._id.toString(),
        type: 'unit',
        title: `Unit ${unit.number || 'N/A'}`,
        subtitle: unit.buildingId || '',
        path: `/org/units/${unit._id}`,
      });
    });

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({ error: 'Failed to perform search' }, { status: 500 });
  }
}
