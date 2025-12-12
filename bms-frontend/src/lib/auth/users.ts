import type { Collection, Db, IndexDescription, Document, OptionalUnlessRequiredId } from 'mongodb';
import { getDb } from '@/lib/db';
import type { User, UserRole } from './types';

const USERS_COLLECTION_NAME = 'users';

export async function getUsersCollection(): Promise<Collection<User>> {
  const db = await getDb();
  return db.collection<User>(USERS_COLLECTION_NAME);
}

export async function ensureUserIndexes(db?: Db): Promise<void> {
  const database = db ?? (await getDb());

  const collection = database.collection(USERS_COLLECTION_NAME);

  const indexes: IndexDescription[] = [
    // Unique phone per organization
    {
      key: { organizationId: 1, phone: 1 },
      unique: true,
      name: 'unique_org_phone',
    },
    // Optional unique email globally (or switch to { organizationId: 1, email: 1 } later)
    {
      key: { email: 1 },
      unique: true,
      sparse: true,
      name: 'unique_email_optional',
    },
    // Index on organizationId for org-scoped queries
    {
      key: { organizationId: 1 },
      name: 'organizationId',
    },
    // Index on roles for role-based queries
    {
      key: { roles: 1 },
      name: 'roles',
    },
    // Index on status for filtering by status
    {
      key: { status: 1 },
      name: 'status',
    },
    // Sparse index on invitationToken for invitation lookups
    {
      key: { invitationToken: 1 },
      sparse: true,
      name: 'invitationToken_sparse',
    },
    // Sparse index on resetPasswordToken for password reset lookups
    {
      key: { resetPasswordToken: 1 },
      sparse: true,
      name: 'resetPasswordToken_sparse',
    },
  ];

  await collection.createIndexes(indexes);
}

export async function findUserByEmailOrPhone(identifier: string): Promise<User | null> {
  const collection = await getUsersCollection();

  const trimmed = identifier.trim();
  if (!trimmed) {
    return null;
  }

  // Simple heuristic: if it contains "@", treat as email; otherwise match either phone or email.
  if (trimmed.includes('@')) {
    return collection.findOne({ email: trimmed.toLowerCase() } as Document);
  }

  return collection.findOne({
    $or: [{ phone: trimmed }, { email: trimmed.toLowerCase() }],
  } as Document);
}

export async function findUserById(userId: string): Promise<User | null> {
  const collection = await getUsersCollection();
  const { ObjectId } = await import('mongodb');

  try {
    return collection.findOne({ _id: new ObjectId(userId) } as Document);
  } catch {
    return null;
  }
}

/**
 * Find user by invitation token.
 */
export async function findUserByInvitationToken(token: string): Promise<User | null> {
  const collection = await getUsersCollection();

  return collection.findOne({
    invitationToken: token,
    status: 'invited',
  } as Document);
}

/**
 * Find user by reset password token.
 */
export async function findUserByResetPasswordToken(token: string): Promise<User | null> {
  const collection = await getUsersCollection();

  return collection.findOne({
    resetPasswordToken: token,
    status: 'active',
  } as Document);
}

export interface CreateUserInput {
  organizationId: string;
  phone: string;
  email?: string | null;
  passwordHash: string;
  roles: User['roles'];
  status?: User['status'];
}

export async function createUser(input: CreateUserInput): Promise<User> {
  const collection = await getUsersCollection();
  const now = new Date();

  const doc: Omit<User, '_id'> = {
    organizationId: input.organizationId,
    phone: input.phone,
    email: input.email !== undefined ? input.email : null,
    passwordHash: input.passwordHash,
    roles: input.roles,
    status: input.status ?? 'active',
    createdAt: now,
    updatedAt: now,
  };

  const result = await collection.insertOne(doc as OptionalUnlessRequiredId<User>);

  return {
    ...(doc as User),
    _id: result.insertedId.toString(),
  } as User;
}

/**
 * Update user fields.
 * Validates updates (e.g., can't change organizationId unless SUPER_ADMIN).
 */
export async function updateUser(
  userId: string,
  updates: Partial<User>,
  isSuperAdmin = false,
): Promise<User | null> {
  const collection = await getUsersCollection();
  const { ObjectId } = await import('mongodb');

  try {
    // Validate: can't change organizationId unless SUPER_ADMIN
    if (updates.organizationId !== undefined && !isSuperAdmin) {
      throw new Error('Cannot change organizationId: requires SUPER_ADMIN permission');
    }

    const updateDoc: Record<string, unknown> = {
      ...updates,
      updatedAt: new Date(),
    };

    // Remove _id from updates if present
    delete updateDoc._id;

    // Trim string fields if present
    if (updateDoc.name && typeof updateDoc.name === 'string') {
      updateDoc.name = updateDoc.name.trim() || null;
    }
    if (updateDoc.phone && typeof updateDoc.phone === 'string') {
      updateDoc.phone = updateDoc.phone.trim();
    }
    if (updateDoc.email && typeof updateDoc.email === 'string') {
      updateDoc.email = updateDoc.email.trim().toLowerCase() || null;
    }

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(userId) } as Document,
      { $set: updateDoc } as Document,
      { returnDocument: 'after' },
    );

    if (!result) {
      return null;
    }

    return result as User;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    return null;
  }
}

