import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies, getCurrentUserFromCookies } from '@/lib/auth/session';
import { findVisitorQRCodesByTenant } from '@/lib/security/visitor-qr-codes';
import { findTenantByPhone } from '@/lib/tenants/tenants';
import { findBuildingById } from '@/lib/buildings/buildings';
import { findUnitById } from '@/lib/units/units';
import { ObjectId } from 'mongodb';

/**
 * GET /api/visitor-qr-codes/[id]
 * Get a specific QR code by ID (for tenant to get share URL).
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Only tenants can view their own QR codes
    if (!context.roles.includes('TENANT')) {
      return NextResponse.json(
        { error: 'Only tenants can view visitor QR codes' },
        { status: 403 },
      );
    }

    const organizationId = context.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    // Get user to find tenant by phone
    const user = await getCurrentUserFromCookies();
    if (!user || !user.phone) {
      return NextResponse.json(
        { error: 'User not found or phone number missing' },
        { status: 404 },
      );
    }

    // Find tenant by phone
    const tenant = await findTenantByPhone(user.phone, organizationId);
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const tenantId = tenant._id.toString();
    const { id } = await params;

    // Get all QR codes for this tenant
    const qrCodes = await findVisitorQRCodesByTenant(tenantId, organizationId);

    // Find the specific QR code
    const qrCode = qrCodes.find((qr) => qr._id === id);

    if (!qrCode) {
      return NextResponse.json({ error: 'QR code not found' }, { status: 404 });
    }

    // Get building and unit details
    const building = await findBuildingById(qrCode.buildingId, organizationId);
    const unit = qrCode.unitId ? await findUnitById(qrCode.unitId, organizationId) : null;

    return NextResponse.json({
      qrCode: {
        _id: qrCode._id,
        qrCode: qrCode.qrCode, // The actual QR code token
        visitorName: qrCode.visitorName,
        visitorPhone: qrCode.visitorPhone,
        purpose: qrCode.purpose,
        validFrom: qrCode.validFrom,
        validUntil: qrCode.validUntil,
        used: qrCode.used,
        usedAt: qrCode.usedAt,
        buildingName: building?.name || 'Unknown Building',
        unitNumber: unit?.unitNumber || null,
        floor: unit?.floor || null,
      },
    });
  } catch (error) {
    console.error('Get visitor QR code error:', error);
    return NextResponse.json({ error: 'Failed to fetch QR code' }, { status: 500 });
  }
}
