'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter, useParams } from 'next/navigation';
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
import { Separator } from '@/lib/components/ui/separator';
import { apiGet, apiPatch } from '@/lib/utils/api-client';
import {
  ArrowLeft,
  Building2,
  Globe,
  Palette,
  Loader2,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { SubscriptionModal } from '@/lib/components/subscriptions/SubscriptionModal';
import type { SubscriptionTier, SubscriptionStatus, BillingCycle } from '@/lib/subscriptions/types';

interface Organization {
  id: string;
  _id: string;
  name: string;
  code: string;
  contactInfo?: {
    email?: string;
    phone?: string;
    address?: string;
  } | null;
  status: string;
  domain?: string | null;
  subdomain?: string | null;
  branding?: {
    logo?: string | null;
    primaryColor?: string | null;
    secondaryColor?: string | null;
    favicon?: string | null;
    companyName?: string | null;
    tagline?: string | null;
  } | null;
  subscriptionId?: string | null;
}

interface Subscription {
  id: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  price: number;
  startDate: string | Date;
  autoRenew: boolean;
  features: string[];
  basePrice?: number;
  discountType?: 'percentage' | 'fixed' | null;
  discountValue?: number | null;
  endDate?: string | Date | null;
  trialEndDate?: string | Date | null;
  nextBillingDate?: string | Date | null;
  maxBuildings?: number | null;
  maxUnits?: number | null;
  maxUsers?: number | null;
  notes?: string | null;
}

export default function EditOrganizationPage() {
  const router = useRouter();
  const params = useParams();
  const organizationId = params?.id as string;

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('basic');
  const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive' | 'suspended'>('active');
  const [subdomain, setSubdomain] = useState('');
  const [autoGenerateSubdomain, setAutoGenerateSubdomain] = useState(false);
  const [domain, setDomain] = useState('');
  const [useCustomDomain, setUseCustomDomain] = useState(false);
  const [primaryColor, setPrimaryColor] = useState('#3b82f6');
  const [secondaryColor, setSecondaryColor] = useState('#8b5cf6');
  const [companyName, setCompanyName] = useState('');
  const [tagline, setTagline] = useState('');

  useEffect(() => {
    async function fetchOrganization() {
      if (!organizationId) return;

      try {
        setIsLoading(true);
        const data = await apiGet<{
          organization: Organization;
          subscription: Subscription | null;
        }>(`/api/organizations/${organizationId}`);

        const org = data.organization;
        setOrganization(org);
        setSubscription(data.subscription || null);

        // Set form state
        setName(org.name);
        setCode(org.code);
        setEmail(org.contactInfo?.email || '');
        setPhone(org.contactInfo?.phone || '');
        setAddress(org.contactInfo?.address || '');
        setStatus((org.status as any) || 'active');
        setSubdomain(org.subdomain || '');
        setDomain(org.domain || '');
        setUseCustomDomain(!!org.domain);
        setPrimaryColor(org.branding?.primaryColor || '#3b82f6');
        setSecondaryColor(org.branding?.secondaryColor || '#8b5cf6');
        setCompanyName(org.branding?.companyName || '');
        setTagline(org.branding?.tagline || '');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load organization');
      } finally {
        setIsLoading(false);
      }
    }

    fetchOrganization();
  }, [organizationId]);

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organization) return;

    setError(null);
    setIsSubmitting(true);

    try {
      const organizationData: any = {
        name: name.trim(),
        code: code.trim(),
        status,
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

      await apiPatch(`/api/organizations/${organizationId}`, organizationData);
      router.push(`/admin/organizations/${organizationId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update organization');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRefresh() {
    if (!organizationId) return;
    try {
      const data = await apiGet<{
        organization: Organization;
        subscription: Subscription | null;
      }>(`/api/organizations/${organizationId}`);
      setOrganization(data.organization);
      setSubscription(data.subscription || null);
    } catch (err) {
      console.error('Failed to refresh:', err);
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error && !organization) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg">{error}</div>
        <Link href="/admin/organizations">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Organizations
          </Button>
        </Link>
      </div>
    );
  }

  if (!organization) {
    return null;
  }

  const previewUrl = subdomain ? `https://${subdomain}.bms.com` : '';

  return (
    <div className="space-y-6 p-6 max-w-6xl mx-auto">
      <div className="space-y-2">
        <nav
          className="flex items-center gap-1.5 text-sm text-muted-foreground"
          aria-label="Breadcrumb"
        >
          <Link href="/admin" className="hover:text-foreground transition-colors font-medium">
            Admin
          </Link>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <Link
            href="/admin/organizations"
            className="hover:text-foreground transition-colors font-medium"
          >
            Organizations
          </Link>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <Link
            href={`/admin/organizations/${organizationId}`}
            className="hover:text-foreground transition-colors font-medium"
          >
            {organization.name}
          </Link>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <span className="text-foreground font-medium">Edit</span>
        </nav>
        <h1 className="text-3xl font-bold tracking-tight">Edit Organization</h1>
      </div>

      <div className="space-y-6">
        <div>
          <Link href={`/admin/organizations/${organizationId}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Organization
            </Button>
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic">
                <Building2 className="h-4 w-4 mr-2" />
                Basic Info
              </TabsTrigger>
              <TabsTrigger value="subscription">
                <Sparkles className="h-4 w-4 mr-2" />
                Subscription
              </TabsTrigger>
              <TabsTrigger value="domain">
                <Globe className="h-4 w-4 mr-2" />
                Domain
              </TabsTrigger>
              <TabsTrigger value="branding">
                <Palette className="h-4 w-4 mr-2" />
                Branding
              </TabsTrigger>
            </TabsList>

            {error && (
              <div className="mt-4 p-4 rounded-md bg-destructive/10 text-destructive text-sm border border-destructive/20">
                {error}
              </div>
            )}

            {/* Basic Information Tab */}
            <TabsContent value="basic" className="mt-6">
              <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
                <CardHeader className="pb-4 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                      <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl">Basic Information</CardTitle>
                      <CardDescription className="mt-1">
                        Update the organization&apos;s basic details
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
                    <Label htmlFor="code" className="text-sm font-semibold">
                      Organization Code <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="code"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      required
                      placeholder="e.g., SUNRISE-PM"
                      pattern="[A-Z0-9-_]+"
                      title="Code must contain only uppercase letters, numbers, hyphens, and underscores"
                      className="h-11"
                    />
                    <p className="text-xs text-muted-foreground">
                      Unique identifier for the organization (uppercase letters, numbers, hyphens,
                      and underscores only)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="status" className="text-sm font-semibold">
                      Status <span className="text-destructive">*</span>
                    </Label>
                    <Select value={status} onValueChange={(value: any) => setStatus(value)}>
                      <SelectTrigger className="h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Contact Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
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
                        <Label htmlFor="phone">Phone</Label>
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
                      <Label htmlFor="address">Address</Label>
                      <Textarea
                        id="address"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="Street address, City, Region"
                        rows={2}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Subscription Tab */}
            <TabsContent value="subscription" className="mt-6">
              <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
                <CardHeader className="pb-4 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                      <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl">Subscription & Features</CardTitle>
                      <CardDescription className="mt-1">
                        Manage subscription for this organization
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  {subscription ? (
                    <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold">Current Subscription</p>
                          <p className="text-sm text-muted-foreground">
                            {subscription.tier} - {subscription.billingCycle}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setSubscriptionModalOpen(true)}
                        >
                          Manage Subscription
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Status</p>
                          <p className="font-medium capitalize">{subscription.status}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Price</p>
                          <p className="font-medium">{subscription.price.toLocaleString()} ETB</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 border rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
                      <p className="text-sm text-yellow-900 dark:text-yellow-100 mb-4">
                        No subscription assigned. Please create a subscription for this
                        organization.
                      </p>
                      <Button
                        type="button"
                        onClick={() => setSubscriptionModalOpen(true)}
                        variant="outline"
                      >
                        Create Subscription
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Domain Tab */}
            <TabsContent value="domain" className="mt-6">
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
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Auto-generate Subdomain</Label>
                        <p className="text-sm text-muted-foreground">
                          Generate subdomain automatically from organization name
                        </p>
                      </div>
                      <Switch
                        checked={autoGenerateSubdomain}
                        onCheckedChange={setAutoGenerateSubdomain}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="subdomain">Subdomain</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="subdomain"
                          value={subdomain}
                          onChange={(e) =>
                            setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                          }
                          disabled={autoGenerateSubdomain}
                          placeholder="organization-name"
                          className="flex-1 h-11"
                        />
                        <span className="text-sm text-muted-foreground">.bms.com</span>
                      </div>
                      {previewUrl && (
                        <p className="text-xs text-muted-foreground">
                          Preview: <span className="font-mono">{previewUrl}</span>
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Subdomain will be used for organization-specific routes
                      </p>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Use Custom Domain</Label>
                        <p className="text-sm text-muted-foreground">
                          Configure a custom domain for this organization
                        </p>
                      </div>
                      <Switch checked={useCustomDomain} onCheckedChange={setUseCustomDomain} />
                    </div>

                    {useCustomDomain && (
                      <div className="space-y-2">
                        <Label htmlFor="domain">Custom Domain</Label>
                        <Input
                          id="domain"
                          type="text"
                          value={domain}
                          onChange={(e) => setDomain(e.target.value.toLowerCase())}
                          placeholder="example.com"
                          className="h-11"
                        />
                        <p className="text-xs text-muted-foreground">
                          Enter your custom domain (e.g., example.com). DNS configuration required.
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Branding Tab */}
            <TabsContent value="branding" className="mt-6">
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="primaryColor">Primary Color</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="primaryColor"
                          type="color"
                          value={primaryColor}
                          onChange={(e) => setPrimaryColor(e.target.value)}
                          className="w-20 h-11"
                        />
                        <Input
                          type="text"
                          value={primaryColor}
                          onChange={(e) => setPrimaryColor(e.target.value)}
                          placeholder="#3b82f6"
                          className="flex-1 h-11"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="secondaryColor">Secondary Color</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="secondaryColor"
                          type="color"
                          value={secondaryColor}
                          onChange={(e) => setSecondaryColor(e.target.value)}
                          className="w-20 h-11"
                        />
                        <Input
                          type="text"
                          value={secondaryColor}
                          onChange={(e) => setSecondaryColor(e.target.value)}
                          placeholder="#8b5cf6"
                          className="flex-1 h-11"
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="companyName">Display Name</Label>
                      <Input
                        id="companyName"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Company Display Name (optional)"
                        className="h-11"
                      />
                      <p className="text-xs text-muted-foreground">
                        Display name shown to users (defaults to organization name)
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="tagline">Tagline</Label>
                      <Input
                        id="tagline"
                        value={tagline}
                        onChange={(e) => setTagline(e.target.value)}
                        placeholder="Your company tagline"
                        className="h-11"
                      />
                      <p className="text-xs text-muted-foreground">
                        Short tagline or slogan for the organization
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Action buttons */}
          <div className="sticky bottom-0 bg-background border-t border-border -mx-6 -mb-6 p-4 mt-6 flex justify-end gap-4 z-10 shadow-lg">
            <Link href={`/admin/organizations/${organizationId}`}>
              <Button type="button" variant="outline" size="lg">
                Cancel
              </Button>
            </Link>
            <Button type="submit" disabled={isSubmitting || !name || !code} size="lg">
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </form>
      </div>

      <SubscriptionModal
        open={subscriptionModalOpen}
        onOpenChange={setSubscriptionModalOpen}
        organizationId={organizationId}
        existingSubscription={subscription}
        onSuccess={handleRefresh}
      />
    </div>
  );
}
