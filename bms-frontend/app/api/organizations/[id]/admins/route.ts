import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { isSuperAdmin, requirePermission } from '@/lib/auth/authz';
import { getDb } from '@/lib/db';
import { findOrganizationById } from '@/lib/organizations/organizations';
import {
  findUserById,
  createUser,
  updateUserRoles,
  updateUserStatus,
  findUserByEmailOrPhone,
} from '@/lib/auth/users';
import { logActivitySafe } from '@/modules/users/activity-logger';
import { validatePassword } from '@/lib/auth/password-policy';
import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';
import type { UserRole } from '@/lib/auth/types';

/**
 * GET /api/organizations/[id]/admins
 * List all ORG_ADMIN users for an organization.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only SUPER_ADMIN can manage organization admins
    if (!isSuperAdmin(context)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    // Verify organization exists
    const organization = await findOrganizationById(id);
    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const db = await getDb();

    // Get all ORG_ADMIN users for this organization
    const admins = await db
      .collection('users')
      .find({
        organizationId: id,
        roles: 'ORG_ADMIN',
      })
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({
      admins: admins.map((admin: any) => ({
        id: admin._id.toString(),
        name: admin.name,
        email: admin.email,
        phone: admin.phone,
        status: admin.status,
        lastLoginAt: admin.lastLoginAt || null,
        createdAt: admin.createdAt,
        updatedAt: admin.updatedAt,
      })),
      organization: {
        id: organization._id,
        name: organization.name,
      },
    });
  } catch (error) {
    console.error('Get organization admins error:', error);
    return NextResponse.json({ error: 'Failed to fetch organization admins' }, { status: 500 });
  }
}

/**
 * POST /api/organizations/[id]/admins
 * Create a new ORG_ADMIN for an organization.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only SUPER_ADMIN can create organization admins
    if (!isSuperAdmin(context)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    // Verify organization exists
    const organization = await findOrganizationById(id);
    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const body = (await request.json()) as {
      name?: string;
      email?: string;
      phone: string;
      password: string;
    };

    // Validate required fields
    if (!body.phone || !body.phone.trim()) {
      return NextResponse.json({ error: 'Phone is required' }, { status: 400 });
    }

    if (!body.password || !body.password.trim()) {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    // Validate email format if provided
    if (body.email && body.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(body.email.trim())) {
        return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
      }
    }

    // Validate password strength
    const passwordValidation = validatePassword(body.password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: 'Password does not meet requirements', details: passwordValidation.errors },
        { status: 400 },
      );
    }

    // Check if user already exists
    const existingUser = await findUserByEmailOrPhone(body.phone.trim());
    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this phone number already exists' },
        { status: 409 },
      );
    }

    if (body.email) {
      const existingByEmail = await findUserByEmailOrPhone(body.email.trim());
      if (existingByEmail) {
        return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 });
      }
    }

    // Hash password
    const passwordHash = await bcrypt.hash(body.password, 10);

    // Create ORG_ADMIN user
    const adminUser = await createUser({
      organizationId: id,
      phone: body.phone.trim(),
      email: body.email?.trim() || null,
      passwordHash,
      roles: ['ORG_ADMIN'],
      status: 'active',
    });

    // Update name if provided
    if (body.name && body.name.trim()) {
      const { updateUser } = await import('@/lib/auth/users');
      await updateUser(adminUser._id.toString(), { name: body.name.trim() }, false);
    }

    // Log admin creation
    await logActivitySafe({
      userId: adminUser._id.toString(),
      organizationId: id,
      action: 'user_created',
      details: {
        createdBy: context.userId,
        roles: ['ORG_ADMIN'],
        createdAsOrgAdmin: true,
      },
      request,
    });

    return NextResponse.json(
      {
        message: 'Organization admin created successfully',
        admin: {
          id: adminUser._id.toString(),
          name: body.name || null,
          email: adminUser.email,
          phone: adminUser.phone,
          roles: adminUser.roles,
          status: adminUser.status,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Create organization admin error:', error);
    if (error instanceof Error) {
      if (error.message.includes('duplicate key') || error.message.includes('E11000')) {
        return NextResponse.json({ error: 'Phone or email already exists' }, { status: 409 });
      }
    }
    return NextResponse.json({ error: 'Failed to create organization admin' }, { status: 500 });
  }
}
