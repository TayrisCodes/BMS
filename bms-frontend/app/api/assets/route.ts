import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { withOrganizationScope } from '@/lib/organizations/scoping';
import {
  getAssetsCollection,
  createAsset,
  listAssets,
  type CreateAssetInput,
} from '@/lib/assets/assets';

/**
 * GET /api/assets
 * List assets with optional filters.
 * Requires assets.read permission.
 */
export async function GET(request: Request) {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to read assets
    requirePermission(context, 'assets', 'read');

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const assetType = searchParams.get('assetType');
    const buildingId = searchParams.get('buildingId');
    const unitId = searchParams.get('unitId');
    const search = searchParams.get('search'); // For name search

    // Build query with organization scope
    const baseQuery: Record<string, unknown> = withOrganizationScope(context, {});

    // Add filters
    if (status) {
      baseQuery.status = status;
    }

    if (assetType) {
      baseQuery.assetType = assetType;
    }

    if (buildingId) {
      baseQuery.buildingId = buildingId;
    }

    if (unitId) {
      baseQuery.unitId = unitId;
    }

    // Search by name
    if (search) {
      baseQuery.name = { $regex: search.trim(), $options: 'i' };
    }

    const assets = await listAssets(baseQuery);

    return NextResponse.json({
      assets: assets.map((a) => ({
        _id: a._id,
        organizationId: a.organizationId,
        buildingId: a.buildingId,
        unitId: a.unitId,
        name: a.name,
        description: a.description,
        assetType: a.assetType,
        status: a.status,
        serialNumber: a.serialNumber,
        model: a.model,
        manufacturer: a.manufacturer,
        purchaseDate: a.purchaseDate,
        purchasePrice: a.purchasePrice,
        currentValue: a.currentValue,
        location: a.location,
        maintenanceSchedule: a.maintenanceSchedule,
        depreciation: a.depreciation,
        notes: a.notes,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      })),
      count: assets.length,
    });
  } catch (error) {
    console.error('Get assets error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
      if (error.message.includes('Organization ID is required')) {
        return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
      }
    }
    return NextResponse.json({ error: 'Unexpected error while fetching assets' }, { status: 500 });
  }
}

/**
 * POST /api/assets
 * Create a new asset.
 * Requires assets.create permission.
 */
export async function POST(request: Request) {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to create assets
    requirePermission(context, 'assets', 'create');

    const organizationId = context.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    const body = (await request.json()) as Partial<CreateAssetInput>;

    // Validate required fields
    if (!body.name || !body.assetType || !body.buildingId) {
      return NextResponse.json(
        { error: 'name, assetType, and buildingId are required' },
        { status: 400 },
      );
    }

    // Create asset
    const input: CreateAssetInput = {
      organizationId,
      buildingId: body.buildingId,
      unitId: body.unitId ?? null,
      name: body.name,
      description: body.description ?? null,
      assetType: body.assetType,
      status: body.status ?? 'active',
      serialNumber: body.serialNumber ?? null,
      model: body.model ?? null,
      manufacturer: body.manufacturer ?? null,
      purchaseDate: body.purchaseDate ? new Date(body.purchaseDate) : null,
      purchasePrice: body.purchasePrice ?? null,
      currentValue: body.currentValue ?? null,
      location: body.location ?? null,
      warranty: body.warranty ?? null,
      maintenanceSchedule: body.maintenanceSchedule ?? null,
      depreciation: body.depreciation ?? null,
      installationDate: body.installationDate ? new Date(body.installationDate) : null,
      supplier: body.supplier ?? null,
      supplierContact: body.supplierContact ?? null,
      notes: body.notes ?? null,
    };

    const asset = await createAsset(input);

    return NextResponse.json(
      {
        message: 'Asset created successfully',
        asset: {
          _id: asset._id,
          organizationId: asset.organizationId,
          buildingId: asset.buildingId,
          unitId: asset.unitId,
          name: asset.name,
          description: asset.description,
          assetType: asset.assetType,
          status: asset.status,
          serialNumber: asset.serialNumber,
          model: asset.model,
          manufacturer: asset.manufacturer,
          purchaseDate: asset.purchaseDate,
          purchasePrice: asset.purchasePrice,
          currentValue: asset.currentValue,
          location: asset.location,
          warranty: asset.warranty,
          maintenanceSchedule: asset.maintenanceSchedule,
          depreciation: asset.depreciation,
          installationDate: asset.installationDate,
          supplier: asset.supplier,
          supplierContact: asset.supplierContact,
          notes: asset.notes,
          createdAt: asset.createdAt,
          updatedAt: asset.updatedAt,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Create asset error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
    }
    return NextResponse.json({ error: 'Unexpected error while creating asset' }, { status: 500 });
  }
}
