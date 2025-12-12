// Client-safe types and constants for subscriptions
// This file can be imported in client components

export type SubscriptionTier = 'starter' | 'growth' | 'enterprise';
export type SubscriptionStatus = 'active' | 'trial' | 'expired' | 'cancelled' | 'suspended';
export type BillingCycle = 'monthly' | 'quarterly' | 'annually';
export type DiscountType = 'percentage' | 'fixed';

// Available subscription tiers
export const SUBSCRIPTION_TIERS: SubscriptionTier[] = ['starter', 'growth', 'enterprise'];

// Subscription tier base pricing (in ETB) - used as defaults only
export const SUBSCRIPTION_PRICING: Record<
  SubscriptionTier,
  { monthly: number; quarterly: number; annually: number }
> = {
  starter: {
    monthly: 2500,
    quarterly: 7000, // ~7% discount
    annually: 25000, // ~17% discount
  },
  growth: {
    monthly: 5000,
    quarterly: 14000, // ~7% discount
    annually: 50000, // ~17% discount
  },
  enterprise: {
    monthly: 0, // Custom pricing
    quarterly: 0,
    annually: 0,
  },
};

// Default discount rates for billing cycles
export const DEFAULT_DISCOUNTS: Record<BillingCycle, { type: DiscountType; value: number }> = {
  monthly: { type: 'percentage', value: 0 },
  quarterly: { type: 'percentage', value: 7 },
  annually: { type: 'percentage', value: 17 },
};

// Subscription tier features
export const SUBSCRIPTION_FEATURES: Record<SubscriptionTier, string[]> = {
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
