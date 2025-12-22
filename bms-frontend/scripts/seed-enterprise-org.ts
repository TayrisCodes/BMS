#!/usr/bin/env tsx
/**
 * Seed Enterprise Organization Script
 * Creates an organization with enterprise subscription and admin user
 * Usage: MONGODB_URI="your-connection-string" tsx scripts/seed-enterprise-org.ts
 */

import { MongoClient, ObjectId, Db } from 'mongodb';
import * as bcrypt from 'bcryptjs';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27021/bms?authSource=admin';

// Configuration
const ORG_NAME = 'Enterprise Building Management';
const ORG_CODE = 'ENTERPRISE-BM';
const SUBDOMAIN = 'enterprise';
const ADMIN_EMAIL = 'admin@enterprise.com';
const ADMIN_PASSWORD = 'Enterprise@2024';
const ADMIN_PHONE = '+251911234567';

interface Organization {
  _id: ObjectId;
  name: string;
  code: string;
  subdomain?: string | null;
  domain?: string | null;
  contactInfo?: {
    email?: string;
    phone?: string;
    address?: string;
  } | null;
  subscriptionId?: string | null;
  status?: string;
  branding?: {
    primaryColor?: string;
    secondaryColor?: string;
    companyName?: string;
    tagline?: string;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

interface Subscription {
  _id: ObjectId;
  organizationId: string;
  tier: 'enterprise';
  status: 'active';
  billingCycle: 'annually';
  basePrice: number;
  price: number;
  currency: string;
  startDate: Date;
  endDate: Date | null;
  trialEndDate: Date | null;
  autoRenew: boolean;
  maxBuildings: number | null; // null = unlimited
  maxUnits: number | null; // null = unlimited
  maxUsers: number | null; // null = unlimited
  features: string[];
  createdAt: Date;
  updatedAt: Date;
}

interface User {
  _id: ObjectId;
  organizationId: string;
  email: string;
  phone: string;
  passwordHash: string;
  roles: string[];
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

async function seedEnterpriseOrganization() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db();
    const now = new Date();

    // 1. Create Organization
    console.log('\n📦 Creating organization...');
    const orgDoc: Omit<Organization, '_id'> = {
      name: ORG_NAME,
      code: ORG_CODE,
      subdomain: SUBDOMAIN,
      domain: null,
      contactInfo: {
        email: ADMIN_EMAIL,
        phone: ADMIN_PHONE,
        address: 'Addis Ababa, Ethiopia',
      },
      subscriptionId: null, // Will be set after subscription creation
      status: 'active',
      branding: {
        primaryColor: '#3b82f6',
        secondaryColor: '#8b5cf6',
        companyName: ORG_NAME,
        tagline: 'Unlimited Building Management Solutions',
      },
      createdAt: now,
      updatedAt: now,
    };

    const orgResult = await db.collection('organizations').insertOne(orgDoc as any);
    const organizationId = orgResult.insertedId.toString();
    console.log(`✅ Organization created: ${organizationId}`);
    console.log(`   Name: ${ORG_NAME}`);
    console.log(`   Code: ${ORG_CODE}`);
    console.log(`   Subdomain: ${SUBDOMAIN}`);

    // 2. Create Enterprise Subscription
    console.log('\n💳 Creating enterprise subscription...');
    const startDate = new Date();
    const endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + 1); // 1 year subscription

    const subscriptionDoc: Omit<Subscription, '_id'> = {
      organizationId,
      tier: 'enterprise',
      status: 'active',
      billingCycle: 'annually',
      basePrice: 0, // Custom pricing for enterprise
      price: 0, // Custom pricing
      currency: 'ETB',
      startDate,
      endDate,
      trialEndDate: null,
      autoRenew: true,
      maxBuildings: null, // Unlimited
      maxUnits: null, // Unlimited
      maxUsers: null, // Unlimited
      features: [
        'All Growth features',
        'Unlimited buildings',
        'IoT Integration',
        'ERCA Integration',
        'Advanced Analytics',
        'Dedicated support & SLA',
        'Custom integrations',
        'White-label branding',
        'Custom domain support',
        'Priority support 24/7',
      ],
      createdAt: now,
      updatedAt: now,
    };

    const subResult = await db.collection('subscriptions').insertOne(subscriptionDoc as any);
    const subscriptionId = subResult.insertedId.toString();
    console.log(`✅ Subscription created: ${subscriptionId}`);
    console.log(`   Tier: Enterprise`);
    console.log(`   Status: Active`);
    console.log(`   Buildings: Unlimited`);
    console.log(`   Units: Unlimited`);
    console.log(`   Users: Unlimited`);

    // 3. Update organization with subscription ID
    await db
      .collection('organizations')
      .updateOne(
        { _id: new ObjectId(organizationId) },
        { $set: { subscriptionId, updatedAt: new Date() } },
      );
    console.log('✅ Organization linked to subscription');

    // 4. Create Admin User
    console.log('\n👤 Creating admin user...');
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

    const userDoc: Omit<User, '_id'> = {
      organizationId,
      email: ADMIN_EMAIL,
      phone: ADMIN_PHONE,
      passwordHash,
      roles: ['ORG_ADMIN'],
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    const userResult = await db.collection('users').insertOne(userDoc as any);
    const userId = userResult.insertedId.toString();
    console.log(`✅ Admin user created: ${userId}`);
    console.log(`   Email: ${ADMIN_EMAIL}`);
    console.log(`   Phone: ${ADMIN_PHONE}`);
    console.log(`   Role: ORG_ADMIN`);

    // 5. Print Summary
    console.log('\n' + '='.repeat(60));
    console.log('🎉 ENTERPRISE ORGANIZATION CREATED SUCCESSFULLY!');
    console.log('='.repeat(60));
    console.log('\n📋 CREDENTIALS:');
    console.log('─'.repeat(60));
    console.log(`Email:        ${ADMIN_EMAIL}`);
    console.log(`Password:     ${ADMIN_PASSWORD}`);
    console.log(`Phone:         ${ADMIN_PHONE}`);
    console.log(`Subdomain:    ${SUBDOMAIN}`);
    console.log(`Organization: ${ORG_NAME} (${ORG_CODE})`);
    console.log('\n🌐 ACCESS URLs:');
    console.log('─'.repeat(60));
    console.log(`Main App:     http://localhost:3000`);
    console.log(`Org Portal:   http://${SUBDOMAIN}.localhost:3000`);
    console.log(`Login:        http://localhost:3000/login`);
    console.log('\n📝 NOTES:');
    console.log('─'.repeat(60));
    console.log('1. Add to /etc/hosts: 127.0.0.1 enterprise.localhost');
    console.log('2. Subscription: Enterprise (Unlimited everything)');
    console.log('3. User Role: ORG_ADMIN (Full organization access)');
    console.log('4. Status: Active');
    console.log('\n' + '='.repeat(60));
  } catch (error) {
    console.error('❌ Error seeding enterprise organization:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n✅ Database connection closed');
  }
}

// Run the script
seedEnterpriseOrganization()
  .then(() => {
    console.log('\n✨ Seeding completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Seeding failed:', error);
    process.exit(1);
  });



