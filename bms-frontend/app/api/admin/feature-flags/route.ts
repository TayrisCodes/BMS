import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { isSuperAdmin } from '@/lib/auth/authz';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

const FEATURE_FLAGS_COLLECTION = 'featureFlags';

export interface FeatureFlag {
  _id?: string;
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  organizationId?: string | null; // null = global flag
  rolloutPercentage?: number; // 0-100 for gradual rollout
  createdAt: Date;
  updatedAt: Date;
}

export async function GET(request: NextRequest) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only SUPER_ADMIN can view feature flags
    if (!isSuperAdmin(context)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const db = await getDb();
    const searchParams = request.nextUrl.searchParams;
    const organizationId = searchParams.get('organizationId');

    const query: Record<string, unknown> = {};
    // If organizationId is provided, filter by it; otherwise return all flags
    if (organizationId) {
      query.organizationId = organizationId;
    }
    // If organizationId is explicitly "null" or "global", only return global flags
    if (organizationId === 'null' || organizationId === 'global') {
      query.organizationId = null;
    }

    const flags = await db
      .collection<FeatureFlag>(FEATURE_FLAGS_COLLECTION)
      .find(query)
      .sort({ key: 1 })
      .toArray();

    return NextResponse.json({
      flags: flags.map((flag) => ({
        id: flag._id?.toString(),
        key: flag.key,
        name: flag.name,
        description: flag.description,
        enabled: flag.enabled,
        organizationId: flag.organizationId,
        rolloutPercentage: flag.rolloutPercentage || 100,
        createdAt: flag.createdAt,
        updatedAt: flag.updatedAt,
      })),
    });
  } catch (error) {
    console.error('Get feature flags error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    // Check if it's a MongoDB connection error
    if (
      errorMessage.includes('MongoServerSelectionError') ||
      errorMessage.includes('SSL') ||
      errorMessage.includes('connection')
    ) {
      return NextResponse.json(
        {
          error:
            'Database connection failed. Please check your MongoDB connection settings or try again later.',
          details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
        },
        { status: 503 },
      );
    }
    return NextResponse.json(
      {
        error: 'Failed to fetch feature flags',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only SUPER_ADMIN can manage feature flags
    if (!isSuperAdmin(context)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = (await request.json()) as {
      key: string;
      name: string;
      description: string;
      enabled: boolean;
      organizationId?: string | null;
      rolloutPercentage?: number;
    };

    if (!body.key || !body.name) {
      return NextResponse.json({ error: 'Key and name are required' }, { status: 400 });
    }

    const db = await getDb();
    const collection = db.collection<FeatureFlag>(FEATURE_FLAGS_COLLECTION);
    const now = new Date();

    // Check if flag already exists
    const existing = await collection.findOne({
      key: body.key,
      organizationId: body.organizationId || null,
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Feature flag with this key already exists' },
        { status: 400 },
      );
    }

    const flag: Omit<FeatureFlag, '_id'> = {
      key: body.key,
      name: body.name,
      description: body.description || '',
      enabled: body.enabled ?? false,
      organizationId: body.organizationId || null,
      rolloutPercentage: body.rolloutPercentage ?? 100,
      createdAt: now,
      updatedAt: now,
    };

    const result = await collection.insertOne(flag as any);

    return NextResponse.json(
      {
        message: 'Feature flag created successfully',
        flag: {
          id: result.insertedId.toString(),
          ...flag,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Create feature flag error:', error);
    return NextResponse.json({ error: 'Failed to create feature flag' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only SUPER_ADMIN can update feature flags
    if (!isSuperAdmin(context)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = (await request.json()) as {
      id: string;
      enabled?: boolean;
      rolloutPercentage?: number;
      name?: string;
      description?: string;
    };

    if (!body.id) {
      return NextResponse.json({ error: 'Flag ID is required' }, { status: 400 });
    }

    const db = await getDb();
    const collection = db.collection<FeatureFlag>(FEATURE_FLAGS_COLLECTION);
    const { ObjectId } = await import('mongodb');

    const updates: Partial<FeatureFlag> = {
      updatedAt: new Date(),
    };

    if (body.enabled !== undefined) {
      updates.enabled = body.enabled;
    }
    if (body.rolloutPercentage !== undefined) {
      updates.rolloutPercentage = body.rolloutPercentage;
    }
    if (body.name !== undefined) {
      updates.name = body.name;
    }
    if (body.description !== undefined) {
      updates.description = body.description;
    }

    const result = await collection.updateOne({ _id: new ObjectId(body.id) }, { $set: updates });

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Feature flag not found' }, { status: 404 });
    }

    const updated = await collection.findOne({ _id: new ObjectId(body.id) });

    return NextResponse.json({
      message: 'Feature flag updated successfully',
      flag: {
        id: updated?._id?.toString(),
        key: updated?.key,
        name: updated?.name,
        description: updated?.description,
        enabled: updated?.enabled,
        organizationId: updated?.organizationId,
        rolloutPercentage: updated?.rolloutPercentage,
      },
    });
  } catch (error) {
    console.error('Update feature flag error:', error);
    return NextResponse.json({ error: 'Failed to update feature flag' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only SUPER_ADMIN can delete feature flags
    if (!isSuperAdmin(context)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Flag ID is required' }, { status: 400 });
    }

    const db = await getDb();
    const collection = db.collection<FeatureFlag>(FEATURE_FLAGS_COLLECTION);
    const { ObjectId } = await import('mongodb');

    const result = await collection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Feature flag not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Feature flag deleted successfully' });
  } catch (error) {
    console.error('Delete feature flag error:', error);
    return NextResponse.json({ error: 'Failed to delete feature flag' }, { status: 500 });
  }
}
