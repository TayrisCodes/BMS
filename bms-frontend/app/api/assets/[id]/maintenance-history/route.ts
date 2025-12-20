import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { validateOrganizationAccess } from '@/lib/organizations/scoping';
import {
  findMaintenanceHistoryByAsset,
  createMaintenanceHistory,
  type CreateMaintenanceHistoryInput,
} from '@/lib/assets/maintenance-history';
import { findAssetById } from '@/lib/assets/assets';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/assets/[id]/maintenance-history
 * Get maintenance history for an asset.
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

    const organizationId = context.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    // Validate asset exists and belongs to organization
    const asset = await findAssetById(id, organizationId);
    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    validateOrganizationAccess(context, asset.organizationId);

    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;

    const history = await findMaintenanceHistoryByAsset(id, organizationId, limit);

    return NextResponse.json({
      history: history.map((h) => ({
        _id: h._id,
        assetId: h.assetId,
        workOrderId: h.workOrderId,
        maintenanceType: h.maintenanceType,
        performedBy: h.performedBy,
        performedDate: h.performedDate,
        description: h.description,
        cost: h.cost,
        partsUsed: h.partsUsed,
        downtimeHours: h.downtimeHours,
        notes: h.notes,
        nextMaintenanceDue: h.nextMaintenanceDue,
        createdAt: h.createdAt,
        updatedAt: h.updatedAt,
      })),
      count: history.length,
    });
  } catch (error) {
    console.error('Get maintenance history error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
    }
    return NextResponse.json(
      { error: 'Unexpected error while fetching maintenance history' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/assets/[id]/maintenance-history
 * Create a new maintenance history entry for an asset.
 * Requires assets.update permission.
 */
export async function POST(request: Request, routeParams: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    const { id } = await routeParams.params;

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to update assets
    requirePermission(context, 'assets', 'update');

    const organizationId = context.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    // Validate asset exists and belongs to organization
    const asset = await findAssetById(id, organizationId);
    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    validateOrganizationAccess(context, asset.organizationId);

    const body = (await request.json()) as Partial<CreateMaintenanceHistoryInput> & {
      performedDate?: string;
      nextMaintenanceDue?: string;
    };

    // Validate required fields
    if (!body.description || !body.maintenanceType) {
      return NextResponse.json(
        { error: 'description and maintenanceType are required' },
        { status: 400 },
      );
    }

    // Validate maintenance type
    const validTypes = ['preventive', 'corrective', 'emergency'];
    if (!validTypes.includes(body.maintenanceType)) {
      return NextResponse.json(
        { error: `maintenanceType must be one of: ${validTypes.join(', ')}` },
        { status: 400 },
      );
    }

    const input: CreateMaintenanceHistoryInput = {
      organizationId,
      assetId: id,
      workOrderId: body.workOrderId ?? null,
      maintenanceType: body.maintenanceType,
      performedBy: body.performedBy ?? context.userId ?? null,
      performedDate: body.performedDate || new Date(),
      description: body.description,
      cost: body.cost ?? null,
      partsUsed: body.partsUsed ?? null,
      downtimeHours: body.downtimeHours ?? null,
      notes: body.notes ?? null,
      nextMaintenanceDue: body.nextMaintenanceDue || null,
    };

    try {
      const history = await createMaintenanceHistory(input);

      return NextResponse.json(
        {
          message: 'Maintenance history created successfully',
          history: {
            _id: history._id,
            assetId: history.assetId,
            workOrderId: history.workOrderId,
            maintenanceType: history.maintenanceType,
            performedBy: history.performedBy,
            performedDate: history.performedDate,
            description: history.description,
            cost: history.cost,
            partsUsed: history.partsUsed,
            downtimeHours: history.downtimeHours,
            notes: history.notes,
            nextMaintenanceDue: history.nextMaintenanceDue,
            createdAt: history.createdAt,
            updatedAt: history.updatedAt,
          },
        },
        { status: 201 },
      );
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return NextResponse.json({ error: error.message }, { status: 404 });
        }
        if (error.message.includes('required')) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
      }
      throw error;
    }
  } catch (error) {
    console.error('Create maintenance history error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
    }
    return NextResponse.json(
      { error: 'Unexpected error while creating maintenance history' },
      { status: 500 },
    );
  }
}

