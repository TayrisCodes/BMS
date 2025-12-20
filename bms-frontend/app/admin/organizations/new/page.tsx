'use client';

import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/lib/components/ui/button';
import { Input } from '@/lib/components/ui/input';
import { Label } from '@/lib/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/lib/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/lib/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/lib/components/ui/tabs';
import { Switch } from '@/lib/components/ui/switch';
import { Textarea } from '@/lib/components/ui/textarea';
import { apiGet, apiPost } from '@/lib/utils/api-client';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import {
  ArrowLeft,
  Building2,
  Sparkles,
  Globe,
  Palette,
  Loader2,
  Check,
  X,
  ChevronRight,
  Shield,
  UserPlus,
} from 'lucide-react';
import {
  SUBSCRIPTION_TIERS,
  SUBSCRIPTION_FEATURES,
  type SubscriptionTier,
} from '@/lib/subscriptions/types';
import { Badge } from '@/lib/components/ui/badge';
import { Separator } from '@/lib/components/ui/separator';

interface Subscription {
  id: string;
  tier: SubscriptionTier;
  billingCycle: string;
  price: number;
  status: string;
}

export default function NewOrganizationPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('basic');

  // Form state
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [autoGenerateCode, setAutoGenerateCode] = useState(true);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [subscriptionId, setSubscriptionId] = useState<string>('');
  const [createNewSubscription, setCreateNewSubscription] = useState(false);
  const [subscriptionTier, setSubscriptionTier] = useState<SubscriptionTier>('starter');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'quarterly' | 'annually'>('monthly');
  const [subdomain, setSubdomain] = useState('');
  const [autoGenerateSubdomain, setAutoGenerateSubdomain] = useState(true);
  const [domain, setDomain] = useState('');
  const [useCustomDomain, setUseCustomDomain] = useState(false);
  const [primaryColor, setPrimaryColor] = useState('#3b82f6');
  const [secondaryColor, setSecondaryColor] = useState('#8b5cf6');
  const [companyName, setCompanyName] = useState('');
  const [tagline, setTagline] = useState('');

  // Organization Admin user fields
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminPasswordConfirm, setAdminPasswordConfirm] = useState('');
  const [createAdminUser, setCreateAdminUser] = useState(true);

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loadingSubscriptions, setLoadingSubscriptions] = useState(true);

  // Auto-generate code from name
  useEffect(() => {
    if (autoGenerateCode && name) {
      const generated = name
        .toUpperCase()
        .replace(/[^A-Z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .substring(0, 30);
      setCode(generated || 'ORG-' + Date.now().toString().slice(-6));
    }
  }, [name, autoGenerateCode]);

  // Auto-generate subdomain from name
  useEffect(() => {
    if (autoGenerateSubdomain && name) {
      const generated = name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .substring(0, 30);
      setSubdomain(generated || 'org-' + Date.now().toString().slice(-6));
    }
  }, [name, autoGenerateSubdomain]);

  // Fetch available subscriptions
  useEffect(() => {
    async function fetchSubscriptions() {
      try {
        setLoadingSubscriptions(true);
        const data = await apiGet<{ subscriptions: Subscription[] }>(
          '/api/subscriptions?status=active&limit=100',
        );
        setSubscriptions(data.subscriptions || []);
      } catch (err) {
        console.error('Failed to fetch subscriptions:', err);
      } finally {
        setLoadingSubscriptions(false);
      }
    }
    fetchSubscriptions();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const organizationData: any = {
        name: name.trim(),
        code: code.trim(),
        contactInfo: {
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          address: address.trim() || undefined,
        },
        subdomain: subdomain.trim() || undefined,
        domain: useCustomDomain && domain.trim() ? domain.trim() : undefined,
        branding: {
          primaryColor: primaryColor,
          secondaryColor: secondaryColor,
          companyName: companyName.trim() || undefined,
          tagline: tagline.trim() || undefined,
        },
      };

      // Add Organization Admin user data if creating admin user
      if (createAdminUser) {
        if (!adminEmail.trim() || !adminPassword.trim() || !adminPhone.trim()) {
          setError('Organization Admin email, phone, and password are required');
          setIsSubmitting(false);
          setActiveTab('admin');
          return;
        }

        if (adminPassword !== adminPasswordConfirm) {
          setError('Passwords do not match');
          setIsSubmitting(false);
          setActiveTab('admin');
          return;
        }

        organizationData.adminUser = {
          name: adminName.trim() || undefined,
          email: adminEmail.trim(),
          phone: adminPhone.trim(),
          password: adminPassword,
        };
      }

      // Handle subscription - either create new or use existing
      // Subscription is required for organization creation
      if (createNewSubscription) {
        // Validate subscription fields
        if (!subscriptionTier || !billingCycle) {
          setError('Subscription tier and billing cycle are required');
          setIsSubmitting(false);
          setActiveTab('subscription');
          return;
        }

        // Send subscription data to be created with organization
        organizationData.subscription = {
          tier: subscriptionTier,
          billingCycle,
          trialDays: 14, // Default 14-day trial
          autoRenew: true,
        };
      } else if (subscriptionId) {
        // Use existing subscription
        organizationData.subscriptionId = subscriptionId;
      } else {
        // Subscription is required
        setError(
          'A subscription is required to create an organization. Please create a new subscription or select an existing one.',
        );
        setIsSubmitting(false);
        setActiveTab('subscription');
        return;
      }

      // Validate that admin user is created if subscription requires it
      // (For now, we'll make admin user optional but recommended)
      if (!createAdminUser) {
        const confirmNoAdmin = confirm(
          'You are creating an organization without an admin user. The organization will be created but you will need to create an admin user later to manage it. Continue?',
        );
        if (!confirmNoAdmin) {
          setIsSubmitting(false);
          setActiveTab('admin');
          return;
        }
      }

      const result = await apiPost<{
        organization: { _id: string };
        subscription?: {
          id: string;
          tier: string;
          status: string;
          billingCycle: string;
          price: number;
        };
        adminUser?: {
          id: string;
          email: string;
          phone: string;
          name?: string;
        };
      }>('/api/organizations', organizationData);

      // Success! All components created successfully
      // The response includes organization, subscription, and adminUser
      // Redirect to organization detail page
      router.push(`/admin/organizations/${result.organization._id}`);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to create organization');
    } finally {
      setIsSubmitting(false);
    }
  }

  const selectedSubscription = subscriptions.find((s) => s.id === subscriptionId);
  const previewUrl = subdomain ? `https://${subdomain}.bms.com` : '';

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="py-8 pb-28">
        {/* Header Section */}
        <div className="mb-8">
          <nav
            className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4"
            aria-label="Breadcrumb"
          >
            <Link
              href="/admin"
              className="hover:text-foreground transition-colors font-medium hover:underline"
            >
              Admin
            </Link>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <Link
              href="/admin/organizations"
              className="hover:text-foreground transition-colors font-medium hover:underline"
            >
              Organizations
            </Link>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <span className="text-foreground font-medium">New</span>
          </nav>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
                Create New Organization
              </h1>
              <p className="mt-2 text-muted-foreground text-lg">
                Set up a new organization with all necessary configurations
              </p>
            </div>
            <Link href="/admin/organizations">
              <Button variant="outline" size="lg" className="hidden sm:flex">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-2 mb-6">
              <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 gap-2 bg-transparent">
                <TabsTrigger
                  value="basic"
                  className="data-[state=active]:bg-slate-100 dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm"
                >
                  <Building2 className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Basic Info</span>
                  <span className="sm:hidden">Basic</span>
                </TabsTrigger>
                <TabsTrigger
                  value="admin"
                  className="data-[state=active]:bg-slate-100 dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm"
                >
                  <Shield className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Admin User</span>
                  <span className="sm:hidden">Admin</span>
                </TabsTrigger>
                <TabsTrigger
                  value="subscription"
                  className="data-[state=active]:bg-slate-100 dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Subscription</span>
                  <span className="sm:hidden">Plan</span>
                </TabsTrigger>
                <TabsTrigger
                  value="domain"
                  className="data-[state=active]:bg-slate-100 dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm"
                >
                  <Globe className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Domain</span>
                  <span className="sm:hidden">Domain</span>
                </TabsTrigger>
                <TabsTrigger
                  value="branding"
                  className="data-[state=active]:bg-slate-100 dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm"
                >
                  <Palette className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Branding</span>
                  <span className="sm:hidden">Style</span>
                </TabsTrigger>
              </TabsList>
            </div>

            {error && (
              <div className="mb-6 p-4 rounded-lg bg-destructive/10 text-destructive text-sm border border-destructive/20 shadow-sm flex items-start gap-3 animate-in slide-in-from-top-2">
                <X className="h-5 w-5 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="font-medium">Error</p>
                  <p className="mt-1">{error}</p>
                </div>
              </div>
            )}

            {/* Organization Admin Tab */}
            <TabsContent value="admin" className="mt-6 space-y-6">
              <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
                <CardHeader className="pb-4 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                      <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl">Organization Admin User</CardTitle>
                      <CardDescription className="mt-1">
                        Create an Organization Admin user to manage this organization
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-800">
                    <div className="space-y-0.5 flex-1">
                      <Label className="text-base font-semibold">
                        Create Organization Admin User
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Create an admin user with ORG_ADMIN role for this organization
                      </p>
                    </div>
                    <Switch
                      checked={createAdminUser}
                      onCheckedChange={setCreateAdminUser}
                      className="ml-4"
                    />
                  </div>

                  {createAdminUser && (
                    <div className="space-y-6 p-6 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/30">
                      <div className="space-y-2">
                        <Label htmlFor="adminName" className="text-sm font-semibold">
                          Full Name
                        </Label>
                        <Input
                          id="adminName"
                          value={adminName}
                          onChange={(e) => setAdminName(e.target.value)}
                          placeholder="e.g., John Doe"
                          className="h-11"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label htmlFor="adminEmail" className="text-sm font-semibold">
                            Email <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id="adminEmail"
                            type="email"
                            value={adminEmail}
                            onChange={(e) => setAdminEmail(e.target.value)}
                            required={createAdminUser}
                            placeholder="admin@organization.com"
                            className="h-11"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="adminPhone" className="text-sm font-semibold">
                            Phone <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id="adminPhone"
                            type="tel"
                            value={adminPhone}
                            onChange={(e) => setAdminPhone(e.target.value)}
                            required={createAdminUser}
                            placeholder="+251911234567"
                            className="h-11"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label htmlFor="adminPassword" className="text-sm font-semibold">
                            Password <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id="adminPassword"
                            type="password"
                            value={adminPassword}
                            onChange={(e) => setAdminPassword(e.target.value)}
                            required={createAdminUser}
                            placeholder="Enter password"
                            className="h-11"
                          />
                          <p className="text-xs text-muted-foreground mt-1.5">
                            Minimum 8 characters, must include uppercase, lowercase, number, and
                            special character
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="adminPasswordConfirm" className="text-sm font-semibold">
                            Confirm Password <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id="adminPasswordConfirm"
                            type="password"
                            value={adminPasswordConfirm}
                            onChange={(e) => setAdminPasswordConfirm(e.target.value)}
                            required={createAdminUser}
                            placeholder="Confirm password"
                            className="h-11"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Basic Information Tab */}
            <TabsContent value="basic" className="mt-6 space-y-6">
              <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
                <CardHeader className="pb-4 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                      <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl">Basic Information</CardTitle>
                      <CardDescription className="mt-1">
                        Enter the organization&apos;s basic details
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-sm font-semibold">
                      Organization Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      placeholder="e.g., Sunrise Property Management"
                      className="h-11"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between mb-2">
                      <Label htmlFor="code" className="text-sm font-semibold">
                        Organization Code <span className="text-destructive">*</span>
                      </Label>
                      <div className="flex items-center gap-2">
                        <Switch
                          id="autoCode"
                          checked={autoGenerateCode}
                          onCheckedChange={setAutoGenerateCode}
                        />
                        <Label
                          htmlFor="autoCode"
                          className="text-xs text-muted-foreground cursor-pointer"
                        >
                          Auto-generate
                        </Label>
                      </div>
                    </div>
                    <Input
                      id="code"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      required
                      disabled={autoGenerateCode}
                      placeholder="e.g., SUNRISE-PM"
                      pattern="[A-Z0-9-_]+"
                      title="Code must contain only uppercase letters, numbers, hyphens, and underscores"
                      className="h-11 font-mono"
                    />
                    <p className="text-xs text-muted-foreground mt-1.5">
                      Unique identifier for the organization (uppercase letters, numbers, hyphens,
                      and underscores only)
                    </p>
                  </div>

                  <Separator className="my-6" />

                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                      <h3 className="text-lg font-semibold px-3">Contact Information</h3>
                      <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="email" className="text-sm font-semibold">
                          Email
                        </Label>
                        <Input
                          id="email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="contact@organization.com"
                          className="h-11"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="phone" className="text-sm font-semibold">
                          Phone
                        </Label>
                        <Input
                          id="phone"
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+251911234567"
                          className="h-11"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="address" className="text-sm font-semibold">
                        Address
                      </Label>
                      <Textarea
                        id="address"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="Street address, City, Region"
                        rows={3}
                        className="resize-none"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Subscription Tab */}
            <TabsContent value="subscription" className="mt-6 space-y-6">
              <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
                <CardHeader className="pb-4 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                      <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl">Subscription & Features</CardTitle>
                      <CardDescription className="mt-1">
                        <span className="text-destructive font-semibold">Required:</span> Assign a
                        subscription to enable features for this organization
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <p className="text-sm text-blue-900 dark:text-blue-100">
                      <strong>Note:</strong> A subscription is required to create an organization.
                      You can create a new subscription or assign an existing one. The organization
                      will have access to features based on the subscription tier.
                    </p>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-800">
                    <div className="space-y-0.5 flex-1">
                      <Label className="text-base font-semibold">Create New Subscription</Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Create a new subscription for this organization or assign an existing one
                      </p>
                    </div>
                    <Switch
                      checked={createNewSubscription}
                      onCheckedChange={setCreateNewSubscription}
                      className="ml-4"
                    />
                  </div>

                  {createNewSubscription ? (
                    <div className="space-y-6 p-6 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/30">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label htmlFor="subscriptionTier" className="text-sm font-semibold">
                            Subscription Tier <span className="text-destructive">*</span>
                          </Label>
                          <Select
                            value={subscriptionTier}
                            onValueChange={(value: SubscriptionTier) => setSubscriptionTier(value)}
                          >
                            <SelectTrigger className="h-11">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {SUBSCRIPTION_TIERS.map((tier) => (
                                <SelectItem key={tier} value={tier}>
                                  {tier.charAt(0).toUpperCase() + tier.slice(1)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="billingCycle" className="text-sm font-semibold">
                            Billing Cycle <span className="text-destructive">*</span>
                          </Label>
                          <Select
                            value={billingCycle}
                            onValueChange={(value: any) => setBillingCycle(value)}
                          >
                            <SelectTrigger className="h-11">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="monthly">Monthly</SelectItem>
                              <SelectItem value="quarterly">Quarterly</SelectItem>
                              <SelectItem value="annually">Annually</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {subscriptionTier && (
                        <div className="space-y-3">
                          <Label className="text-sm font-semibold">Features Included</Label>
                          <div className="p-4 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                            <ul className="space-y-2.5 text-sm">
                              {SUBSCRIPTION_FEATURES[subscriptionTier].map((feature, idx) => (
                                <li key={idx} className="flex items-start gap-3">
                                  <Check className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                                  <span className="text-slate-700 dark:text-slate-300">
                                    {feature}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <Label htmlFor="subscriptionId" className="text-sm font-semibold">
                        Select Existing Subscription
                      </Label>
                      {loadingSubscriptions ? (
                        <div className="flex items-center justify-center p-12 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                      ) : subscriptions.length > 0 ? (
                        <Select value={subscriptionId} onValueChange={setSubscriptionId}>
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder="Select a subscription" />
                          </SelectTrigger>
                          <SelectContent>
                            {subscriptions.map((sub) => (
                              <SelectItem key={sub.id} value={sub.id}>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="font-medium">
                                    {sub.tier}
                                  </Badge>
                                  <span>
                                    {sub.billingCycle} - ETB {sub.price.toLocaleString()}
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="p-4 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                          <p className="text-sm text-muted-foreground text-center">
                            No active subscriptions available. Create a new one instead.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {selectedSubscription && !createNewSubscription && (
                    <div className="p-5 border-2 border-blue-200 dark:border-blue-800 rounded-lg bg-blue-50/50 dark:bg-blue-900/20">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-base">Selected Subscription</span>
                        <Badge variant="outline" className="font-medium">
                          {selectedSubscription.tier}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Billing:{' '}
                        <span className="font-medium">{selectedSubscription.billingCycle}</span> |
                        Price:{' '}
                        <span className="font-medium">
                          ETB {selectedSubscription.price.toLocaleString()}
                        </span>
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Domain Tab */}
            <TabsContent value="domain" className="mt-6 space-y-6">
              <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
                <CardHeader className="pb-4 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                      <Globe className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl">Domain Configuration</CardTitle>
                      <CardDescription className="mt-1">
                        Configure custom domain or subdomain for this organization
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-800">
                      <div className="space-y-0.5 flex-1">
                        <Label className="text-base font-semibold">Auto-generate Subdomain</Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          Generate subdomain automatically from organization name
                        </p>
                      </div>
                      <Switch
                        checked={autoGenerateSubdomain}
                        onCheckedChange={setAutoGenerateSubdomain}
                        className="ml-4"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="subdomain" className="text-sm font-semibold">
                        Subdomain
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="subdomain"
                          value={subdomain}
                          onChange={(e) =>
                            setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                          }
                          disabled={autoGenerateSubdomain}
                          placeholder="organization-name"
                          className="flex-1 h-11 font-mono"
                        />
                        <span className="text-sm text-muted-foreground font-medium">.bms.com</span>
                      </div>
                      {previewUrl && (
                        <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                          <p className="text-xs text-muted-foreground mb-1">Preview URL:</p>
                          <p className="text-sm font-mono text-blue-700 dark:text-blue-300">
                            {previewUrl}
                          </p>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-1.5">
                        Subdomain will be used for organization-specific routes
                      </p>
                    </div>
                  </div>

                  <Separator className="my-6" />

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-800">
                      <div className="space-y-0.5 flex-1">
                        <Label className="text-base font-semibold">Use Custom Domain</Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          Configure a custom domain for this organization
                        </p>
                      </div>
                      <Switch
                        checked={useCustomDomain}
                        onCheckedChange={setUseCustomDomain}
                        className="ml-4"
                      />
                    </div>

                    {useCustomDomain && (
                      <div className="space-y-2 p-4 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/30">
                        <Label htmlFor="domain" className="text-sm font-semibold">
                          Custom Domain
                        </Label>
                        <Input
                          id="domain"
                          type="text"
                          value={domain}
                          onChange={(e) => setDomain(e.target.value.toLowerCase())}
                          placeholder="example.com"
                          className="h-11 font-mono"
                        />
                        <p className="text-xs text-muted-foreground mt-1.5">
                          Enter your custom domain (e.g., example.com). DNS configuration required.
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Branding Tab */}
            <TabsContent value="branding" className="mt-6 space-y-6">
              <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
                <CardHeader className="pb-4 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-pink-100 dark:bg-pink-900/30">
                      <Palette className="h-5 w-5 text-pink-600 dark:text-pink-400" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl">Branding & Customization</CardTitle>
                      <CardDescription className="mt-1">
                        Customize the organization&apos;s appearance and branding
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="primaryColor" className="text-sm font-semibold">
                        Primary Color
                      </Label>
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <Input
                            id="primaryColor"
                            type="color"
                            value={primaryColor}
                            onChange={(e) => setPrimaryColor(e.target.value)}
                            className="w-16 h-16 rounded-lg cursor-pointer border-2 border-slate-200 dark:border-slate-800"
                            style={{ padding: '2px' }}
                          />
                        </div>
                        <Input
                          type="text"
                          value={primaryColor}
                          onChange={(e) => setPrimaryColor(e.target.value)}
                          placeholder="#3b82f6"
                          className="flex-1 h-11 font-mono"
                        />
                      </div>
                      <div
                        className="h-3 rounded-full mt-2"
                        style={{ backgroundColor: primaryColor }}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="secondaryColor" className="text-sm font-semibold">
                        Secondary Color
                      </Label>
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <Input
                            id="secondaryColor"
                            type="color"
                            value={secondaryColor}
                            onChange={(e) => setSecondaryColor(e.target.value)}
                            className="w-16 h-16 rounded-lg cursor-pointer border-2 border-slate-200 dark:border-slate-800"
                            style={{ padding: '2px' }}
                          />
                        </div>
                        <Input
                          type="text"
                          value={secondaryColor}
                          onChange={(e) => setSecondaryColor(e.target.value)}
                          placeholder="#8b5cf6"
                          className="flex-1 h-11 font-mono"
                        />
                      </div>
                      <div
                        className="h-3 rounded-full mt-2"
                        style={{ backgroundColor: secondaryColor }}
                      />
                    </div>
                  </div>

                  <Separator className="my-6" />

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="companyName" className="text-sm font-semibold">
                        Display Name
                      </Label>
                      <Input
                        id="companyName"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Company Display Name (optional)"
                        className="h-11"
                      />
                      <p className="text-xs text-muted-foreground mt-1.5">
                        Display name shown to users (defaults to organization name)
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="tagline" className="text-sm font-semibold">
                        Tagline
                      </Label>
                      <Input
                        id="tagline"
                        value={tagline}
                        onChange={(e) => setTagline(e.target.value)}
                        placeholder="Your company tagline"
                        className="h-11"
                      />
                      <p className="text-xs text-muted-foreground mt-1.5">
                        Short tagline or slogan for the organization
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Action buttons - sticky footer */}
          <div className="sticky bottom-0 bg-white/95 dark:bg-slate-950/95 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 mt-8 -mx-4 md:-mx-6 px-4 md:px-6 py-4 flex flex-col sm:flex-row justify-between sm:justify-end gap-4 z-50 shadow-lg">
            <div className="flex flex-col gap-2 text-sm sm:hidden">
              {!createNewSubscription && !subscriptionId && (
                <div className="flex items-center gap-2 text-destructive font-semibold">
                  <span>⚠️</span>
                  <span>Subscription is required</span>
                </div>
              )}
              {createNewSubscription && (!subscriptionTier || !billingCycle) && (
                <div className="flex items-center gap-2 text-destructive font-semibold">
                  <span>⚠️</span>
                  <span>Please select subscription tier and billing cycle</span>
                </div>
              )}
              {name &&
                code &&
                (createNewSubscription ? subscriptionTier && billingCycle : subscriptionId) && (
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    <span>All required fields completed</span>
                  </div>
                )}
            </div>
            <div className="flex gap-4 w-full sm:w-auto">
              <Link href="/admin/organizations" className="flex-1 sm:flex-initial">
                <Button type="button" variant="outline" size="lg" className="w-full sm:w-auto">
                  Cancel
                </Button>
              </Link>
              <Button
                type="submit"
                disabled={
                  isSubmitting ||
                  !name ||
                  !code ||
                  (!createNewSubscription && !subscriptionId) ||
                  (createNewSubscription && (!subscriptionTier || !billingCycle))
                }
                size="lg"
                className="flex-1 sm:flex-initial bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg shadow-blue-500/25"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Building2 className="mr-2 h-4 w-4" />
                    Create Organization
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
