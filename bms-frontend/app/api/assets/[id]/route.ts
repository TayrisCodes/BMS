import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { validateOrganizationAccess } from '@/lib/organizations/scoping';
import { findAssetById, updateAsset, deleteAsset, type Asset } from '@/lib/assets/assets';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/assets/[id]
 * Get a single asset by ID.
 * Requires assets.read permission.
 */
export async function GET(request: Request, routeParams: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    const { id } = await routeParams.params;

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to read assets
    requirePermission(context, 'assets', 'read');

    const asset = await findAssetById(id, context.organizationId || undefined);

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    // Validate organization access
    validateOrganizationAccess(context, asset.organizationId);

    return NextResponse.json({
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
    });
  } catch (error) {
    console.error('Get asset error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
      if (error.message.includes('does not have an organization ID')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('belongs to a different organization')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }
    return NextResponse.json({ error: 'Unexpected error while fetching asset' }, { status: 500 });
  }
}

/**
 * PATCH /api/assets/[id]
 * Update an asset.
 * Requires assets.update permission.
 */
export async function PATCH(request: Request, routeParams: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    const { id } = await routeParams.params;

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to update assets
    requirePermission(context, 'assets', 'update');

    // Get existing asset to validate organization access
    const existingAsset = await findAssetById(id, context.organizationId || undefined);

    if (!existingAsset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    // Validate organization access
    validateOrganizationAccess(context, existingAsset.organizationId);

    const body = (await request.json()) as Partial<Asset>;

    // Remove fields that shouldn't be updated directly
    const updates: Partial<Asset> = {
      ...body,
    };
    delete updates._id;
    delete updates.organizationId;
    delete updates.createdAt;

    // Convert date strings to Date objects if present
    if (updates.purchaseDate && typeof updates.purchaseDate === 'string') {
      updates.purchaseDate = new Date(updates.purchaseDate);
    }
    if (updates.installationDate && typeof updates.installationDate === 'string') {
      updates.installationDate = new Date(updates.installationDate);
    }
    if (updates.warranty?.startDate && typeof updates.warranty.startDate === 'string') {
      updates.warranty.startDate = new Date(updates.warranty.startDate);
    }
    if (updates.warranty?.endDate && typeof updates.warranty.endDate === 'string') {
      updates.warranty.endDate = new Date(updates.warranty.endDate);
    }
    if (
      updates.depreciation?.depreciationStartDate &&
      typeof updates.depreciation.depreciationStartDate === 'string'
    ) {
      updates.depreciation.depreciationStartDate = new Date(
        updates.depreciation.depreciationStartDate,
      );
    }
    if (
      updates.maintenanceSchedule?.lastMaintenanceDate &&
      typeof updates.maintenanceSchedule.lastMaintenanceDate === 'string'
    ) {
      updates.maintenanceSchedule.lastMaintenanceDate = new Date(
        updates.maintenanceSchedule.lastMaintenanceDate,
      );
    }
    if (
      updates.maintenanceSchedule?.nextMaintenanceDate &&
      typeof updates.maintenanceSchedule.nextMaintenanceDate === 'string'
    ) {
      updates.maintenanceSchedule.nextMaintenanceDate = new Date(
        updates.maintenanceSchedule.nextMaintenanceDate,
      );
    }

    const updatedAsset = await updateAsset(id, updates);

    if (!updatedAsset) {
      return NextResponse.json({ error: 'Failed to update asset' }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Asset updated successfully',
      asset: {
        _id: updatedAsset._id,
        organizationId: updatedAsset.organizationId,
        buildingId: updatedAsset.buildingId,
        unitId: updatedAsset.unitId,
        name: updatedAsset.name,
        description: updatedAsset.description,
        assetType: updatedAsset.assetType,
        status: updatedAsset.status,
        serialNumber: updatedAsset.serialNumber,
        model: updatedAsset.model,
        manufacturer: updatedAsset.manufacturer,
        purchaseDate: updatedAsset.purchaseDate,
        purchasePrice: updatedAsset.purchasePrice,
        currentValue: updatedAsset.currentValue,
        location: updatedAsset.location,
        warranty: updatedAsset.warranty,
        maintenanceSchedule: updatedAsset.maintenanceSchedule,
        depreciation: updatedAsset.depreciation,
        installationDate: updatedAsset.installationDate,
        supplier: updatedAsset.supplier,
        supplierContact: updatedAsset.supplierContact,
        notes: updatedAsset.notes,
        createdAt: updatedAsset.createdAt,
        updatedAt: updatedAsset.updatedAt,
      },
    });
  } catch (error) {
    console.error('Update asset error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
      if (error.message.includes('does not have an organization ID')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('belongs to a different organization')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }
    return NextResponse.json({ error: 'Unexpected error while updating asset' }, { status: 500 });
  }
}

/**
 * DELETE /api/assets/[id]
 * Soft delete an asset (sets status to disposed).
 * Requires assets.delete permission.
 */
export async function DELETE(request: Request, routeParams: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    const { id } = await routeParams.params;

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to delete assets
    requirePermission(context, 'assets', 'delete');

    // Get existing asset to validate organization access
    const existingAsset = await findAssetById(id, context.organizationId || undefined);

    if (!existingAsset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    // Validate organization access
    validateOrganizationAccess(context, existingAsset.organizationId);

    const deleted = await deleteAsset(id);

    if (!deleted) {
      return NextResponse.json({ error: 'Failed to delete asset' }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Asset deleted successfully (soft delete - status set to disposed)',
    });
  } catch (error) {
    console.error('Delete asset error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
      if (error.message.includes('does not have an organization ID')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('belongs to a different organization')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }
    return NextResponse.json({ error: 'Unexpected error while deleting asset' }, { status: 500 });
  }
}
