import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { ensureUserIndexes, createUser, findUserByEmailOrPhone } from '@/lib/auth/users';
import {
  ensureOrganizationIndexes,
  findOrganizationByCode,
  createOrganization,
} from '@/lib/organizations/organizations';

export async function POST() {
  try {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Not allowed in production' }, { status: 403 });
    }

    const organizationCode = process.env.INIT_ORG_ID ?? 'dev-org-1';
    const email = process.env.INIT_BUILDING_MANAGER_EMAIL ?? 'manager@example.com';
    const phone = process.env.INIT_BUILDING_MANAGER_PHONE ?? '+18888888888';
    const password = process.env.INIT_BUILDING_MANAGER_PASSWORD ?? 'Manager123!';

    // Ensure organization exists
    await ensureOrganizationIndexes();
    let organization = await findOrganizationByCode(organizationCode);
    if (!organization) {
      organization = await createOrganization({
        name: process.env.INIT_ORG_NAME ?? 'Development Organization',
        code: organizationCode,
      });
    }

    const organizationId = organization._id;

    await ensureUserIndexes();

    const existing = await findUserByEmailOrPhone(email);
    if (existing) {
      return NextResponse.json(
        {
          message: 'BUILDING_MANAGER already exists',
          email: existing.email,
          phone: existing.phone,
        },
        { status: 200 },
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await createUser({
      organizationId,
      phone,
      email,
      passwordHash,
      roles: ['BUILDING_MANAGER'],
      status: 'active',
    });

    return NextResponse.json(
      {
        message: 'BUILDING_MANAGER seeded',
        email: user.email,
        phone: user.phone,
        organizationId: user.organizationId,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Seed BUILDING_MANAGER error', error);
    return NextResponse.json(
      { error: 'Unexpected error while seeding BUILDING_MANAGER' },
      { status: 500 },
    );
  }
}

