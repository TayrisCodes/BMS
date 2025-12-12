import type { Collection, Db, IndexDescription, Document, OptionalUnlessRequiredId } from 'mongodb';
import { getDb } from '@/lib/db';
import type { SubscriptionTier, SubscriptionStatus, BillingCycle } from './types';
import { SUBSCRIPTION_PRICING, SUBSCRIPTION_FEATURES } from './types';

const SUBSCRIPTIONS_COLLECTION_NAME = 'subscriptions';

// Re-export types for convenience
export type { SubscriptionTier, SubscriptionStatus, BillingCycle };

export interface Subscription {
  _id: string;
  organizationId: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  basePrice: number; // Base price before discount (in ETB)
  discountType?: 'percentage' | 'fixed' | null; // Type of discount applied
  discountValue?: number | null; // Discount amount (percentage or fixed ETB)
  price: number; // Final price after discount (in ETB)
  currency: string; // Default: 'ETB'
  startDate: Date;
  endDate?: Date | null;
  trialEndDate?: Date | null;
  autoRenew: boolean;
  maxBuildings?: number | null;
  maxUnits?: number | null;
  maxUsers?: number | null;
  features: string[]; // Feature flags enabled for this subscription
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

export interface CreateSubscriptionInput {
  organizationId: string;
  tier: SubscriptionTier;
  billingCycle: BillingCycle;
  basePrice?: number; // Optional: if not provided, uses default pricing
  discountType?: 'percentage' | 'fixed' | null;
  discountValue?: number | null;
  price?: number; // Optional: if provided, used directly (overrides basePrice + discount)
  startDate?: Date;
  trialDays?: number;
  autoRenew?: boolean;
  maxBuildings?: number | null;
  maxUnits?: number | null;
  maxUsers?: number | null;
  features?: string[]; // Optional: if not provided, uses tier defaults
}

export interface UpdateSubscriptionInput {
  tier?: SubscriptionTier;
  status?: SubscriptionStatus;
  billingCycle?: BillingCycle;
  basePrice?: number;
  discountType?: 'percentage' | 'fixed' | null;
  discountValue?: number | null;
  price?: number; // Optional: if provided, used directly (overrides basePrice + discount)
  autoRenew?: boolean;
  maxBuildings?: number | null;
  maxUnits?: number | null;
  maxUsers?: number | null;
  features?: string[];
  startDate?: Date | null;
  endDate?: Date | null;
  trialEndDate?: Date | null;
  nextBillingDate?: Date | null;
  cancellationDate?: Date | null;
  cancellationReason?: string | null;
  notes?: string | null;
}

export async function getSubscriptionsCollection(): Promise<Collection<Subscription>> {
  const db = await getDb();
  return db.collection<Subscription>(SUBSCRIPTIONS_COLLECTION_NAME);
}

export async function ensureSubscriptionIndexes(db?: Db): Promise<void> {
  const database = db ?? (await getDb());
  const collection = database.collection(SUBSCRIPTIONS_COLLECTION_NAME);

  const indexes: IndexDescription[] = [
    { key: { organizationId: 1 }, name: 'idx_organizationId' },
    { key: { status: 1 }, name: 'idx_status' },
    { key: { tier: 1 }, name: 'idx_tier' },
    { key: { endDate: 1 }, name: 'idx_endDate' },
  ];

  await collection.createIndexes(indexes);
}

export async function findSubscriptionByOrganizationId(
  organizationId: string,
): Promise<Subscription | null> {
  const collection = await getSubscriptionsCollection();
  const subscription = await collection.findOne({
    organizationId,
    status: { $in: ['active', 'trial'] },
  } as Document);

  return subscription as Subscription | null;
}

export async function findSubscriptionById(subscriptionId: string): Promise<Subscription | null> {
  const collection = await getSubscriptionsCollection();
  const { ObjectId } = await import('mongodb');

  try {
    return collection.findOne({ _id: new ObjectId(subscriptionId) } as Document);
  } catch {
    return null;
  }
}

// Helper function to calculate final price with discount
function calculateFinalPrice(
  basePrice: number,
  discountType?: 'percentage' | 'fixed' | null,
  discountValue?: number | null,
): {
  basePrice: number;
  discountType: 'percentage' | 'fixed' | null;
  discountValue: number | null;
  finalPrice: number;
} {
  if (
    !discountType ||
    discountValue === null ||
    discountValue === undefined ||
    discountValue === 0
  ) {
    return { basePrice, discountType: null, discountValue: null, finalPrice: basePrice };
  }

  let finalPrice = basePrice;
  if (discountType === 'percentage') {
    finalPrice = basePrice * (1 - discountValue / 100);
  } else if (discountType === 'fixed') {
    finalPrice = Math.max(0, basePrice - discountValue);
  }

  return {
    basePrice,
    discountType,
    discountValue,
    finalPrice: Math.round(finalPrice * 100) / 100, // Round to 2 decimal places
  };
}

export async function createSubscription(input: CreateSubscriptionInput): Promise<Subscription> {
  const collection = await getSubscriptionsCollection();
  const now = new Date();
  const startDate = input.startDate || now;

  // Calculate base price
  let basePrice = input.basePrice;
  if (basePrice === undefined || basePrice === null) {
    const pricing = SUBSCRIPTION_PRICING[input.tier];
    basePrice = pricing[input.billingCycle] || 0;
  }

  // Calculate final price with discount
  const priceCalculation =
    input.price !== undefined && input.price !== null
      ? {
          basePrice,
          discountType: input.discountType || null,
          discountValue: input.discountValue || null,
          finalPrice: input.price,
        }
      : calculateFinalPrice(basePrice, input.discountType, input.discountValue);

  // Calculate end date based on billing cycle
  let endDate: Date | null = null;
  if (input.billingCycle === 'monthly') {
    endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);
  } else if (input.billingCycle === 'quarterly') {
    endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 3);
  } else if (input.billingCycle === 'annually') {
    endDate = new Date(startDate);
    endDate.setFullYear(endDate.getFullYear() + 1);
  }

  // Calculate trial end date if trial days provided
  let trialEndDate: Date | null = null;
  if (input.trialDays && input.trialDays > 0) {
    trialEndDate = new Date(startDate);
    trialEndDate.setDate(trialEndDate.getDate() + input.trialDays);
  }

  // Calculate next billing date
  const nextBillingDate = endDate ? new Date(endDate) : null;

  const doc: Omit<Subscription, '_id'> = {
    organizationId: input.organizationId,
    tier: input.tier,
    status: input.trialDays && input.trialDays > 0 ? 'trial' : 'active',
    billingCycle: input.billingCycle,
    basePrice: priceCalculation.basePrice,
    discountType: priceCalculation.discountType,
    discountValue: priceCalculation.discountValue,
    price: priceCalculation.finalPrice,
    currency: 'ETB',
    startDate,
    endDate,
    trialEndDate,
    autoRenew: input.autoRenew ?? true,
    maxBuildings: input.maxBuildings ?? null,
    maxUnits: input.maxUnits ?? null,
    maxUsers: input.maxUsers ?? null,
    features: input.features || SUBSCRIPTION_FEATURES[input.tier],
    paymentMethod: null,
    lastPaymentDate: null,
    nextBillingDate,
    cancellationDate: null,
    cancellationReason: null,
    notes: null,
    createdAt: now,
    updatedAt: now,
  };

  const result = await collection.insertOne(doc as OptionalUnlessRequiredId<Subscription>);

  return {
    ...(doc as Subscription),
    _id: result.insertedId.toString(),
  } as Subscription;
}

