#!/usr/bin/env tsx
/**
 * Create user account for tenant
 * Usage: MONGODB_URI="your-connection-string" tsx scripts/create-tenant-user.ts
 * 
 * REQUIRED: MONGODB_URI environment variable must be set
 */

import { MongoClient, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ Error: MONGODB_URI environment variable is required');
  console.error('Usage: MONGODB_URI="your-connection-string" tsx scripts/create-tenant-user.ts');
  process.exit(1);
}

const INIT_ORG_ID = process.env.INIT_ORG_ID || 'dev-org-1';
const INIT_TENANT_PHONE = process.env.INIT_TENANT_PHONE || '+251912345678';
const INIT_TENANT_EMAIL = process.env.INIT_TENANT_EMAIL || 'tenant@example.com';
const INIT_TENANT_PASSWORD = process.env.INIT_TENANT_PASSWORD || 'Tenant123!';

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
  primaryPhone: string;
  email?: string | null;
}

async function createTenantUser() {
  console.log('🌱 Creating User Account for Tenant...\n');

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB Atlas\n');

    const db = client.db();
    const usersCollection = db.collection<User>('users');
    const tenantsCollection = db.collection<Tenant>('tenants');
    const organizationsCollection = db.collection('organizations');

    // Get organization
    const organization = await organizationsCollection.findOne({ code: INIT_ORG_ID });
    if (!organization) {
      throw new Error(`Organization not found: ${INIT_ORG_ID}`);
    }
    const organizationId = organization._id.toString();

    // Get tenant
    const tenant = await tenantsCollection.findOne({
      organizationId,
      primaryPhone: INIT_TENANT_PHONE,
    });
    if (!tenant) {
      throw new Error(`Tenant not found: ${INIT_TENANT_PHONE}`);
    }
    console.log(`✅ Tenant found: ${tenant._id.toString()}\n`);

    // Check if user already exists
    let user = await usersCollection.findOne({
      $or: [{ phone: INIT_TENANT_PHONE }, { email: INIT_TENANT_EMAIL }],
    });

    const now = new Date();
    if (user) {
      // Update existing user
      const passwordHash = await bcrypt.hash(INIT_TENANT_PASSWORD, 10);
      await usersCollection.updateOne(
        { _id: user._id },
        {
          $set: {
            organizationId,
            phone: INIT_TENANT_PHONE,
            email: INIT_TENANT_EMAIL,
            passwordHash,
            roles: ['TENANT'],
            status: 'active',
            updatedAt: now,
          },
        },
      );
      user = await usersCollection.findOne({ _id: user._id });
      console.log(`✅ User account updated for tenant`);
    } else {
      // Create new user
      const passwordHash = await bcrypt.hash(INIT_TENANT_PASSWORD, 10);
      const userDoc: Omit<User, '_id'> = {
        organizationId,
        phone: INIT_TENANT_PHONE,
        email: INIT_TENANT_EMAIL,
        passwordHash,
        roles: ['TENANT'],
        status: 'active',
        createdAt: now,
        updatedAt: now,
      };
      const result = await usersCollection.insertOne(userDoc as any);
      user = {
        _id: result.insertedId,
        ...userDoc,
      } as User;
      console.log(`✅ User account created for tenant`);
    }

    console.log('\n====================================');
    console.log('✅ Tenant User Account Created!');
    console.log('====================================\n');
    console.log('📋 Login Credentials:\n');
    console.log(`Phone: ${INIT_TENANT_PHONE}`);
    console.log(`Email: ${INIT_TENANT_EMAIL}`);
    console.log(`Password: ${INIT_TENANT_PASSWORD}\n`);
    console.log('🔗 You can now log in at: /tenant/login\n');
  } catch (error) {
    console.error('❌ Error creating tenant user:', error);
    throw error;
  } finally {
    await client.close();
    console.log('✅ Database connection closed');
  }
}

// Run the script
createTenantUser()
  .then(() => {
    console.log('\n🎉 All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Failed:', error);
    process.exit(1);
  });
