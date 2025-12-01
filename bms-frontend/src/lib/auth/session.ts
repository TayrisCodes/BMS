import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import type { JWTPayload } from 'jose';
import type { Document } from 'mongodb';
import { ObjectId } from 'mongodb';
import type { User } from './types';
import type { AuthContext } from './authz';
import { getUsersCollection } from './users';

const SESSION_COOKIE_NAME = 'bms_session';
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7; // 7 days

function getJwtSecret(): Uint8Array {
  const secret = process.env.AUTH_JWT_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('AUTH_JWT_SECRET (or JWT_SECRET) is not set');
  }

  return new TextEncoder().encode(secret);
}

type UserLike = User;

export async function createSessionToken(user: UserLike): Promise<string> {
  const secret = getJwtSecret();

  const now = Math.floor(Date.now() / 1000);

  const payload: JWTPayload = {
    sub: user._id.toString(),
    userId: user._id.toString(),
    organizationId: user.organizationId,
    roles: user.roles,
    tenantId: (user as any).tenantId,
  };

  const jwt = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + SESSION_DURATION_SECONDS)
    .sign(secret);

  return jwt;
}

export async function verifySessionToken(token: string): Promise<AuthContext | null> {
  try {
    const secret = getJwtSecret();
    const { payload } = await jwtVerify(token, secret);

    const userId = typeof payload.userId === 'string' ? payload.userId : undefined;
    const organizationId =
      typeof payload.organizationId === 'string' ? payload.organizationId : undefined;
    const roles = Array.isArray(payload.roles)
      ? (payload.roles.filter((r) => typeof r === 'string') as AuthContext['roles'])
      : [];
    const tenantId = typeof payload.tenantId === 'string' ? payload.tenantId : undefined;

    if (!userId || roles.length === 0) {
      return null;
    }

    const context: AuthContext = { userId, roles };

    if (organizationId) {
      context.organizationId = organizationId;
    }

    if (tenantId) {
      context.tenantId = tenantId;
    }

    return context;
  } catch {
    return null;
  }
}

export async function getAuthContextFromCookies(): Promise<AuthContext | null> {
  const store = cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  return verifySessionToken(token);
}

export async function getCurrentUserFromCookies(): Promise<UserLike | null> {
  const context = await getAuthContextFromCookies();
  if (!context) {
    return null;
  }

  const collection = await getUsersCollection();
  const user = await collection.findOne({ _id: new ObjectId(context.userId) } as Document);
  if (!user) {
    return null;
  }

  return user as UserLike;
}

export function getSessionCookieName(): string {
  return SESSION_COOKIE_NAME;
}
