#!/usr/bin/env tsx
/**
 * Seed script for MongoDB Atlas
 * This script seeds initial data to the MongoDB Atlas database
 * Usage: MONGODB_URI="your-connection-string" tsx scripts/seed-atlas.ts
 *
 * REQUIRED: MONGODB_URI environment variable must be set
 */

import { MongoClient, ObjectId, Db } from 'mongodb';
import bcrypt from 'bcryptjs';

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ Error: MONGODB_URI environment variable is required');
  console.error('Usage: MONGODB_URI="your-connection-string" tsx scripts/seed-atlas.ts');
  process.exit(1);
}

// Environment variables with defaults
const INIT_ORG_ID = process.env.INIT_ORG_ID || 'dev-org-1';
const INIT_ORG_NAME = process.env.INIT_ORG_NAME || 'Development Organization';
const INIT_ORG_ADMIN_EMAIL = process.env.INIT_ORG_ADMIN_EMAIL || 'admin@example.com';
const INIT_ORG_ADMIN_PHONE = process.env.INIT_ORG_ADMIN_PHONE || '+10000000000';
const INIT_ORG_ADMIN_PASSWORD = process.env.INIT_ORG_ADMIN_PASSWORD || 'ChangeMe123!';
const INIT_SUPER_ADMIN_EMAIL = process.env.INIT_SUPER_ADMIN_EMAIL || 'superadmin@example.com';
const INIT_SUPER_ADMIN_PHONE = process.env.INIT_SUPER_ADMIN_PHONE || '+19999999999';
const INIT_SUPER_ADMIN_PASSWORD = process.env.INIT_SUPER_ADMIN_PASSWORD || 'SuperAdmin123!';
const INIT_BUILDING_MANAGER_EMAIL =
  process.env.INIT_BUILDING_MANAGER_EMAIL || 'building.manager@example.com';
const INIT_BUILDING_MANAGER_PHONE = process.env.INIT_BUILDING_MANAGER_PHONE || '+10000000001';
const INIT_BUILDING_MANAGER_PASSWORD =
  process.env.INIT_BUILDING_MANAGER_PASSWORD || 'BuildingManager123!';
const INIT_TENANT_PHONE = process.env.INIT_TENANT_PHONE || '+251912345678';

async function ensureIndexes(db: Db): Promise<void> {
  console.log('Creating indexes...');

  try {
    // Organizations indexes - drop and recreate if exists
    const orgCollection = db.collection('organizations');
    try {
      await orgCollection.dropIndex('unique_code');
    } catch (e: any) {
      // Index doesn't exist, that's fine
    }
    await orgCollection.createIndex({ code: 1 }, { unique: true, name: 'unique_code' });

    // Users indexes - drop and recreate if exists
    const usersCollection = db.collection('users');
    const userIndexes = [
      'unique_org_phone',
      'unique_email_optional',
      'organizationId',
      'roles',
      'status',
      'invitationToken_sparse',
      'resetPasswordToken_sparse',
    ];
    for (const indexName of userIndexes) {
      try {
        await usersCollection.dropIndex(indexName);
      } catch (e: any) {
        // Index doesn't exist, that's fine
      }
    }
    await usersCollection.createIndexes([
      {
        key: { organizationId: 1, phone: 1 },
        unique: true,
        sparse: true,
        name: 'unique_org_phone',
      },
      { key: { email: 1 }, unique: true, sparse: true, name: 'unique_email_optional' },
      { key: { organizationId: 1 }, name: 'organizationId' },
      { key: { roles: 1 }, name: 'roles' },
      { key: { status: 1 }, name: 'status' },
      { key: { invitationToken: 1 }, sparse: true, name: 'invitationToken_sparse' },
      { key: { resetPasswordToken: 1 }, sparse: true, name: 'resetPasswordToken_sparse' },
    ]);

    // Tenants indexes
    const tenantsCollection = db.collection('tenants');
    try {
      await tenantsCollection.dropIndex('unique_org_phone');
    } catch (e: any) {
      // Index doesn't exist, that's fine
    }
    await tenantsCollection.createIndexes([
      { key: { organizationId: 1, primaryPhone: 1 }, unique: true, name: 'unique_org_phone' },
      { key: { organizationId: 1 }, name: 'organizationId' },
      { key: { status: 1 }, name: 'status' },
    ]);

    // OTP indexes
    const otpsCollection = db.collection('otps');
    await otpsCollection.createIndexes([
      { key: { phone: 1, code: 1 }, name: 'phone_code' },
      { key: { phone: 1 }, name: 'phone' },
      { key: { expiresAt: 1 }, expireAfterSeconds: 0, name: 'expiresAt_ttl' },
    ]);

    console.log('✅ All indexes created');
  } catch (error: any) {
    console.warn('⚠️  Some indexes may already exist, continuing...', error.message);
  }
}

