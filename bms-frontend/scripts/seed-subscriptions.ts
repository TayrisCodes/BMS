#!/usr/bin/env tsx
/**
 * Subscription seeding script
 * Creates test subscriptions for existing organizations
 * Usage: MONGODB_URI="your-connection-string" tsx scripts/seed-subscriptions.ts
 */

import { MongoClient, ObjectId, Db } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27021/bms?authSource=admin';

interface Organization {
  _id: ObjectId;
  name: string;
  code: string;
}

interface Subscription {
  _id?: ObjectId;
  organizationId: string;
  tier: 'starter' | 'growth' | 'enterprise';
  status: 'active' | 'trial' | 'expired' | 'cancelled' | 'suspended';
  billingCycle: 'monthly' | 'quarterly' | 'annually';
  basePrice: number;
  discountType?: 'percentage' | 'fixed' | null;
  discountValue?: number | null;
  price: number;
  currency: string;
  startDate: Date;
  endDate?: Date | null;
  trialEndDate?: Date | null;
  autoRenew: boolean;
  maxBuildings?: number | null;
  maxUnits?: number | null;
  maxUsers?: number | null;
  features: string[];
  paymentMethod?: {
    provider: string;
    last4?: string;
    expiryDate?: string;
  } | null;
  lastPaymentDate?: Date | null;
  nextBillingDate?: Date | null;
  cancellationDate?: Date | null;
  cancellationReason?: string | null;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const SUBSCRIPTION_PRICING = {
  starter: {
    monthly: 2500,
    quarterly: 7000,
    annually: 25000,
  },
  growth: {
    monthly: 5000,
    quarterly: 14000,
    annually: 50000,
  },
  enterprise: {
    monthly: 0,
    quarterly: 0,
    annually: 0,
  },
};

const SUBSCRIPTION_FEATURES = {
  starter: [
    'Core modules (Tenants, Leases, Billing)',
    'Basic Maintenance',
    'Up to 5 buildings',
    'Email support',
    'Basic reporting',
  ],
  growth: [
    'All Starter features',
    'Advanced Maintenance',
    'Utilities Management',
    'Parking & Vehicle Management',
    'Up to 20 buildings',
    'Priority support',
    'Advanced analytics',
    'Exportable reports',
  ],
  enterprise: [
    'All Growth features',
    'Unlimited buildings',
    'IoT Integration',
    'ERCA Integration',
    'Advanced Analytics',
    'Dedicated support & SLA',
    'Custom integrations',
  ],
};

function calculateEndDate(
  startDate: Date,
  billingCycle: 'monthly' | 'quarterly' | 'annually',
): Date {
  const endDate = new Date(startDate);
  if (billingCycle === 'monthly') {
    endDate.setMonth(endDate.getMonth() + 1);
  } else if (billingCycle === 'quarterly') {
    endDate.setMonth(endDate.getMonth() + 3);
  } else if (billingCycle === 'annually') {
    endDate.setFullYear(endDate.getFullYear() + 1);
  }
  return endDate;
}

function calculatePrice(
  basePrice: number,
  discountType?: 'percentage' | 'fixed' | null,
  discountValue?: number | null,
): number {
  if (
    !discountType ||
    discountValue === null ||
    discountValue === undefined ||
    discountValue === 0
  ) {
    return basePrice;
  }

  if (discountType === 'percentage') {
    return Math.round(basePrice * (1 - discountValue / 100) * 100) / 100;
  } else {
    return Math.max(0, Math.round((basePrice - discountValue) * 100) / 100);
  }
}

async function seedSubscriptions(db: Db) {
  const organizationsCollection = db.collection<Organization>('organizations');
  const subscriptionsCollection = db.collection<Subscription>('subscriptions');

  // Get all organizations
  const organizations = await organizationsCollection.find({}).toArray();

  if (organizations.length === 0) {
    console.log('❌ No organizations found. Please seed organizations first.');
    return;
  }

  console.log(`📦 Found ${organizations.length} organizations`);

  // Clear existing subscriptions (optional - comment out if you want to keep them)
  const deleteResult = await subscriptionsCollection.deleteMany({});
  console.log(`🗑️  Deleted ${deleteResult.deletedCount} existing subscriptions`);

  const now = new Date();
  const subscriptions: Subscription[] = [];

  // Create subscriptions for each organization with variety
  for (let i = 0; i < organizations.length; i++) {
    const org = organizations[i];

    // Vary subscription types
    const tierIndex = i % 3;
    const tiers: ('starter' | 'growth' | 'enterprise')[] = ['starter', 'growth', 'enterprise'];
    const tier = tiers[tierIndex];

    const billingCycleIndex = i % 3;
    const cycles: ('monthly' | 'quarterly' | 'annually')[] = ['monthly', 'quarterly', 'annually'];
    const billingCycle = cycles[billingCycleIndex];

    // Calculate dates
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - i * 7); // Stagger start dates
    const endDate = calculateEndDate(startDate, billingCycle);

    // Base price
    const basePrice = SUBSCRIPTION_PRICING[tier][billingCycle] || 0;

    // Apply discounts for quarterly and annually
    let discountType: 'percentage' | 'fixed' | null = null;
    let discountValue: number | null = null;
    if (billingCycle === 'quarterly') {
      discountType = 'percentage';
      discountValue = 7;
    } else if (billingCycle === 'annually') {
      discountType = 'percentage';
      discountValue = 17;
    }

    // Special cases for testing
    if (i === 0) {
      // First org: trial subscription
      const trialEndDate = new Date(startDate);
      trialEndDate.setDate(trialEndDate.getDate() + 14);

      subscriptions.push({
        organizationId: org._id.toString(),
        tier: 'starter',
        status: 'trial',
        billingCycle: 'monthly',
        basePrice: SUBSCRIPTION_PRICING.starter.monthly,
        discountType: null,
        discountValue: null,
        price: SUBSCRIPTION_PRICING.starter.monthly,
        currency: 'ETB',
        startDate,
        endDate,
        trialEndDate,
        autoRenew: true,
        maxBuildings: 5,
        maxUnits: 50,
        maxUsers: 10,
        features: SUBSCRIPTION_FEATURES.starter,
        paymentMethod: null,
        lastPaymentDate: null,
        nextBillingDate: endDate,
        cancellationDate: null,
        cancellationReason: null,
        notes: 'Trial subscription for testing',
        createdAt: startDate,
        updatedAt: startDate,
      });
    } else if (i === 1) {
      // Second org: custom discount
      subscriptions.push({
        organizationId: org._id.toString(),
        tier: 'growth',
        status: 'active',
        billingCycle: 'monthly',
        basePrice: SUBSCRIPTION_PRICING.growth.monthly,
        discountType: 'percentage',
        discountValue: 15, // Custom 15% discount
        price: calculatePrice(SUBSCRIPTION_PRICING.growth.monthly, 'percentage', 15),
        currency: 'ETB',
        startDate,
        endDate,
        trialEndDate: null,
        autoRenew: true,
        maxBuildings: 20,
        maxUnits: 200,
        maxUsers: 50,
        features: SUBSCRIPTION_FEATURES.growth,
        paymentMethod: null,
        lastPaymentDate: null,
        nextBillingDate: endDate,
        cancellationDate: null,
        cancellationReason: null,
        notes: 'Custom discount applied',
        createdAt: startDate,
        updatedAt: startDate,
      });
    } else if (i === 2) {
      // Third org: fixed discount
      subscriptions.push({
        organizationId: org._id.toString(),
        tier: 'starter',
        status: 'active',
        billingCycle: 'monthly',
        basePrice: SUBSCRIPTION_PRICING.starter.monthly,
        discountType: 'fixed',
        discountValue: 500, // Fixed 500 ETB discount
        price: calculatePrice(SUBSCRIPTION_PRICING.starter.monthly, 'fixed', 500),
        currency: 'ETB',
        startDate,
        endDate,
        trialEndDate: null,
        autoRenew: false,
        maxBuildings: 5,
        maxUnits: 50,
        maxUsers: 10,
        features: SUBSCRIPTION_FEATURES.starter,
        paymentMethod: null,
        lastPaymentDate: null,
        nextBillingDate: endDate,
        cancellationDate: null,
        cancellationReason: null,
        notes: 'Fixed discount of 500 ETB',
        createdAt: startDate,
        updatedAt: startDate,
      });
    } else if (i === 3) {
      // Fourth org: expired subscription
      const expiredStartDate = new Date(now);
      expiredStartDate.setMonth(expiredStartDate.getMonth() - 2);
      const expiredEndDate = calculateEndDate(expiredStartDate, 'monthly');

      subscriptions.push({
        organizationId: org._id.toString(),
        tier: 'starter',
        status: 'expired',
        billingCycle: 'monthly',
        basePrice: SUBSCRIPTION_PRICING.starter.monthly,
        discountType: null,
        discountValue: null,
        price: SUBSCRIPTION_PRICING.starter.monthly,
        currency: 'ETB',
        startDate: expiredStartDate,
        endDate: expiredEndDate,
        trialEndDate: null,
        autoRenew: false,
        maxBuildings: 5,
        maxUnits: 50,
        maxUsers: 10,
        features: SUBSCRIPTION_FEATURES.starter,
        paymentMethod: null,
        lastPaymentDate: null,
        nextBillingDate: expiredEndDate,
        cancellationDate: null,
        cancellationReason: null,
        notes: 'Expired subscription',
        createdAt: expiredStartDate,
        updatedAt: expiredStartDate,
      });
    } else {
      // Default: standard subscription
      subscriptions.push({
        organizationId: org._id.toString(),
        tier,
        status: 'active',
        billingCycle,
        basePrice,
        discountType,
        discountValue,
        price: calculatePrice(basePrice, discountType, discountValue),
        currency: 'ETB',
        startDate,
        endDate,
        trialEndDate: null,
        autoRenew: true,
        maxBuildings: tier === 'starter' ? 5 : tier === 'growth' ? 20 : null,
        maxUnits: tier === 'starter' ? 50 : tier === 'growth' ? 200 : null,
        maxUsers: tier === 'starter' ? 10 : tier === 'growth' ? 50 : null,
        features: SUBSCRIPTION_FEATURES[tier],
        paymentMethod: null,
        lastPaymentDate: null,
        nextBillingDate: endDate,
        cancellationDate: null,
        cancellationReason: null,
        notes: `Standard ${tier} subscription with ${billingCycle} billing`,
        createdAt: startDate,
        updatedAt: startDate,
      });
    }
  }

