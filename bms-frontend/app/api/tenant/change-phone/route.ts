import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { findUserById, updateUser, findUserByPhone } from '@/lib/auth/users';
import { findTenantByPhone } from '@/lib/tenants/tenants';
import { getDb } from '@/lib/db';
import { ObjectId } from 'mongodb';

/**
 * POST /api/tenant/change-phone
 * Change phone number for authenticated tenant user.
 * Updates both user and tenant records.
 */
export async function POST(request: NextRequest) {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Only TENANT role can use this endpoint
    if (!context.roles.includes('TENANT')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = (await request.json()) as {
      newPhone: string;
      password: string; // Require password confirmation
    };

    if (!body.newPhone || !body.password) {
      return NextResponse.json({ error: 'newPhone and password are required' }, { status: 400 });
    }

    // Get user
    const user = await findUserById(context.userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify password
    const bcrypt = await import('bcryptjs');
    const passwordMatch = await bcrypt.compare(body.password, user.passwordHash);
    if (!passwordMatch) {
      return NextResponse.json({ error: 'Password is incorrect' }, { status: 400 });
    }

    // Check if new phone is already in use
    const existingUser = await findUserByPhone(body.newPhone, user.organizationId);
    if (existingUser && existingUser._id !== user._id) {
      return NextResponse.json({ error: 'Phone number is already in use' }, { status: 409 });
    }

    // Check if tenant with new phone exists
    const existingTenant = await findTenantByPhone(body.newPhone, user.organizationId);
    if (existingTenant && existingTenant._id !== user.tenantId) {
      return NextResponse.json(
        { error: 'Phone number is already in use by another tenant' },
        { status: 409 },
      );
    }

    // Update user phone
    await updateUser(user._id, { phone: body.newPhone.trim() }, false);

    // Update tenant phone if tenantId exists
    if (user.tenantId) {
      const db = await getDb();
      await db
        .collection('tenants')
        .updateOne(
          { _id: new ObjectId(user.tenantId) },
          { $set: { primaryPhone: body.newPhone.trim(), updatedAt: new Date() } },
        );
    }

    return NextResponse.json({ message: 'Phone number changed successfully' });
  } catch (error) {
    console.error('Change phone error:', error);
    return NextResponse.json({ error: 'Failed to change phone number' }, { status: 500 });
  }
}