interface Organization {
  _id: ObjectId;
  name: string;
  code: string;
  contactInfo?: {
    email?: string;
    phone?: string;
    address?: string;
  } | null;
  settings?: {
    [key: string]: unknown;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

interface User {
  _id: ObjectId;
  organizationId: string;
  email: string | null;
  phone: string;
  passwordHash: string;
  roles: string[];
  status: 'active' | 'invited' | 'suspended';
  createdAt: Date;
  updatedAt: Date;
}

interface Tenant {
  _id: ObjectId;
  organizationId: string;
  firstName: string;
  lastName: string;
  primaryPhone: string;
  email: string | null;
  nationalId: string | null;
  language: string;
  status: 'active' | 'inactive' | 'suspended';
  createdAt: Date;
  updatedAt: Date;
}

async function seedDatabase() {
  console.log('🌱 Starting MongoDB Atlas seeding...\n');

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB Atlas\n');

    const db = client.db();
    const organizationsCollection = db.collection<Organization>('organizations');
    const usersCollection = db.collection<User>('users');
    const tenantsCollection = db.collection<Tenant>('tenants');

    // Step 1: Ensure all indexes
    console.log('📋 Step 1: Ensuring database indexes...');
    await ensureIndexes(db);
    console.log('✅ Indexes ensured\n');

    // Step 2: Seed Organization
    console.log('📋 Step 2: Seeding Organization...');
    let organization = await organizationsCollection.findOne({ code: INIT_ORG_ID });
    if (!organization) {
      const now = new Date();
      const orgDoc: Omit<Organization, '_id'> = {
        name: INIT_ORG_NAME,
        code: INIT_ORG_ID,
        contactInfo: null,
        settings: null,
        createdAt: now,
        updatedAt: now,
      };
      const orgResult = await organizationsCollection.insertOne(orgDoc as any);
      organization = {
        _id: orgResult.insertedId,
        ...orgDoc,
      } as Organization;
      console.log(`✅ Organization created: ${organization.name} (${organization.code})`);
    } else {
      console.log(`ℹ️  Organization already exists: ${organization.name} (${organization.code})`);
    }
    const organizationId = organization._id.toString();
    console.log('');

    // Step 3: Seed SUPER_ADMIN
    console.log('📋 Step 3: Seeding SUPER_ADMIN...');
    let superAdmin = await usersCollection.findOne({
      $or: [{ email: INIT_SUPER_ADMIN_EMAIL }, { phone: INIT_SUPER_ADMIN_PHONE }],
    });
    if (!superAdmin) {
      const passwordHash = await bcrypt.hash(INIT_SUPER_ADMIN_PASSWORD, 10);
      const now = new Date();
      const userDoc: Omit<User, '_id'> = {
        organizationId: 'system', // Special org ID for platform-level users
        email: INIT_SUPER_ADMIN_EMAIL,
        phone: INIT_SUPER_ADMIN_PHONE,
        passwordHash,
        roles: ['SUPER_ADMIN'],
        status: 'active',
        createdAt: now,
        updatedAt: now,
      };
      const userResult = await usersCollection.insertOne(userDoc as any);
      superAdmin = {
        _id: userResult.insertedId,
        ...userDoc,
      } as User;
      console.log(`✅ SUPER_ADMIN created: ${superAdmin.email}`);
    } else {
      console.log(`ℹ️  SUPER_ADMIN already exists: ${superAdmin.email}`);
    }
    console.log('');

    // Step 4: Seed ORG_ADMIN
    console.log('📋 Step 4: Seeding ORG_ADMIN...');
    let orgAdmin = await usersCollection.findOne({
      $or: [{ email: INIT_ORG_ADMIN_EMAIL }, { phone: INIT_ORG_ADMIN_PHONE }],
    });
    if (!orgAdmin) {
      const passwordHash = await bcrypt.hash(INIT_ORG_ADMIN_PASSWORD, 10);
      const now = new Date();
      const userDoc: Omit<User, '_id'> = {
        organizationId,
        email: INIT_ORG_ADMIN_EMAIL,
        phone: INIT_ORG_ADMIN_PHONE,
        passwordHash,
        roles: ['ORG_ADMIN'],
        status: 'active',
        createdAt: now,
        updatedAt: now,
      };
      const userResult = await usersCollection.insertOne(userDoc as any);
      orgAdmin = {
        _id: userResult.insertedId,
        ...userDoc,
      } as User;
      console.log(`✅ ORG_ADMIN created: ${orgAdmin.email}`);
    } else {
      console.log(`ℹ️  ORG_ADMIN already exists: ${orgAdmin.email}`);
    }
    console.log('');

    // Step 5: Seed BUILDING_MANAGER
    console.log('📋 Step 5: Seeding BUILDING_MANAGER...');
    let buildingManager = await usersCollection.findOne({
      $or: [{ email: INIT_BUILDING_MANAGER_EMAIL }, { phone: INIT_BUILDING_MANAGER_PHONE }],
    });
    if (!buildingManager) {
      const passwordHash = await bcrypt.hash(INIT_BUILDING_MANAGER_PASSWORD, 10);
      const now = new Date();
      const userDoc: Omit<User, '_id'> = {
        organizationId,
        email: INIT_BUILDING_MANAGER_EMAIL,
        phone: INIT_BUILDING_MANAGER_PHONE,
        passwordHash,
        roles: ['BUILDING_MANAGER'],
        status: 'active',
        createdAt: now,
        updatedAt: now,
      };
      const userResult = await usersCollection.insertOne(userDoc as any);
      buildingManager = {
        _id: userResult.insertedId,
        ...userDoc,
      } as User;
      console.log(`✅ BUILDING_MANAGER created: ${buildingManager.email}`);
    } else {
      console.log(`ℹ️  BUILDING_MANAGER already exists: ${buildingManager.email}`);
    }
    console.log('');

    // Step 6: Seed Tenant
    console.log('📋 Step 6: Seeding Tenant...');
    let tenant = await tenantsCollection.findOne({
      organizationId,
      primaryPhone: INIT_TENANT_PHONE,
    });
    if (!tenant) {
      const now = new Date();
      const tenantDoc: Omit<Tenant, '_id'> = {
        organizationId,
        firstName: 'Test',
        lastName: 'Tenant',
        primaryPhone: INIT_TENANT_PHONE,
        email: null,
        nationalId: null,
        language: 'en',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      };
      const tenantResult = await tenantsCollection.insertOne(tenantDoc as any);
      tenant = {
        _id: tenantResult.insertedId,
        ...tenantDoc,
      } as Tenant;
      console.log(`✅ Tenant created: ${tenant.primaryPhone}`);
    } else {
      console.log(`ℹ️  Tenant already exists: ${tenant.primaryPhone}`);
    }
    console.log('');

    console.log('====================================');
    console.log('✅ Seeding Complete!');
    console.log('====================================\n');
    console.log('📋 Created Accounts:\n');
    console.log('1. SUPER_ADMIN (Platform Admin)');
    console.log(`   Email: ${INIT_SUPER_ADMIN_EMAIL}`);
    console.log(`   Phone: ${INIT_SUPER_ADMIN_PHONE}`);
    console.log(`   Password: ${INIT_SUPER_ADMIN_PASSWORD}\n`);
    console.log('2. ORG_ADMIN (Organization Admin)');
    console.log(`   Email: ${INIT_ORG_ADMIN_EMAIL}`);
    console.log(`   Phone: ${INIT_ORG_ADMIN_PHONE}`);
    console.log(`   Password: ${INIT_ORG_ADMIN_PASSWORD}\n`);
    console.log('3. BUILDING_MANAGER');
    console.log(`   Email: ${INIT_BUILDING_MANAGER_EMAIL}`);
    console.log(`   Phone: ${INIT_BUILDING_MANAGER_PHONE}`);
    console.log(`   Password: ${INIT_BUILDING_MANAGER_PASSWORD}\n`);
    console.log('4. TENANT (for Tenant Portal)');
    console.log(`   Phone: ${INIT_TENANT_PHONE}`);
    console.log('   (Login via OTP at /tenant/login)\n');
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    await client.close();
    console.log('✅ Database connection closed');
  }
}

// Run the seed script
seedDatabase()
  .then(() => {
    console.log('\n🎉 All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Seeding failed:', error);
    process.exit(1);
  });