  // Insert subscriptions
  if (subscriptions.length > 0) {
    const result = await subscriptionsCollection.insertMany(subscriptions as any);
    console.log(`✅ Created ${result.insertedCount} subscriptions`);

    // Update organizations with subscription IDs
    for (let i = 0; i < subscriptions.length; i++) {
      const sub = subscriptions[i];
      if (sub._id) {
        await organizationsCollection.updateOne(
          { _id: new ObjectId(sub.organizationId) },
          { $set: { subscriptionId: sub._id.toString() } },
        );
      }
    }
    console.log(`✅ Updated ${subscriptions.length} organizations with subscription IDs`);
  }

  // Print summary
  console.log('\n📊 Subscription Summary:');
  const summary = await subscriptionsCollection
    .aggregate([
      {
        $group: {
          _id: { tier: '$tier', status: '$status', billingCycle: '$billingCycle' },
          count: { $sum: 1 },
          totalRevenue: { $sum: '$price' },
        },
      },
      { $sort: { '_id.tier': 1, '_id.status': 1 } },
    ])
    .toArray();

  summary.forEach((item) => {
    console.log(
      `  ${item._id.tier} | ${item._id.status} | ${item._id.billingCycle}: ${item.count} subscriptions, ${item.totalRevenue} ETB`,
    );
  });
}

async function main() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db();
    await seedSubscriptions(db);

    console.log('\n✅ Subscription seeding completed!');
  } catch (error) {
    console.error('❌ Error seeding subscriptions:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();



