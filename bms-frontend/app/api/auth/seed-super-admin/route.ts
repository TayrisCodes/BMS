import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { ensureUserIndexes, createUser, findUserByEmailOrPhone } from '@/lib/auth/users';

export async function POST() {
  try {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Not allowed in production' }, { status: 403 });
    }

    const email = process.env.INIT_SUPER_ADMIN_EMAIL ?? 'superadmin@example.com';
    const phone = process.env.INIT_SUPER_ADMIN_PHONE ?? '+19999999999';
    const password = process.env.INIT_SUPER_ADMIN_PASSWORD ?? 'SuperAdmin123!';
    // SUPER_ADMIN doesn't belong to a specific organization
    const organizationId = 'system'; // Special org ID for platform-level users

    await ensureUserIndexes();

    const existing = await findUserByEmailOrPhone(email);
    if (existing) {
      return NextResponse.json(
        {
          message: 'SUPER_ADMIN already exists',
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
      roles: ['SUPER_ADMIN'],
      status: 'active',
    });

    return NextResponse.json(
      {
        message: 'SUPER_ADMIN seeded',
        email: user.email,
        phone: user.phone,
        organizationId: user.organizationId,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Seed SUPER_ADMIN error', error);
    return NextResponse.json(
      { error: 'Unexpected error while seeding SUPER_ADMIN' },
      { status: 500 },
    );
  }
}