export async function updateSubscription(
  subscriptionId: string,
  input: UpdateSubscriptionInput,
): Promise<Subscription | null> {
  const collection = await getSubscriptionsCollection();
  const { ObjectId } = await import('mongodb');

  const subscription = await findSubscriptionById(subscriptionId);
  if (!subscription) {
    return null;
  }

  const updates: Partial<Subscription> = {
    updatedAt: new Date(),
  };

  // Handle tier changes
  if (input.tier !== undefined) {
    updates.tier = input.tier;
    updates.features = input.features || SUBSCRIPTION_FEATURES[input.tier];
  }

  // Handle status changes
  if (input.status !== undefined) {
    updates.status = input.status;
  }

  // Handle billing cycle changes
  if (input.billingCycle !== undefined) {
    updates.billingCycle = input.billingCycle;

    // Recalculate end date if billing cycle changed
    const startDate = input.startDate ? new Date(input.startDate) : subscription.startDate;
    let endDate: Date | null = null;
    if (input.billingCycle === 'monthly') {
      endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1);
    } else if (input.billingCycle === 'quarterly') {
      endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 3);
    } else if (input.billingCycle === 'annually') {
      endDate = new Date(startDate);
      endDate.setFullYear(endDate.getFullYear() + 1);
    }
    updates.endDate = endDate;
    updates.nextBillingDate = endDate;
  }

  // Handle start date changes
  if (input.startDate !== undefined) {
    updates.startDate = input.startDate ? new Date(input.startDate) : null;
    // Recalculate end date if start date changed
    if (updates.startDate && subscription.billingCycle) {
      const billingCycle = input.billingCycle || subscription.billingCycle;
      let endDate: Date | null = null;
      if (billingCycle === 'monthly') {
        endDate = new Date(updates.startDate);
        endDate.setMonth(endDate.getMonth() + 1);
      } else if (billingCycle === 'quarterly') {
        endDate = new Date(updates.startDate);
        endDate.setMonth(endDate.getMonth() + 3);
      } else if (billingCycle === 'annually') {
        endDate = new Date(updates.startDate);
        endDate.setFullYear(endDate.getFullYear() + 1);
      }
      updates.endDate = endDate;
      updates.nextBillingDate = endDate;
    }
  }

  // Handle price and discount updates
  if (input.price !== undefined && input.price !== null) {
    // Direct price override
    updates.price = input.price;
    if (input.basePrice !== undefined) {
      updates.basePrice = input.basePrice;
    }
    if (input.discountType !== undefined) {
      updates.discountType = input.discountType;
    }
    if (input.discountValue !== undefined) {
      updates.discountValue = input.discountValue;
    }
  } else if (
    input.basePrice !== undefined ||
    input.discountType !== undefined ||
    input.discountValue !== undefined
  ) {
    // Recalculate price from base price and discount
    const basePrice = input.basePrice !== undefined ? input.basePrice : subscription.basePrice;
    const discountType =
      input.discountType !== undefined ? input.discountType : subscription.discountType;
    const discountValue =
      input.discountValue !== undefined ? input.discountValue : subscription.discountValue;

    const priceCalculation = calculateFinalPrice(basePrice, discountType, discountValue);
    updates.basePrice = priceCalculation.basePrice;
    updates.discountType = priceCalculation.discountType;
    updates.discountValue = priceCalculation.discountValue;
    updates.price = priceCalculation.finalPrice;
  } else if (input.tier !== undefined || input.billingCycle !== undefined) {
    // Recalculate base price if tier or billing cycle changed
    const tier = input.tier || subscription.tier;
    const billingCycle = input.billingCycle || subscription.billingCycle;
    const pricing = SUBSCRIPTION_PRICING[tier];
    const newBasePrice = pricing[billingCycle] || 0;

    // Keep existing discount if not overridden
    const discountType =
      input.discountType !== undefined ? input.discountType : subscription.discountType;
    const discountValue =
      input.discountValue !== undefined ? input.discountValue : subscription.discountValue;

    const priceCalculation = calculateFinalPrice(newBasePrice, discountType, discountValue);
    updates.basePrice = priceCalculation.basePrice;
    updates.discountType = priceCalculation.discountType;
    updates.discountValue = priceCalculation.discountValue;
    updates.price = priceCalculation.finalPrice;
  }

  // Handle other fields
  if (input.autoRenew !== undefined) {
    updates.autoRenew = input.autoRenew;
  }
  if (input.maxBuildings !== undefined) {
    updates.maxBuildings = input.maxBuildings;
  }
  if (input.maxUnits !== undefined) {
    updates.maxUnits = input.maxUnits;
  }
  if (input.maxUsers !== undefined) {
    updates.maxUsers = input.maxUsers;
  }
  if (input.features !== undefined) {
    updates.features = input.features;
  }
  if (input.endDate !== undefined) {
    updates.endDate = input.endDate ? new Date(input.endDate) : null;
  }
  if (input.trialEndDate !== undefined) {
    updates.trialEndDate = input.trialEndDate ? new Date(input.trialEndDate) : null;
  }
  if (input.nextBillingDate !== undefined) {
    updates.nextBillingDate = input.nextBillingDate ? new Date(input.nextBillingDate) : null;
  }
  if (input.cancellationDate !== undefined) {
    updates.cancellationDate = input.cancellationDate ? new Date(input.cancellationDate) : null;
  }
  if (input.cancellationReason !== undefined) {
    updates.cancellationReason = input.cancellationReason;
  }
  if (input.notes !== undefined) {
    updates.notes = input.notes;
  }

  const result = await collection.updateOne(
    { _id: new ObjectId(subscriptionId) } as Document,
    { $set: updates } as Document,
  );

  if (result.modifiedCount === 0 && Object.keys(updates).length > 1) {
    // Only return null if we actually tried to update something
    return null;
  }

  return findSubscriptionById(subscriptionId);
}

export async function cancelSubscription(
  subscriptionId: string,
  reason?: string,
): Promise<Subscription | null> {
  return updateSubscription(subscriptionId, {
    status: 'cancelled',
    cancellationDate: new Date(),
    cancellationReason: reason || null,
    autoRenew: false,
  });
}
