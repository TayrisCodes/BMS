'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/lib/components/ui/dialog';
import { Button } from '@/lib/components/ui/button';
import { Label } from '@/lib/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/lib/components/ui/select';
import { Input } from '@/lib/components/ui/input';
import { Badge } from '@/lib/components/ui/badge';
import { Checkbox } from '@/lib/components/ui/checkbox';
import { Textarea } from '@/lib/components/ui/textarea';
import { apiPost, apiPatch, apiDelete } from '@/lib/utils/api-client';
import type {
  SubscriptionTier,
  BillingCycle,
  SubscriptionStatus,
  DiscountType,
} from '@/lib/subscriptions/types';
import {
  SUBSCRIPTION_PRICING,
  SUBSCRIPTION_FEATURES,
  DEFAULT_DISCOUNTS,
} from '@/lib/subscriptions/types';
import { CheckCircle2, XCircle, CreditCard, Calendar, Percent, DollarSign } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/lib/components/ui/tabs';

interface Subscription {
  id: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  basePrice?: number;
  discountType?: DiscountType | null;
  discountValue?: number | null;
  price: number;
  startDate: string | Date;
  endDate?: string | Date | null;
  trialEndDate?: string | Date | null;
  nextBillingDate?: string | Date | null;
  autoRenew: boolean;
  maxBuildings?: number | null;
  maxUnits?: number | null;
  maxUsers?: number | null;
  features: string[];
  notes?: string | null;
}

interface SubscriptionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  existingSubscription?: Subscription | null;
  onSuccess?: () => void;
}

