import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import {
  validateVisitorQRCode,
  markQRCodeAsUsed,
  findVisitorQRCodeByCode,
} from '@/lib/security/visitor-qr-codes';
import { createVisitorLog, type CreateVisitorLogInput } from '@/lib/security/visitor-logs';

/**
 * POST /api/visitor-qr-codes/validate
 * Validate a QR code and auto-log visitor entry.
 * Requires SECURITY role or permission.
 */
export async function POST(request: NextRequest) {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require SECURITY role or permission
    try {
      requirePermission(context, 'security', 'create');
    } catch {
      if (!context.roles.includes('SECURITY') && !context.roles.includes('ORG_ADMIN')) {
        return NextResponse.json(
          { error: 'Only security staff can validate QR codes' },
          { status: 403 },
        );
      }
    }

    const organizationId = context.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    const userId = context.userId;
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 401 });
    }

    const body = (await request.json()) as { qrCode: string };

    if (!body.qrCode) {
      return NextResponse.json({ error: 'qrCode is required' }, { status: 400 });
    }

    // Validate QR code
    const qrCodeDoc = await validateVisitorQRCode(body.qrCode);

    if (!qrCodeDoc) {
      return NextResponse.json(
        {
          error: 'Invalid QR code',
          details: 'QR code not found, expired, already used, or not yet valid',
        },
        { status: 400 },
      );
    }

    // Check organization match
    if (qrCodeDoc.organizationId !== organizationId) {
      return NextResponse.json(
        { error: 'QR code does not belong to this organization' },
        { status: 403 },
      );
    }

    // Create visitor log entry
    const visitorLogInput: CreateVisitorLogInput = {
      organizationId: qrCodeDoc.organizationId,
      buildingId: qrCodeDoc.buildingId,
      visitorName: qrCodeDoc.visitorName,
      visitorPhone: qrCodeDoc.visitorPhone ?? null,
      visitorIdNumber: qrCodeDoc.visitorIdNumber ?? null,
      hostTenantId: qrCodeDoc.tenantId,
      hostUnitId: qrCodeDoc.unitId ?? null,
      purpose: qrCodeDoc.purpose,
      vehiclePlateNumber: qrCodeDoc.vehiclePlateNumber ?? null,
      parkingSpaceId: null, // Can be assigned later
      entryTime: new Date(),
      loggedBy: userId,
      notes: `Auto-logged via QR code: ${qrCodeDoc.qrCode}`,
    };

    try {
      const visitorLog = await createVisitorLog(visitorLogInput);

      // Mark QR code as used
      await markQRCodeAsUsed(qrCodeDoc._id, visitorLog._id);

      // Send visitor arrival notification to tenant
      try {
        const { notifyVisitorArrived } = await import('@/modules/notifications/security-events');
        await notifyVisitorArrived(
          qrCodeDoc.tenantId,
          qrCodeDoc.organizationId,
          visitorLog.visitorName,
          visitorLog.visitorPhone || null,
          unit?.unitNumber || null,
          unit?.floor || null,
          building?.name || 'Building',
          visitorLog.entryTime,
        );
      } catch (error) {
        console.error('Failed to send visitor arrival notification:', error);
        // Don't fail the request if notification fails
      }

      // Get tenant, unit, and building details for response
      const { findTenantById } = await import('@/lib/tenants/tenants');
      const { findUnitById } = await import('@/lib/units/units');
      const { findBuildingById } = await import('@/lib/buildings/buildings');
      const tenant = await findTenantById(qrCodeDoc.tenantId, qrCodeDoc.organizationId);
      const unit = qrCodeDoc.unitId
        ? await findUnitById(qrCodeDoc.unitId, qrCodeDoc.organizationId)
        : null;
      const building = await findBuildingById(qrCodeDoc.buildingId, qrCodeDoc.organizationId);

      return NextResponse.json(
        {
          message: 'QR code validated and visitor logged successfully',
          visitorLog: {
            _id: visitorLog._id,
            visitorName: visitorLog.visitorName,
            visitorPhone: visitorLog.visitorPhone,
            purpose: visitorLog.purpose,
            entryTime: visitorLog.entryTime,
            hostTenantId: visitorLog.hostTenantId,
            hostUnitId: visitorLog.hostUnitId,
          },
          qrCode: {
            _id: qrCodeDoc._id,
            used: true,
            usedAt: new Date(),
          },
          // Tenant details
          tenant: tenant
            ? {
                _id: tenant._id,
                firstName: tenant.firstName,
                lastName: tenant.lastName,
                primaryPhone: tenant.primaryPhone,
              }
            : null,
          // Unit and building details
          unit: unit
            ? {
                _id: unit._id,
                unitNumber: unit.unitNumber,
                floor: unit.floor,
                unitType: unit.unitType,
              }
            : null,
          building: building
            ? {
                _id: building._id,
                name: building.name,
                address: building.address,
              }
            : null,
        },
        { status: 200 },
      );
    } catch (error) {
      console.error('Error creating visitor log from QR code:', error);
      if (error instanceof Error) {
        return NextResponse.json(
          { error: `Failed to create visitor log: ${error.message}` },
          { status: 500 },
        );
      }
      return NextResponse.json({ error: 'Failed to create visitor log' }, { status: 500 });
    }
  } catch (error) {
    console.error('Validate visitor QR code error:', error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: 'Failed to validate QR code' }, { status: 500 });
  }
}

