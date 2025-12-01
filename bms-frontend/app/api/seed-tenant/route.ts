import { NextResponse } from 'next/server';
import { getTenantsCollection } from '@/lib/tenants/tenants';
import type { Document } from 'mongodb';

export async function POST() {
  try {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Not allowed in production' }, { status: 403 });
    }

    const organizationId = process.env.INIT_ORG_ID ?? 'dev-org-1';
    const phone = process.env.INIT_TENANT_PHONE ?? '+251912345678';

    const collection = await getTenantsCollection();

    const existing = await collection.findOne({
      organizationId,
      primaryPhone: phone,
    } as Document);

    if (existing) {
      return NextResponse.json(
        {
          message: 'Tenant already exists',
          phone: existing.primaryPhone,
          organizationId: existing.organizationId,
        },
        { status: 200 },
      );
    }

    const now = new Date();
    const tenant = {
      organizationId,
      primaryPhone: phone,
      email: null,
      nationalId: null,
      language: 'en',
      status: 'active' as const,
      createdAt: now,
      updatedAt: now,
    };

    const result = await collection.insertOne(tenant as any);

    return NextResponse.json(
      {
        message: 'Tenant seeded',
        phone: tenant.primaryPhone,
        organizationId: tenant.organizationId,
        tenantId: result.insertedId.toString(),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Seed tenant error', error);
    return NextResponse.json({ error: 'Unexpected error while seeding tenant' }, { status: 500 });
  }
}
