import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies, getCurrentUserFromCookies } from '@/lib/auth/session';
import {
  createVisitorQRCode,
  findVisitorQRCodesByTenant,
  type CreateVisitorQRCodeInput,
} from '@/lib/security/visitor-qr-codes';
import QRCode from 'qrcode';
import { findTenantById, findTenantByPhone } from '@/lib/tenants/tenants';
import { findBuildingById } from '@/lib/buildings/buildings';
import { findUnitById } from '@/lib/units/units';

/**
 * GET /api/visitor-qr-codes
 * List visitor QR codes for the current tenant.
 */
export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const includeUsed = searchParams.get('includeUsed') === 'true';

    const filters: Record<string, unknown> = {};
    if (!includeUsed) {
      filters.used = false;
    }

    const qrCodes = await findVisitorQRCodesByTenant(tenantId, organizationId, filters);

    // Get building and unit details for each QR code
    const qrCodesWithDetails = await Promise.all(
      qrCodes.map(async (qr) => {
        const building = await findBuildingById(qr.buildingId, organizationId);
        const unit = qr.unitId ? await findUnitById(qr.unitId, organizationId) : null;

        return {
          _id: qr._id,
          visitorName: qr.visitorName,
          visitorPhone: qr.visitorPhone,
          purpose: qr.purpose,
          vehiclePlateNumber: qr.vehiclePlateNumber,
          validFrom: qr.validFrom,
          validUntil: qr.validUntil,
          used: qr.used,
          usedAt: qr.usedAt,
          buildingName: building?.name || 'Unknown Building',
          unitNumber: unit?.unitNumber || null,
          createdAt: qr.createdAt,
        };
      }),
    );

    return NextResponse.json({
      qrCodes: qrCodesWithDetails,
      count: qrCodesWithDetails.length,
    });
  } catch (error) {
    console.error('Get visitor QR codes error:', error);
    return NextResponse.json({ error: 'Failed to fetch visitor QR codes' }, { status: 500 });
  }
}

/**
 * POST /api/visitor-qr-codes
 * Create a new visitor QR code.
 */
export async function POST(request: NextRequest) {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Only tenants can create QR codes
    if (!context.roles.includes('TENANT')) {
      return NextResponse.json(
        { error: 'Only tenants can create visitor QR codes' },
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

    const body = (await request.json()) as Partial<CreateVisitorQRCodeInput>;

    // Validate required fields
    if (!body.buildingId || !body.visitorName || !body.purpose || !body.validUntil) {
      return NextResponse.json(
        {
          error: 'buildingId, visitorName, purpose, and validUntil are required',
        },
        { status: 400 },
      );
    }

    // Parse validUntil date
    const validUntil = new Date(body.validUntil);
    if (isNaN(validUntil.getTime())) {
      return NextResponse.json({ error: 'validUntil must be a valid date' }, { status: 400 });
    }

    // Create QR code
    const input: CreateVisitorQRCodeInput = {
      organizationId,
      tenantId,
      buildingId: body.buildingId,
      unitId: body.unitId ?? null,
      visitorName: body.visitorName,
      visitorPhone: body.visitorPhone ?? null,
      visitorIdNumber: body.visitorIdNumber ?? null,
      purpose: body.purpose,
      vehiclePlateNumber: body.vehiclePlateNumber ?? null,
      ...(body.validFrom && { validFrom: new Date(body.validFrom) }),
      validUntil,
    };

    try {
      const qrCode = await createVisitorQRCode(input);

      // Generate QR code image
      const qrCodeData = JSON.stringify({
        qrCode: qrCode.qrCode,
        visitorName: qrCode.visitorName,
        purpose: qrCode.purpose,
        validUntil: qrCode.validUntil.toISOString(),
      });

      const qrCodeImage = await QRCode.toDataURL(qrCodeData, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        width: 300,
        margin: 1,
      });

      // Get building and unit details
      const building = await findBuildingById(qrCode.buildingId, organizationId);
      const unit = qrCode.unitId ? await findUnitById(qrCode.unitId, organizationId) : null;

      return NextResponse.json(
        {
          message: 'Visitor QR code created successfully',
          qrCode: {
            _id: qrCode._id,
            visitorName: qrCode.visitorName,
            visitorPhone: qrCode.visitorPhone,
            visitorIdNumber: qrCode.visitorIdNumber,
            purpose: qrCode.purpose,
            vehiclePlateNumber: qrCode.vehiclePlateNumber,
            validFrom: qrCode.validFrom,
            validUntil: qrCode.validUntil,
            qrCode: qrCode.qrCode,
            qrCodeImage, // Base64 encoded QR code image
            buildingName: building?.name || 'Unknown Building',
            unitNumber: unit?.unitNumber || null,
            createdAt: qrCode.createdAt,
          },
        },
        { status: 201 },
      );
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return NextResponse.json({ error: error.message }, { status: 404 });
        }
        if (error.message.includes('does not belong')) {
          return NextResponse.json({ error: error.message }, { status: 403 });
        }
        if (error.message.includes('required')) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
        if (error.message.includes('must be')) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
        if (error.message.includes('Failed to generate')) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
      }
      throw error;
    }
  } catch (error) {
    console.error('Create visitor QR code error:', error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: 'Failed to create visitor QR code' }, { status: 500 });
  }
}