export function SubscriptionModal({
  open,
  onOpenChange,
  organizationId,
  existingSubscription,
  onSuccess,
}: SubscriptionModalProps) {
  const [tier, setTier] = useState<SubscriptionTier>('starter');
  const [status, setStatus] = useState<SubscriptionStatus>('active');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [basePrice, setBasePrice] = useState<number>(0);
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed' | null>(null);
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [finalPrice, setFinalPrice] = useState<number>(0);
  const [useCustomPrice, setUseCustomPrice] = useState(false);
  const [customPrice, setCustomPrice] = useState<number>(0);
  const [autoRenew, setAutoRenew] = useState(true);
  const [trialDays, setTrialDays] = useState(0);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [trialEndDate, setTrialEndDate] = useState<string>('');
  const [nextBillingDate, setNextBillingDate] = useState<string>('');
  const [maxBuildings, setMaxBuildings] = useState<string>('');
  const [maxUnits, setMaxUnits] = useState<string>('');
  const [maxUsers, setMaxUsers] = useState<string>('');
  const [features, setFeatures] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  // Initialize form from existing subscription
  useEffect(() => {
    if (existingSubscription) {
      setTier(existingSubscription.tier);
      setStatus(existingSubscription.status);
      setBillingCycle(existingSubscription.billingCycle);
      setBasePrice(
        existingSubscription.basePrice ||
          SUBSCRIPTION_PRICING[existingSubscription.tier][existingSubscription.billingCycle],
      );
      setDiscountType(existingSubscription.discountType || null);
      setDiscountValue(existingSubscription.discountValue || 0);
      setFinalPrice(existingSubscription.price);
      setUseCustomPrice(false);
      setAutoRenew(existingSubscription.autoRenew);
      setStartDate(formatDateForInput(existingSubscription.startDate));
      setEndDate(formatDateForInput(existingSubscription.endDate));
      setTrialEndDate(formatDateForInput(existingSubscription.trialEndDate));
      setNextBillingDate(formatDateForInput(existingSubscription.nextBillingDate));
      setMaxBuildings(existingSubscription.maxBuildings?.toString() || '');
      setMaxUnits(existingSubscription.maxUnits?.toString() || '');
      setMaxUsers(existingSubscription.maxUsers?.toString() || '');
      setFeatures(existingSubscription.features?.join('\n') || '');
      setNotes(existingSubscription.notes || '');
    } else {
      // Reset to defaults
      setTier('starter');
      setStatus('active');
      setBillingCycle('monthly');
      const defaultBasePrice = SUBSCRIPTION_PRICING.starter.monthly;
      setBasePrice(defaultBasePrice);
      setDiscountType(null);
      setDiscountValue(0);
      setFinalPrice(defaultBasePrice);
      setUseCustomPrice(false);
      setAutoRenew(true);
      setTrialDays(0);
      setStartDate('');
      setEndDate('');
      setTrialEndDate('');
      setNextBillingDate('');
      setMaxBuildings('');
      setMaxUnits('');
      setMaxUsers('');
      setFeatures('');
      setNotes('');
    }
  }, [existingSubscription, open]);

  // Recalculate price when tier, billing cycle, base price, or discount changes
  useEffect(() => {
    if (!useCustomPrice) {
      const pricing = SUBSCRIPTION_PRICING[tier];
      const newBasePrice = basePrice || pricing[billingCycle] || 0;
      setBasePrice(newBasePrice);

      let calculatedPrice = newBasePrice;
      if (discountType && discountValue > 0) {
        if (discountType === 'percentage') {
          calculatedPrice = newBasePrice * (1 - discountValue / 100);
        } else {
          calculatedPrice = Math.max(0, newBasePrice - discountValue);
        }
      }
      setFinalPrice(Math.round(calculatedPrice * 100) / 100);
    }
  }, [tier, billingCycle, basePrice, discountType, discountValue, useCustomPrice]);

  function formatDateForInput(date: string | Date | undefined | null): string {
    if (!date) return '';
    try {
      const d = new Date(date);
      return d.toISOString().split('T')[0];
    } catch {
      return '';
    }
  }

  function formatDate(date: string | Date | undefined | null): string {
    if (!date) return 'N/A';
    try {
      return new Date(date).toLocaleDateString();
    } catch {
      return 'N/A';
    }
  }

  async function handleCreate() {
    setError(null);
    setIsSubmitting(true);

    try {
      const featuresArray = features.split('\n').filter((f) => f.trim().length > 0);

      const payload: any = {
        organizationId,
        tier,
        billingCycle,
        autoRenew,
        trialDays: trialDays > 0 ? trialDays : undefined,
        maxBuildings: maxBuildings ? parseInt(maxBuildings) : null,
        maxUnits: maxUnits ? parseInt(maxUnits) : null,
        maxUsers: maxUsers ? parseInt(maxUsers) : null,
        features: featuresArray.length > 0 ? featuresArray : undefined,
        notes: notes.trim() || undefined,
      };

      if (startDate) {
        payload.startDate = new Date(startDate);
      }

      if (useCustomPrice) {
        payload.price = customPrice;
      } else {
        payload.basePrice = basePrice;
        if (discountType && discountValue > 0) {
          payload.discountType = discountType;
          payload.discountValue = discountValue;
        }
      }

      await apiPost('/api/subscriptions', payload);
      onSuccess?.();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create subscription');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdate() {
    if (!existingSubscription) return;

    setError(null);
    setIsSubmitting(true);

    try {
      const featuresArray = features.split('\n').filter((f) => f.trim().length > 0);

      const payload: any = {
        tier,
        status,
        billingCycle,
        autoRenew,
        maxBuildings: maxBuildings ? parseInt(maxBuildings) : null,
        maxUnits: maxUnits ? parseInt(maxUnits) : null,
        maxUsers: maxUsers ? parseInt(maxUsers) : null,
        features: featuresArray.length > 0 ? featuresArray : undefined,
        notes: notes.trim() || undefined,
      };

      if (startDate) {
        payload.startDate = new Date(startDate);
      }
      if (endDate) {
        payload.endDate = new Date(endDate);
      }
      if (trialEndDate) {
        payload.trialEndDate = new Date(trialEndDate);
      }
      if (nextBillingDate) {
        payload.nextBillingDate = new Date(nextBillingDate);
      }

      if (useCustomPrice) {
        payload.price = customPrice;
      } else {
        payload.basePrice = basePrice;
        if (discountType && discountValue > 0) {
          payload.discountType = discountType;
          payload.discountValue = discountValue;
        } else {
          payload.discountType = null;
          payload.discountValue = null;
        }
      }

      await apiPatch(`/api/subscriptions/${existingSubscription.id}`, payload);
      onSuccess?.();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update subscription');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCancel() {
    if (!existingSubscription) return;

    if (!confirm('Are you sure you want to cancel this subscription?')) {
      return;
    }

    setError(null);
    setIsCancelling(true);

    try {
      await apiDelete(`/api/subscriptions/${existingSubscription.id}`, {
        reason: 'Cancelled by admin',
      });
      onSuccess?.();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel subscription');
    } finally {
      setIsCancelling(false);
    }
  }

  const defaultFeatures = SUBSCRIPTION_FEATURES[tier];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {existingSubscription ? 'Edit Subscription' : 'Create Subscription'}
          </DialogTitle>
          <DialogDescription>
            {existingSubscription
              ? 'Update subscription details, pricing, and settings'
              : 'Set up a new subscription for this organization'}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="bg-destructive/10 text-destructive p-4 rounded-lg text-sm">{error}</div>
        )}

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="pricing">Pricing & Discount</TabsTrigger>
            <TabsTrigger value="limits">Limits & Features</TabsTrigger>
            <TabsTrigger value="dates">Dates & Notes</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="tier">Subscription Tier *</Label>
                <Select value={tier} onValueChange={(value) => setTier(value as SubscriptionTier)}>
                  <SelectTrigger id="tier">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="growth">Growth</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {existingSubscription && (
                <div>
                  <Label htmlFor="status">Status *</Label>
                  <Select
                    value={status}
                    onValueChange={(value) => setStatus(value as SubscriptionStatus)}
                  >
                    <SelectTrigger id="status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="trial">Trial</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label htmlFor="billingCycle">Billing Cycle *</Label>
                <Select
                  value={billingCycle}
                  onValueChange={(value) => setBillingCycle(value as BillingCycle)}
                >
                  <SelectTrigger id="billingCycle">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="annually">Annually</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {!existingSubscription && (
                <div>
                  <Label htmlFor="trialDays">Trial Days (optional)</Label>
                  <Input
                    id="trialDays"
                    type="number"
                    min="0"
                    max="90"
                    value={trialDays}
                    onChange={(e) => setTrialDays(parseInt(e.target.value) || 0)}
                    placeholder="0"
                  />
                </div>
              )}

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="autoRenew"
                  checked={autoRenew}
                  onCheckedChange={(checked) => setAutoRenew(checked === true)}
                />
                <Label htmlFor="autoRenew" className="cursor-pointer">
                  Auto-renew subscription
                </Label>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="pricing" className="space-y-4">
            <div className="border rounded-lg p-4 space-y-4 bg-muted/50">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Pricing Configuration</Label>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="useCustomPrice"
                    checked={useCustomPrice}
                    onCheckedChange={(checked) => setUseCustomPrice(checked === true)}
                  />
                  <Label htmlFor="useCustomPrice" className="cursor-pointer text-sm">
                    Use custom price
                  </Label>
                </div>
              </div>

              {useCustomPrice ? (
                <div>
                  <Label htmlFor="customPrice">Final Price (ETB) *</Label>
                  <Input
                    id="customPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    value={customPrice}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setCustomPrice(val);
                      setFinalPrice(val);
                    }}
                    placeholder="0.00"
                  />
                </div>
              ) : (
                <>
                  <div>
                    <Label htmlFor="basePrice">Base Price (ETB) *</Label>
                    <Input
                      id="basePrice"
                      type="number"
                      min="0"
                      step="0.01"
                      value={basePrice}
                      onChange={(e) => setBasePrice(parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Default: {SUBSCRIPTION_PRICING[tier][billingCycle].toLocaleString()} ETB
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="discountType">Discount Type</Label>
                      <Select
                        value={discountType || 'none'}
                        onValueChange={(value) =>
                          setDiscountType(value === 'none' ? null : (value as DiscountType))
                        }
                      >
                        <SelectTrigger id="discountType">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Discount</SelectItem>
                          <SelectItem value="percentage">Percentage</SelectItem>
                          <SelectItem value="fixed">Fixed Amount</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {discountType && (
                      <div>
                        <Label htmlFor="discountValue">
                          Discount Value {discountType === 'percentage' ? '(%)' : '(ETB)'} *
                        </Label>
                        <Input
                          id="discountValue"
                          type="number"
                          min="0"
                          step={discountType === 'percentage' ? '0.1' : '0.01'}
                          max={discountType === 'percentage' ? '100' : undefined}
                          value={discountValue}
                          onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                          placeholder="0"
                        />
                      </div>
                    )}
                  </div>
                </>
              )}

              <div className="pt-4 border-t">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Final Price</Label>
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-muted-foreground" />
                    <span className="text-2xl font-bold">
                      {finalPrice.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                    <span className="text-sm text-muted-foreground">ETB</span>
                  </div>
                </div>
                {!useCustomPrice && discountType && discountValue > 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {discountType === 'percentage' ? `${discountValue}%` : `${discountValue} ETB`}{' '}
                      discount
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Save {Math.round((basePrice - finalPrice) * 100) / 100} ETB
                    </span>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="limits" className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="maxBuildings">Max Buildings</Label>
                <Input
                  id="maxBuildings"
                  type="number"
                  min="0"
                  value={maxBuildings}
                  onChange={(e) => setMaxBuildings(e.target.value)}
                  placeholder="Unlimited"
                />
                <p className="text-xs text-muted-foreground mt-1">Leave empty for unlimited</p>
              </div>
              <div>
                <Label htmlFor="maxUnits">Max Units</Label>
                <Input
                  id="maxUnits"
                  type="number"
                  min="0"
                  value={maxUnits}
                  onChange={(e) => setMaxUnits(e.target.value)}
                  placeholder="Unlimited"
                />
                <p className="text-xs text-muted-foreground mt-1">Leave empty for unlimited</p>
              </div>
              <div>
                <Label htmlFor="maxUsers">Max Users</Label>
                <Input
                  id="maxUsers"
                  type="number"
                  min="0"
                  value={maxUsers}
                  onChange={(e) => setMaxUsers(e.target.value)}
                  placeholder="Unlimited"
                />
                <p className="text-xs text-muted-foreground mt-1">Leave empty for unlimited</p>
              </div>
            </div>

            <div>
              <Label htmlFor="features">Features (one per line)</Label>
              <Textarea
                id="features"
                value={features}
                onChange={(e) => setFeatures(e.target.value)}
                placeholder={defaultFeatures.join('\n')}
                rows={8}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Enter custom features or leave empty to use tier defaults
              </p>
              {features.length === 0 && (
                <div className="mt-2 p-3 bg-muted rounded-lg">
                  <p className="text-xs font-semibold mb-2">Default features for {tier} tier:</p>
                  <ul className="space-y-1">
                    {defaultFeatures.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2 text-xs">
                        <CheckCircle2 className="h-3 w-3 text-green-600 shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="dates" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startDate">Start Date *</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">Auto-calculated if not set</p>
              </div>
              {existingSubscription && (
                <>
                  <div>
                    <Label htmlFor="trialEndDate">Trial End Date</Label>
                    <Input
                      id="trialEndDate"
                      type="date"
                      value={trialEndDate}
                      onChange={(e) => setTrialEndDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="nextBillingDate">Next Billing Date</Label>
                    <Input
                      id="nextBillingDate"
                      type="date"
                      value={nextBillingDate}
                      onChange={(e) => setNextBillingDate(e.target.value)}
                    />
                  </div>
                </>
              )}
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes about this subscription..."
                rows={4}
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex justify-between">
          <div>
            {existingSubscription &&
              (existingSubscription.status === 'active' ||
                existingSubscription.status === 'trial') && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleCancel}
                  disabled={isCancelling}
                >
                  {isCancelling ? 'Cancelling...' : 'Cancel Subscription'}
                </Button>
              )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button
              type="button"
              onClick={existingSubscription ? handleUpdate : handleCreate}
              disabled={isSubmitting}
            >
              {isSubmitting
                ? existingSubscription
                  ? 'Updating...'
                  : 'Creating...'
                : existingSubscription
                  ? 'Update Subscription'
                  : 'Create Subscription'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