/**
 * Soft delete user (set status to "inactive").
 * Prevents deletion of last ORG_ADMIN in organization.
 * Prevents deletion of SUPER_ADMIN.
 */
export async function deleteUser(userId: string, isSuperAdmin = false): Promise<boolean> {
  const collection = await getUsersCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const user = await collection.findOne({ _id: new ObjectId(userId) } as Document);
    if (!user) {
      return false;
    }

    // Prevent deletion of SUPER_ADMIN
    if (user.roles?.includes('SUPER_ADMIN')) {
      throw new Error('Cannot delete SUPER_ADMIN user');
    }

    // Prevent deletion of last ORG_ADMIN in organization
    if (user.roles?.includes('ORG_ADMIN') && user.organizationId) {
      const orgAdmins = await collection.countDocuments({
        organizationId: user.organizationId,
        roles: 'ORG_ADMIN',
        status: { $ne: 'inactive' },
      } as Document);

      if (orgAdmins <= 1) {
        throw new Error('Cannot delete last ORG_ADMIN in organization');
      }
    }

    // Soft delete: set status to inactive
    const result = await collection.updateOne(
      { _id: new ObjectId(userId) } as Document,
      {
        $set: {
          status: 'inactive',
          updatedAt: new Date(),
        },
      } as Document,
    );

    return result.modifiedCount > 0;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    return false;
  }
}

/**
 * Find user by phone number, optionally scoped to organization.
 */
export async function findUserByPhone(
  phone: string,
  organizationId?: string,
): Promise<User | null> {
  const collection = await getUsersCollection();
  const query: Record<string, unknown> = { phone: phone.trim() };

  if (organizationId) {
    query.organizationId = organizationId;
  }

  return collection.findOne(query as Document);
}

/**
 * List users in organization with optional filters.
 */
export async function findUsersByOrganization(
  organizationId: string,
  filters?: Record<string, unknown>,
): Promise<User[]> {
  const collection = await getUsersCollection();

  const query: Record<string, unknown> = {
    organizationId,
    ...filters,
  };

  return collection.find(query as Document).toArray();
}

/**
 * Find users with specific role, optionally scoped to organization.
 */
export async function findUsersByRole(role: UserRole, organizationId?: string): Promise<User[]> {
  const collection = await getUsersCollection();

  const query: Record<string, unknown> = {
    roles: role,
  };

  if (organizationId) {
    query.organizationId = organizationId;
  }

  return collection.find(query as Document).toArray();
}

/**
 * Update user roles.
 * Validates role assignments (e.g., can't remove last ORG_ADMIN).
 */
export async function updateUserRoles(userId: string, roles: UserRole[]): Promise<User | null> {
  const collection = await getUsersCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const user = await collection.findOne({ _id: new ObjectId(userId) } as Document);
    if (!user) {
      return null;
    }

    // Validate: can't remove last ORG_ADMIN in organization
    const hadOrgAdmin = user.roles?.includes('ORG_ADMIN') ?? false;
    const willHaveOrgAdmin = roles.includes('ORG_ADMIN');

    if (hadOrgAdmin && !willHaveOrgAdmin && user.organizationId) {
      const orgAdmins = await collection.countDocuments({
        organizationId: user.organizationId,
        roles: 'ORG_ADMIN',
        status: { $ne: 'inactive' },
        _id: { $ne: new ObjectId(userId) },
      } as Document);

      if (orgAdmins === 0) {
        throw new Error('Cannot remove last ORG_ADMIN in organization');
      }
    }

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(userId) } as Document,
      {
        $set: {
          roles,
          updatedAt: new Date(),
        },
      } as Document,
      { returnDocument: 'after' },
    );

    if (!result) {
      return null;
    }

    return result as User;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    return null;
  }
}

/**
 * Update user status.
 * Prevents deactivating last ORG_ADMIN.
 */
export async function updateUserStatus(
  userId: string,
  status: User['status'],
): Promise<User | null> {
  const collection = await getUsersCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const user = await collection.findOne({ _id: new ObjectId(userId) } as Document);
    if (!user) {
      return null;
    }

    // Prevent deactivating last ORG_ADMIN in organization
    if (
      (status === 'inactive' || status === 'suspended') &&
      user.roles?.includes('ORG_ADMIN') &&
      user.organizationId
    ) {
      const activeOrgAdmins = await collection.countDocuments({
        organizationId: user.organizationId,
        roles: 'ORG_ADMIN',
        status: { $nin: ['inactive', 'suspended'] },
        _id: { $ne: new ObjectId(userId) },
      } as Document);

      if (activeOrgAdmins === 0) {
        throw new Error('Cannot deactivate last ORG_ADMIN in organization');
      }
    }

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(userId) } as Document,
      {
        $set: {
          status,
          updatedAt: new Date(),
        },
      } as Document,
      { returnDocument: 'after' },
    );

    if (!result) {
      return null;
    }

    return result as User;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    return null;
  }
}
