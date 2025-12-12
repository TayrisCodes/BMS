import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies, getCurrentUserFromCookies } from '@/lib/auth/session';
import { updateUser, findUserByEmailOrPhone } from '@/lib/auth/users';
import { logActivitySafe } from '@/modules/users/activity-logger';
import { getDb } from '@/lib/db';
import type { User } from '@/lib/auth/types';

/**
 * Safely converts organizationId to a valid ObjectId string.
 * Returns null if organizationId is invalid, empty, or not a valid ObjectId string.
 * Handles both string and ObjectId instance inputs.
 */
function safeObjectIdFromString(value: unknown): string | null {
  if (!value) return null;

  // If it's already an ObjectId instance (from MongoDB), convert to string
  if (typeof value === 'object' && value !== null && 'toString' in value) {
    try {
      const str = value.toString();
      // Validate it's a 24 character hex string
      if (str && /^[0-9a-fA-F]{24}$/.test(str)) {
        return str;
      }
      return null;
    } catch {
      return null;
    }
  }

  // If it's a string, validate it's a valid ObjectId format
  if (typeof value === 'string') {
    const trimmed = value.trim();
    // Must be exactly 24 hex characters (MongoDB ObjectId format)
    if (trimmed && trimmed.length === 24 && /^[0-9a-fA-F]{24}$/.test(trimmed)) {
      return trimmed;
    }
  }

  return null;
}

/**
 * GET /api/users/me
 * Get current user's profile.
 * Returns user details from session.
 */
export async function GET(request: NextRequest) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getCurrentUserFromCookies();
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get organization name if organizationId exists and is valid
    let organizationName: string | null = null;
    const validOrgId = safeObjectIdFromString(user.organizationId);
    if (validOrgId) {
      try {
        const db = await getDb();
        const { ObjectId } = await import('mongodb');
        const org = await db.collection('organizations').findOne({
          _id: new ObjectId(validOrgId),
        });
        if (org) {
          organizationName = org.name || null;
        }
      } catch (error) {
        // Ignore error, just don't include organization name
        console.error('Failed to fetch organization:', error);
      }
    }

    return NextResponse.json({
      id: user._id.toString(),
      organizationId: user.organizationId,
      email: user.email,
      phone: user.phone,
      name: user.name,
      roles: user.roles || [],
      status: user.status || 'active',
      organizationName,
      invitedBy: user.invitedBy,
      invitedAt: user.invitedAt,
      activatedAt: user.activatedAt,
      lastLoginAt: user.lastLoginAt,
      passwordChangedAt: user.passwordChangedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    return NextResponse.json({ error: 'Failed to fetch user profile' }, { status: 500 });
  }
}

/**
 * PATCH /api/users/me
 * Update own profile.
 * Request body: { name?, email?, phone? }
 * Validates email/phone uniqueness.
 */
export async function PATCH(request: NextRequest) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getCurrentUserFromCookies();
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = (await request.json()) as Partial<{
      name?: string | null;
      email?: string | null;
      phone?: string | null;
    }>;

    // Validate email format if provided
    if (body.email !== undefined && body.email !== null && body.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(body.email.trim())) {
        return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
      }
    }

    // Validate phone/email uniqueness
    if (body.phone || body.email) {
      const phoneToCheck = body.phone?.trim() || user.phone;
      const emailToCheck = body.email?.trim() || user.email;

      // Check phone uniqueness (per organization)
      if (phoneToCheck && phoneToCheck !== user.phone) {
        const existingByPhone = await findUserByEmailOrPhone(phoneToCheck);
        if (
          existingByPhone &&
          existingByPhone._id.toString() !== user._id.toString() &&
          existingByPhone.organizationId === user.organizationId
        ) {
          return NextResponse.json(
            { error: 'Phone number already exists in this organization' },
            { status: 409 },
          );
        }
      }

      // Check email uniqueness (global)
      if (emailToCheck && emailToCheck !== user.email) {
        const existingByEmail = await findUserByEmailOrPhone(emailToCheck);
        if (existingByEmail && existingByEmail._id.toString() !== user._id.toString()) {
          return NextResponse.json({ error: 'Email already exists' }, { status: 409 });
        }
      }
    }

    // Prepare update data
    const updateData: Partial<{
      name?: string | null;
      email?: string | null;
      phone?: string | null;
    }> = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.email !== undefined) updateData.email = body.email?.trim() || null;
    if (body.phone !== undefined) updateData.phone = body.phone?.trim() || null;

    // Update user
    const updatedUser = await updateUser(user._id.toString(), updateData as Partial<User>, false);

    if (!updatedUser) {
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }

    // Get organization name if organizationId exists and is valid
    let organizationName: string | null = null;
    const validOrgId = safeObjectIdFromString(updatedUser.organizationId);
    if (validOrgId) {
      try {
        const db = await getDb();
        const { ObjectId } = await import('mongodb');
        const org = await db.collection('organizations').findOne({
          _id: new ObjectId(validOrgId),
        });
        if (org) {
          organizationName = org.name || null;
        }
      } catch (error) {
        // Ignore error
      }
    }

    // Log profile update
    await logActivitySafe({
      userId: user._id.toString(),
      organizationId: user.organizationId,
      action: 'profile_update',
      details: {
        updatedFields: Object.keys(updateData),
      },
      request,
    });

    return NextResponse.json({
      message: 'Profile updated successfully',
      user: {
        id: updatedUser._id.toString(),
        organizationId: updatedUser.organizationId,
        email: updatedUser.email,
        phone: updatedUser.phone,
        name: updatedUser.name,
        roles: updatedUser.roles,
        status: updatedUser.status,
        organizationName,
        updatedAt: updatedUser.updatedAt,
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    if (error instanceof Error) {
      if (error.message.includes('duplicate key') || error.message.includes('E11000')) {
        return NextResponse.json({ error: 'Email or phone already exists' }, { status: 409 });
      }
    }
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