/**
 * GET /api/visitor-qr-codes/validate?qrCode=...
 * Get QR code information without logging entry (for preview/check).
 */
export async function GET(request: Request) {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require SECURITY role or permission
    try {
      requirePermission(context, 'security', 'read');
    } catch {
      if (!context.roles.includes('SECURITY') && !context.roles.includes('ORG_ADMIN')) {
        return NextResponse.json(
          { error: 'Only security staff can view QR code details' },
          { status: 403 },
        );
      }
    }

    const { searchParams } = new URL(request.url);
    const qrCode = searchParams.get('qrCode');

    if (!qrCode) {
      return NextResponse.json({ error: 'qrCode parameter is required' }, { status: 400 });
    }

    const qrCodeDoc = await findVisitorQRCodeByCode(qrCode);

    if (!qrCodeDoc) {
      return NextResponse.json({ error: 'QR code not found' }, { status: 404 });
    }

    // Check organization match
    if (qrCodeDoc.organizationId !== context.organizationId) {
      return NextResponse.json(
        { error: 'QR code does not belong to this organization' },
        { status: 403 },
      );
    }

    // Check validity
    const now = new Date();
    const isValid = !qrCodeDoc.used && now >= qrCodeDoc.validFrom && now <= qrCodeDoc.validUntil;

    // Get tenant details
    const { findTenantById } = await import('@/lib/tenants/tenants');
    const tenant = await findTenantById(qrCodeDoc.tenantId, qrCodeDoc.organizationId);

    // Get unit and building details
    const { findUnitById } = await import('@/lib/units/units');
    const { findBuildingById } = await import('@/lib/buildings/buildings');
    const unit = qrCodeDoc.unitId
      ? await findUnitById(qrCodeDoc.unitId, qrCodeDoc.organizationId)
      : null;
    const building = await findBuildingById(qrCodeDoc.buildingId, qrCodeDoc.organizationId);

    return NextResponse.json({
      qrCode: {
        _id: qrCodeDoc._id,
        visitorName: qrCodeDoc.visitorName,
        visitorPhone: qrCodeDoc.visitorPhone,
        visitorIdNumber: qrCodeDoc.visitorIdNumber,
        purpose: qrCodeDoc.purpose,
        vehiclePlateNumber: qrCodeDoc.vehiclePlateNumber,
        validFrom: qrCodeDoc.validFrom,
        validUntil: qrCodeDoc.validUntil,
        used: qrCodeDoc.used,
        usedAt: qrCodeDoc.usedAt,
        isValid,
        // Tenant details
        tenant: tenant
          ? {
              _id: tenant._id,
              firstName: tenant.firstName,
              lastName: tenant.lastName,
              primaryPhone: tenant.primaryPhone,
            }
          : null,
        // Unit and building details
        unit: unit
          ? {
              _id: unit._id,
              unitNumber: unit.unitNumber,
              floor: unit.floor,
              unitType: unit.unitType,
            }
          : null,
        building: building
          ? {
              _id: building._id,
              name: building.name,
              address: building.address,
            }
          : null,
      },
    });
  } catch (error) {
    console.error('Get QR code details error:', error);
    return NextResponse.json({ error: 'Failed to get QR code details' }, { status: 500 });
  }
}
