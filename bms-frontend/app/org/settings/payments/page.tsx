'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/lib/components/ui/button';
import { Input } from '@/lib/components/ui/input';
import { Label } from '@/lib/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/lib/components/ui/card';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import { CreditCard, Save, CheckCircle2, XCircle, Eye, EyeOff } from 'lucide-react';
import { Badge } from '@/lib/components/ui/badge';
import { apiGet, apiPatch } from '@/lib/utils/api-client';
import { Switch } from '@/lib/components/ui/switch';

interface PaymentProvider {
  id: string;
  name: string;
  enabled: boolean;
  apiKey?: string;
  apiSecret?: string;
  publicKey?: string;
  webhookSecret?: string;
  merchantId?: string;
  webhookUrl?: string;
  testMode?: boolean;
}

export default function PaymentSettingsPage() {
  const [providers, setProviders] = useState<PaymentProvider[]>([
    { id: 'chapa', name: 'Chapa', enabled: false },
    { id: 'telebirr', name: 'Telebirr', enabled: false },
    { id: 'cbeBirr', name: 'CBE Birr', enabled: false },
    { id: 'helloCash', name: 'HelloCash', enabled: false },
  ]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function fetchPaymentSettings() {
      try {
        setIsLoading(true);
        const data = await apiGet<{ providers: any }>('/api/settings/payments');

        if (data.providers) {
          setProviders([
            {
              id: 'chapa',
              name: 'Chapa',
              enabled: data.providers.chapa?.enabled || false,
              apiKey: data.providers.chapa?.apiKey || '',
              publicKey: data.providers.chapa?.publicKey || '',
              webhookSecret: data.providers.chapa?.webhookSecret || '',
              webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/webhooks/payments/chapa`,
            },
            {
              id: 'telebirr',
              name: 'Telebirr',
              enabled: data.providers.telebirr?.enabled || false,
              apiKey: data.providers.telebirr?.apiKey || '',
              apiSecret: data.providers.telebirr?.apiSecret || '',
              merchantId: data.providers.telebirr?.merchantId || '',
            },
            {
              id: 'cbeBirr',
              name: 'CBE Birr',
              enabled: data.providers.cbeBirr?.enabled || false,
              apiKey: data.providers.cbeBirr?.apiKey || '',
              apiSecret: data.providers.cbeBirr?.apiSecret || '',
              merchantId: data.providers.cbeBirr?.merchantId || '',
            },
            {
              id: 'helloCash',
              name: 'HelloCash',
              enabled: data.providers.helloCash?.enabled || false,
              apiKey: data.providers.helloCash?.apiKey || '',
              apiSecret: data.providers.helloCash?.apiSecret || '',
            },
          ]);
        }
      } catch (err) {
        console.error('Failed to load payment settings:', err);
        setError(err instanceof Error ? err.message : 'Failed to load payment settings');
      } finally {
        setIsLoading(false);
      }
    }

    fetchPaymentSettings();
  }, []);

  function handleProviderToggle(providerId: string) {
    setProviders(providers.map((p) => (p.id === providerId ? { ...p, enabled: !p.enabled } : p)));
  }

  function handleProviderUpdate(providerId: string, field: string, value: string | boolean) {
    setProviders(
      providers.map((p) =>
        p.id === providerId ? { ...p, [field]: value } : p,
      ) as PaymentProvider[],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      // Map providers to API format
      const providersData: any = {};

      providers.forEach((provider) => {
        if (provider.id === 'chapa') {
          providersData.chapa = {
            enabled: provider.enabled,
            apiKey: provider.apiKey || undefined,
            publicKey: provider.publicKey || undefined,
            webhookSecret: provider.webhookSecret || undefined,
          };
        } else if (provider.id === 'telebirr') {
          providersData.telebirr = {
            enabled: provider.enabled,
            apiKey: provider.apiKey || undefined,
            apiSecret: provider.apiSecret || undefined,
            merchantId: provider.merchantId || undefined,
          };
        } else if (provider.id === 'cbeBirr') {
          providersData.cbeBirr = {
            enabled: provider.enabled,
            apiKey: provider.apiKey || undefined,
            apiSecret: provider.apiSecret || undefined,
            merchantId: provider.merchantId || undefined,
          };
        } else if (provider.id === 'helloCash') {
          providersData.helloCash = {
            enabled: provider.enabled,
            apiKey: provider.apiKey || undefined,
            apiSecret: provider.apiSecret || undefined,
          };
        }
      });

      await apiPatch('/api/settings/payments', {
        providers: providersData,
      });

      setSuccess('Payment settings updated successfully');

      // Refresh settings after save
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update payment settings');
    } finally {
      setIsSaving(false);
    }
  }

  function toggleSecretVisibility(providerId: string, field: string) {
    const key = `${providerId}-${field}`;
    setShowSecrets((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function isSecretMasked(value?: string): boolean {
    return value ? value.includes('***') : false;
  }

  if (isLoading) {
    return (
      <DashboardPage
        title="Payment Integration"
        breadcrumbs={[
          { label: 'Organization', href: '/org' },
          { label: 'Settings', href: '/org/settings' },
          { label: 'Payment Integration', href: '/org/settings/payments' },
        ]}
      >
        <div className="col-span-full">
          <p className="text-muted-foreground">Loading payment settings...</p>
        </div>
      </DashboardPage>
    );
  }

  return (
    <DashboardPage
      title="Payment Integration"
      breadcrumbs={[
        { label: 'Organization', href: '/org' },
        { label: 'Settings', href: '/org/settings' },
        { label: 'Payment Integration', href: '/org/settings/payments' },
      ]}
    >
      <form onSubmit={handleSubmit} className="col-span-full space-y-6">
        {error && <div className="bg-destructive/10 text-destructive p-4 rounded-lg">{error}</div>}

        {success && (
          <div className="bg-green-500/10 text-green-600 dark:text-green-400 p-4 rounded-lg">
            {success}
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-primary" />
              <CardTitle>Payment Providers</CardTitle>
            </div>
            <CardDescription>
              Configure payment providers to accept payments from tenants
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {providers.map((provider) => (
              <Card key={provider.id} className="border">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-lg">{provider.name}</CardTitle>
                      {provider.enabled ? (
                        <Badge variant="default" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Enabled
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1">
                          <XCircle className="h-3 w-3" />
                          Disabled
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={provider.enabled}
                        onCheckedChange={() => handleProviderToggle(provider.id)}
                      />
                      <span className="text-sm text-muted-foreground">
                        {provider.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                {provider.enabled && (
                  <CardContent className="space-y-4 pt-0">
                    {/* Chapa specific fields */}
                    {provider.id === 'chapa' && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor={`${provider.id}-apiKey`}>Secret Key</Label>
                          <div className="relative">
                            <Input
                              id={`${provider.id}-apiKey`}
                              type={showSecrets[`${provider.id}-apiKey`] ? 'text' : 'password'}
                              value={provider.apiKey || ''}
                              onChange={(e) =>
                                handleProviderUpdate(provider.id, 'apiKey', e.target.value)
                              }
                              placeholder="CHASECK_TEST-..."
                              className="pr-10"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-0 top-0 h-full"
                              onClick={() => toggleSecretVisibility(provider.id, 'apiKey')}
                            >
                              {showSecrets[`${provider.id}-apiKey`] ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                          {isSecretMasked(provider.apiKey) && (
                            <p className="text-xs text-muted-foreground">
                              Enter a new value to update the secret key
                            </p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`${provider.id}-publicKey`}>Public Key</Label>
                          <div className="relative">
                            <Input
                              id={`${provider.id}-publicKey`}
                              type={showSecrets[`${provider.id}-publicKey`] ? 'text' : 'password'}
                              value={provider.publicKey || ''}
                              onChange={(e) =>
                                handleProviderUpdate(provider.id, 'publicKey', e.target.value)
                              }
                              placeholder="CHAPUBK_TEST-..."
                              className="pr-10"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-0 top-0 h-full"
                              onClick={() => toggleSecretVisibility(provider.id, 'publicKey')}
                            >
                              {showSecrets[`${provider.id}-publicKey`] ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                          {isSecretMasked(provider.publicKey) && (
                            <p className="text-xs text-muted-foreground">
                              Enter a new value to update the public key
                            </p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`${provider.id}-webhookSecret`}>Webhook Secret</Label>
                          <div className="relative">
                            <Input
                              id={`${provider.id}-webhookSecret`}
                              type={
                                showSecrets[`${provider.id}-webhookSecret`] ? 'text' : 'password'
                              }
                              value={provider.webhookSecret || ''}
                              onChange={(e) =>
                                handleProviderUpdate(provider.id, 'webhookSecret', e.target.value)
                              }
                              placeholder="Enter webhook secret"
                              className="pr-10"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-0 top-0 h-full"
                              onClick={() => toggleSecretVisibility(provider.id, 'webhookSecret')}
                            >
                              {showSecrets[`${provider.id}-webhookSecret`] ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                          {isSecretMasked(provider.webhookSecret) && (
                            <p className="text-xs text-muted-foreground">
                              Enter a new value to update the webhook secret
                            </p>
                          )}
                        </div>
                      </>
                    )}

                    {/* Other providers */}
                    {provider.id !== 'chapa' && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor={`${provider.id}-apiKey`}>API Key</Label>
                          <div className="relative">
                            <Input
                              id={`${provider.id}-apiKey`}
                              type={showSecrets[`${provider.id}-apiKey`] ? 'text' : 'password'}
                              value={provider.apiKey || ''}
                              onChange={(e) =>
                                handleProviderUpdate(provider.id, 'apiKey', e.target.value)
                              }
                              placeholder="Enter API key"
                              className="pr-10"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-0 top-0 h-full"
                              onClick={() => toggleSecretVisibility(provider.id, 'apiKey')}
                            >
                              {showSecrets[`${provider.id}-apiKey`] ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                          {isSecretMasked(provider.apiKey) && (
                            <p className="text-xs text-muted-foreground">
                              Enter a new value to update the API key
                            </p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`${provider.id}-apiSecret`}>API Secret</Label>
                          <div className="relative">
                            <Input
                              id={`${provider.id}-apiSecret`}
                              type={showSecrets[`${provider.id}-apiSecret`] ? 'text' : 'password'}
                              value={provider.apiSecret || ''}
                              onChange={(e) =>
                                handleProviderUpdate(provider.id, 'apiSecret', e.target.value)
                              }
                              placeholder="Enter API secret"
                              className="pr-10"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-0 top-0 h-full"
                              onClick={() => toggleSecretVisibility(provider.id, 'apiSecret')}
                            >
                              {showSecrets[`${provider.id}-apiSecret`] ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                          {isSecretMasked(provider.apiSecret) && (
                            <p className="text-xs text-muted-foreground">
                              Enter a new value to update the API secret
                            </p>
                          )}
                        </div>

                        {(provider.id === 'telebirr' || provider.id === 'cbeBirr') && (
                          <div className="space-y-2">
                            <Label htmlFor={`${provider.id}-merchantId`}>Merchant ID</Label>
                            <Input
                              id={`${provider.id}-merchantId`}
                              type="text"
                              value={provider.merchantId || ''}
                              onChange={(e) =>
                                handleProviderUpdate(provider.id, 'merchantId', e.target.value)
                              }
                              placeholder="Enter merchant ID"
                            />
                          </div>
                        )}
                      </>
                    )}

                    {provider.webhookUrl && (
                      <div className="space-y-2">
                        <Label htmlFor={`${provider.id}-webhookUrl`}>Webhook URL</Label>
                        <Input
                          id={`${provider.id}-webhookUrl`}
                          value={provider.webhookUrl}
                          disabled
                          className="bg-muted"
                        />
                        <p className="text-sm text-muted-foreground">
                          This URL is automatically configured. Use this in your payment provider
                          dashboard.
                        </p>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            ))}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button type="submit" disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </DashboardPage>
  );
}
