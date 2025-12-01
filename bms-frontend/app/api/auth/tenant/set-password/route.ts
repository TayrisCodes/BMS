import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';
import { findTenantByPhone } from '@/lib/tenants/tenants';
import { getUsersCollection, createUser } from '@/lib/auth/users';
import { createSessionToken, getSessionCookieName } from '@/lib/auth/session';
import type { Document } from 'mongodb';

interface SetPasswordRequestBody {
  phone?: string;
  password?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SetPasswordRequestBody;
    const phone = body.phone?.trim() ?? '';
    const password = body.password?.trim() ?? '';

    if (!phone || !password) {
      return NextResponse.json(
        { error: 'Phone number and password are required' },
        { status: 400 },
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 },
      );
    }

    // Find tenant
    const tenant = await findTenantByPhone(phone);
    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found. Please complete sign-up first.' },
        { status: 404 },
      );
    }

    if (tenant.status !== 'active') {
      return NextResponse.json({ error: 'Tenant account is not active' }, { status: 403 });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Find or create user for tenant
    const usersCollection = await getUsersCollection();
    // Find by phone (most reliable identifier)
    let user = await usersCollection.findOne({
      phone: tenant.primaryPhone,
    } as Document);

    if (user) {
      // Update existing user with password
      // Handle both string and ObjectId _id
      let userId: ObjectId;
      if (typeof user._id === 'string') {
        userId = new ObjectId(user._id);
      } else if (user._id && typeof user._id === 'object' && 'toString' in user._id) {
        // Check if it's an ObjectId by checking for toString method
        userId = user._id as ObjectId;
      } else {
        userId = new ObjectId(String(user._id));
      }

      await usersCollection.updateOne(
        { _id: userId } as Document,
        {
          $set: {
            passwordHash,
            updatedAt: new Date(),
          },
        } as Document,
      );

      // Fetch updated user - need to ensure it matches UserLike type
      const updatedUser = await usersCollection.findOne({
        _id: userId,
      } as Document);

      if (!updatedUser) {
        return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
      }

      // Ensure _id is a string for createSessionToken
      user = {
        ...updatedUser,
        _id: updatedUser._id.toString(),
      } as typeof updatedUser & { _id: string };
    } else {
      // Create new user with password
      // Check if user exists by phone (in case of race condition)
      const existingUser = await usersCollection.findOne({
        phone: tenant.primaryPhone,
      } as Document);

      if (existingUser) {
        // User exists, update it instead
        let userId: ObjectId;
        if (typeof existingUser._id === 'string') {
          userId = new ObjectId(existingUser._id);
        } else if (
          existingUser._id &&
          typeof existingUser._id === 'object' &&
          'toString' in existingUser._id
        ) {
          userId = existingUser._id as ObjectId;
        } else {
          userId = new ObjectId(String(existingUser._id));
        }

        await usersCollection.updateOne(
          { _id: userId } as Document,
          {
            $set: {
              passwordHash,
              updatedAt: new Date(),
            },
          } as Document,
        );

        const updated = await usersCollection.findOne({
          _id: userId,
        } as Document);

        if (!updated) {
          return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
        }

        user = {
          ...updated,
          _id: updated._id.toString(),
        } as typeof updated & { _id: string };
      } else {
        // Create new user with password
        // Double-check user doesn't exist (race condition protection)
        const doubleCheck = await usersCollection.findOne({
          phone: tenant.primaryPhone,
        } as Document);

        if (doubleCheck) {
          // User exists, update it
          let userId: ObjectId;
          if (typeof doubleCheck._id === 'string') {
            userId = new ObjectId(doubleCheck._id);
          } else if (
            doubleCheck._id &&
            typeof doubleCheck._id === 'object' &&
            'toString' in doubleCheck._id
          ) {
            userId = doubleCheck._id as ObjectId;
          } else {
            userId = new ObjectId(String(doubleCheck._id));
          }

          await usersCollection.updateOne(
            { _id: userId } as Document,
            {
              $set: {
                passwordHash,
                organizationId: tenant.organizationId,
                roles: ['TENANT'],
                status: 'active',
                updatedAt: new Date(),
              },
            } as Document,
          );

          const updated = await usersCollection.findOne({
            _id: userId,
          } as Document);

          if (!updated) {
            return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
          }

          user = {
            ...updated,
            _id: updated._id.toString(),
          } as typeof updated & { _id: string };
        } else {
          // Create new user - omit email field entirely to avoid sparse index issues
          const now = new Date();
          const userDoc = {
            organizationId: tenant.organizationId,
            phone: tenant.primaryPhone,
            passwordHash,
            roles: ['TENANT'],
            status: 'active' as const,
            createdAt: now,
            updatedAt: now,
          };

          const insertResult = await usersCollection.insertOne(userDoc as any);

          const newUser = await usersCollection.findOne({
            _id: insertResult.insertedId,
          });

          if (!newUser) {
            return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
          }

          user = {
            ...newUser,
            _id: newUser._id.toString(),
          } as typeof newUser & { _id: string };
        }
      }
    }

    // Create session
    // Ensure user has the correct type for createSessionToken
    const token = await createSessionToken(user as Awaited<ReturnType<typeof createUser>>);

    const response = NextResponse.json(
      {
        message: 'Password set successfully. You are now logged in.',
      },
      { status: 200 },
    );

    const isProd = process.env.NODE_ENV === 'production';

    response.cookies.set(getSessionCookieName(), token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error) {
    console.error('Set password error', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Unexpected error while setting password', details: errorMessage },
      { status: 500 },
    );
  }
}
