import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { isSuperAdmin, requirePermission } from '@/lib/auth/authz';
import {
  findUsersByOrganization,
  findUsersByRole,
  findUserByEmailOrPhone,
  createUser,
} from '@/lib/auth/users';
import { getUsersCollection } from '@/lib/auth/users';
import { logActivitySafe } from '@/modules/users/activity-logger';
import { getDb } from '@/lib/db';
import type { UserRole } from '@/lib/auth/types';
import bcrypt from 'bcryptjs';
import { validatePassword } from '@/lib/auth/password-policy';

/**
 * GET /api/users
 * List users with pagination, search, and filters.
 * Query params:
 * - page: page number (default: 1)
 * - limit: items per page (default: 50)
 * - role: filter by role
 * - status: filter by status
 * - buildingId: filter by building (optional, for future building-level roles)
 * - search: search by name, email, or phone
 */
export async function GET(request: NextRequest) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const role = searchParams.get('role') as UserRole | null;
    const status = searchParams.get('status');
    const buildingId = searchParams.get('buildingId'); // Optional, for future use
    const search = searchParams.get('search');

    // Only SUPER_ADMIN can see all users
    // Others see users in their organization
    if (!isSuperAdmin(context)) {
      if (!context.organizationId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const db = await getDb();
    const collection = await getUsersCollection();

    // Build query filters
    const query: Record<string, unknown> = {};

    // Organization scoping (unless SUPER_ADMIN)
    if (!isSuperAdmin(context)) {
      query.organizationId = context.organizationId;
    }

    // Role filter
    if (role) {
      query.roles = role;
    }

    // Status filter
    if (status) {
      query.status = status;
    }

    // Building filter (for future building-level roles)
    // For now, this is a placeholder - building-level roles not yet implemented
    if (buildingId) {
      // Future: query.users = { $elemMatch: { buildingId, role } }
      // For now, we'll skip this filter
    }

    // Search filter (by name, email, or phone)
    if (search && search.trim()) {
      const searchRegex = { $regex: search.trim(), $options: 'i' };
      query.$or = [{ name: searchRegex }, { email: searchRegex }, { phone: searchRegex }];
    }

    // Get total count for pagination
    const total = await collection.countDocuments(query as any);

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Fetch users with pagination
    const users = await collection
      .find(query as any)
      .sort({ createdAt: -1 }) // Sort by creation date, newest first
      .skip(skip)
      .limit(limit)
      .toArray();

    return NextResponse.json({
      users: users.map((user) => ({
        id: user._id.toString(),
        organizationId: user.organizationId,
        email: user.email,
        phone: user.phone,
        name: user.name,
        roles: user.roles || [],
        status: user.status || 'active',
        createdAt: user.createdAt || new Date(),
        updatedAt: user.updatedAt || new Date(),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Users error:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

/**
 * POST /api/users
 * Create new user.
 * Requires users.create permission.
 * Request body: { email?, phone, password, roles, organizationId, name? }
 */
export async function POST(request: NextRequest) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Require permission to create users
    requirePermission(context, 'users', 'create');

    const body = (await request.json()) as {
      email?: string | null;
      phone: string;
      password: string;
      roles: UserRole[];
      organizationId?: string;
      name?: string | null;
    };

    // Validate required fields
    if (!body.phone || !body.phone.trim()) {
      return NextResponse.json({ error: 'Phone is required' }, { status: 400 });
    }

    if (!body.password || !body.password.trim()) {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    if (!body.roles || !Array.isArray(body.roles) || body.roles.length === 0) {
      return NextResponse.json({ error: 'At least one role is required' }, { status: 400 });
    }

    // Determine organizationId
    let organizationId: string;
    if (isSuperAdmin(context)) {
      // SUPER_ADMIN can create users in any organization
      if (!body.organizationId) {
        return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
      }
      organizationId = body.organizationId;
    } else {
      // Non-SUPER_ADMIN can only create users in their own organization
      if (!context.organizationId) {
        return NextResponse.json({ error: 'Organization context required' }, { status: 403 });
      }
      organizationId = context.organizationId;

      // Ignore organizationId from body if provided (security)
      if (body.organizationId && body.organizationId !== organizationId) {
        return NextResponse.json(
          { error: 'Cannot create user in different organization' },
          { status: 403 },
        );
      }
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

    // Check phone uniqueness (per organization)
    const existingUserByPhone = await findUserByEmailOrPhone(body.phone.trim());
    if (existingUserByPhone && existingUserByPhone.organizationId === organizationId) {
      return NextResponse.json(
        { error: 'Phone number already exists in this organization' },
        { status: 409 },
      );
    }

    // Check email uniqueness if provided
    if (body.email && body.email.trim()) {
      const existingUserByEmail = await findUserByEmailOrPhone(body.email.trim());
      if (existingUserByEmail) {
        return NextResponse.json({ error: 'Email already exists' }, { status: 409 });
      }
    }

    // Hash password
    const passwordHash = await bcrypt.hash(body.password, 10);

    // Create user
    const newUser = await createUser({
      organizationId,
      phone: body.phone.trim(),
      email: body.email?.trim() || null,
      passwordHash,
      roles: body.roles,
      status: 'active',
    });

    // Update name if provided
    let finalUser = newUser;
    if (body.name && body.name.trim()) {
      const { updateUser } = await import('@/lib/auth/users');
      await updateUser(newUser._id.toString(), { name: body.name.trim() });
      // Fetch updated user
      const { findUserById } = await import('@/lib/auth/users');
      const updatedUser = await findUserById(newUser._id.toString());
      if (updatedUser) {
        finalUser = updatedUser;
      }
    }

    // Log user creation
    await logActivitySafe({
      userId: finalUser._id.toString(),
      organizationId: finalUser.organizationId,
      action: 'user_created',
      details: {
        createdBy: context.userId,
        roles: body.roles,
        email: body.email || null,
        phone: body.phone,
      },
      request,
    });

    // Return created user (without password hash)
    return NextResponse.json(
      {
        message: 'User created successfully',
        user: {
          id: finalUser._id.toString(),
          organizationId: finalUser.organizationId,
          email: finalUser.email,
          phone: finalUser.phone,
          name: finalUser.name,
          roles: finalUser.roles,
          status: finalUser.status,
          createdAt: finalUser.createdAt,
          updatedAt: finalUser.updatedAt,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Create user error:', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('duplicate key') || error.message.includes('E11000')) {
        return NextResponse.json({ error: 'Phone or email already exists' }, { status: 409 });
      }
    }
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
