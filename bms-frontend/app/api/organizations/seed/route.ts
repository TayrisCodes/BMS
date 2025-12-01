import { NextResponse } from 'next/server';
import {
  ensureOrganizationIndexes,
  createOrganization,
  findOrganizationByCode,
} from '@/lib/organizations/organizations';

export async function POST() {
  try {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Not allowed in production' }, { status: 403 });
    }

    await ensureOrganizationIndexes();

    const organizationCode = process.env.INIT_ORG_ID ?? 'dev-org-1';
    const organizationName = process.env.INIT_ORG_NAME ?? 'Development Organization';

    const existing = await findOrganizationByCode(organizationCode);
    if (existing) {
      return NextResponse.json(
        {
          message: 'Organization already exists',
          organizationId: existing._id,
          code: existing.code,
          name: existing.name,
        },
        { status: 200 },
      );
    }

    const contactInfo: { email?: string; phone?: string; address?: string } = {};
    if (process.env.INIT_ORG_EMAIL) {
      contactInfo.email = process.env.INIT_ORG_EMAIL;
    }
    if (process.env.INIT_ORG_PHONE) {
      contactInfo.phone = process.env.INIT_ORG_PHONE;
    }

    const organization = await createOrganization({
      name: organizationName,
      code: organizationCode,
      contactInfo,
      settings: null,
    });

    return NextResponse.json(
      {
        message: 'Organization seeded',
        organizationId: organization._id,
        code: organization.code,
        name: organization.name,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Seed organization error', error);
    return NextResponse.json(
      { error: 'Unexpected error while seeding organization' },
      { status: 500 },
    );
  }
}
