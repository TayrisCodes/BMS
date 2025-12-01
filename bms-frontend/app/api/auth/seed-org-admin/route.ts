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
    const email = process.env.INIT_ORG_ADMIN_EMAIL ?? 'admin@example.com';
    const phone = process.env.INIT_ORG_ADMIN_PHONE ?? '+10000000000';
    const password = process.env.INIT_ORG_ADMIN_PASSWORD ?? 'ChangeMe123!';

    // Ensure organization exists
    await ensureOrganizationIndexes();
    let organization = await findOrganizationByCode(organizationCode);
    if (!organization) {
      const contactInfo: { email?: string; phone?: string } = {};
      if (process.env.INIT_ORG_EMAIL) {
        contactInfo.email = process.env.INIT_ORG_EMAIL;
      }
      if (process.env.INIT_ORG_PHONE) {
        contactInfo.phone = process.env.INIT_ORG_PHONE;
      }

      organization = await createOrganization({
        name: process.env.INIT_ORG_NAME ?? 'Development Organization',
        code: organizationCode,
        contactInfo,
      });
    }

    const organizationId = organization._id;

    await ensureUserIndexes();

    const existing = await findUserByEmailOrPhone(email);
    if (existing) {
      return NextResponse.json(
        {
          message: 'ORG_ADMIN already exists',
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
      roles: ['ORG_ADMIN'],
      status: 'active',
    });

    return NextResponse.json(
      {
        message: 'ORG_ADMIN seeded',
        email: user.email,
        phone: user.phone,
        organizationId: user.organizationId,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Seed ORG_ADMIN error', error);
    return NextResponse.json(
      { error: 'Unexpected error while seeding ORG_ADMIN' },
      { status: 500 },
    );
  }
}
