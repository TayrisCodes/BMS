'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/lib/components/ui/tabs';
import {
  Loader2,
  Settings,
  Database,
  Shield,
  Mail,
  Globe,
  Server,
  AlertCircle,
  CreditCard,
  Save,
  RefreshCw,
} from 'lucide-react';
import { Switch } from '@/lib/components/ui/switch';
import { Textarea } from '@/lib/components/ui/textarea';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import { apiGet, apiPost } from '@/lib/utils/api-client';
import { Separator } from '@/lib/components/ui/separator';
import { Badge } from '@/lib/components/ui/badge';

interface SystemSettings {
  general: {
    appName: string;
    appUrl: string;
    supportEmail: string;
    supportPhone: string;
  };
  security: {
    sessionTimeout: number;
    requireMfa: boolean;
    passwordMinLength: number;
    passwordRequireUppercase: boolean;
    passwordRequireLowercase: boolean;
    passwordRequireNumbers: boolean;
    passwordRequireSpecialChars: boolean;
  };
  notifications: {
    emailEnabled: boolean;
    smsEnabled: boolean;
    whatsappEnabled: boolean;
    emailFrom: string;
    emailProvider?: string;
    smsProvider?: string;
  };
  maintenance: {
    maintenanceMode: boolean;
    maintenanceMessage: string;
  };
  integrations: {
    paymentProviders: {
      telebirr: {
        enabled: boolean;
        apiKey?: string;
        apiSecret?: string;
        merchantId?: string;
      };
      cbeBirr: {
        enabled: boolean;
        apiKey?: string;
        apiSecret?: string;
        merchantId?: string;
      };
      chapa: {
        enabled: boolean;
        apiKey?: string;
        publicKey?: string;
        webhookSecret?: string;
      };
      helloCash: {
        enabled: boolean;
        apiKey?: string;
        apiSecret?: string;
      };
    };
  };
  featureFlags?: Record<string, boolean | Record<string, boolean>>;
}

export default function AdminSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('general');

  useEffect(() => {
    async function fetchSettings() {
      try {
        setLoading(true);
        const data = await apiGet<{ settings: SystemSettings }>('/api/admin/settings');
        setSettings(data.settings);
      } catch (error) {
        console.error('Failed to fetch settings:', error);
        setErrors({ fetch: 'Failed to load settings. Please refresh the page.' });
      } finally {
        setLoading(false);
      }
    }

    fetchSettings();
  }, []);

  const handleSave = async (section: keyof Omit<SystemSettings, 'featureFlags'>) => {
    if (!settings) return;

    setSaving((prev) => ({ ...prev, [section]: true }));
    setErrors({});
    setSuccessMessage(null);

    try {
      await apiPost('/api/admin/settings', {
        section,
        data: settings[section],
      });

      setSuccessMessage(
        `${section.charAt(0).toUpperCase() + section.slice(1)} settings saved successfully`,
      );
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (error) {
      console.error('Failed to save settings:', error);
      setErrors({
        [section]:
          error instanceof Error ? error.message : 'Failed to save settings. Please try again.',
      });
    } finally {
      setSaving((prev) => ({ ...prev, [section]: false }));
    }
  };

  const handleEnsureIndexes = async () => {
    setSaving((prev) => ({ ...prev, indexes: true }));
    setErrors({});
    setSuccessMessage(null);

    try {
      const response = await fetch('/api/admin/ensure-indexes', {
        method: 'POST',
      });

      if (response.ok) {
        setSuccessMessage('Database indexes ensured successfully');
        setTimeout(() => setSuccessMessage(null), 5000);
      } else {
        const data = await response.json();
        setErrors({ indexes: data.error || 'Failed to ensure indexes' });
      }
    } catch (error) {
      console.error('Failed to ensure indexes:', error);
      setErrors({ indexes: 'Failed to ensure indexes. Please try again.' });
    } finally {
      setSaving((prev) => ({ ...prev, indexes: false }));
    }
  };

  if (loading) {
    return (
      <DashboardPage title="System Settings">
        <div className="col-span-full flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Loading settings...</p>
          </div>
        </div>
      </DashboardPage>
    );
  }

  if (!settings) {
    return (
      <DashboardPage title="System Settings">
        <div className="col-span-full">
          <div className="p-4 rounded-md bg-destructive/10 text-destructive">
            {errors.fetch || 'Failed to load settings'}
          </div>
          <Button onClick={() => window.location.reload()} className="mt-4">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </DashboardPage>
    );
  }

  return (
    <DashboardPage
      title="System Settings"
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'Settings', href: '/admin/settings' },
      ]}
    >
      <div className="col-span-full">
        {successMessage && (
          <div className="mb-4 p-4 rounded-md bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 text-sm border border-green-200 dark:border-green-800">
            {successMessage}
          </div>
        )}

        {Object.keys(errors).length > 0 && (
          <div className="mb-4 p-4 rounded-md bg-destructive/10 text-destructive text-sm border border-destructive/20">
            {Object.entries(errors).map(([key, value]) => (
              <div key={key}>{value}</div>
            ))}
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="general">
              <Globe className="h-4 w-4 mr-2" />
              General
            </TabsTrigger>
            <TabsTrigger value="security">
              <Shield className="h-4 w-4 mr-2" />
              Security
            </TabsTrigger>
            <TabsTrigger value="notifications">
              <Mail className="h-4 w-4 mr-2" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="integrations">
              <CreditCard className="h-4 w-4 mr-2" />
              Integrations
            </TabsTrigger>
            <TabsTrigger value="maintenance">
              <Server className="h-4 w-4 mr-2" />
              Maintenance
            </TabsTrigger>
          </TabsList>

          {/* General Settings */}
          <TabsContent value="general" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  General Settings
                </CardTitle>
                <CardDescription>
                  Configure general application settings and branding.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="appName">Application Name *</Label>
                    <Input
                      id="appName"
                      type="text"
                      value={settings.general.appName}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          general: { ...settings.general, appName: e.target.value },
                        })
                      }
                      placeholder="BMS"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="appUrl">Application URL *</Label>
                    <Input
                      id="appUrl"
                      type="url"
                      value={settings.general.appUrl}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          general: { ...settings.general, appUrl: e.target.value },
                        })
                      }
                      placeholder="https://bms.example.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="supportEmail">Support Email *</Label>
                    <Input
                      id="supportEmail"
                      type="email"
                      value={settings.general.supportEmail}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          general: { ...settings.general, supportEmail: e.target.value },
                        })
                      }
                      placeholder="support@example.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="supportPhone">Support Phone</Label>
                    <Input
                      id="supportPhone"
                      type="tel"
                      value={settings.general.supportPhone}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          general: { ...settings.general, supportPhone: e.target.value },
                        })
                      }
                      placeholder="+251911111111"
                    />
                  </div>
                </div>

                <Separator />

                <Button
                  onClick={() => handleSave('general')}
                  disabled={saving.general}
                  className="w-full md:w-auto"
                >
                  {saving.general ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save General Settings
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Settings */}
          <TabsContent value="security" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Security Settings
                </CardTitle>
                <CardDescription>Configure security and authentication policies.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="sessionTimeout">Session Timeout (hours) *</Label>
                  <Input
                    id="sessionTimeout"
                    type="number"
                    min="1"
                    max="168"
                    value={settings.security.sessionTimeout}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        security: {
                          ...settings.security,
                          sessionTimeout: parseInt(e.target.value) || 24,
                        },
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Session will expire after this many hours of inactivity
                  </p>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="requireMfa">Require Multi-Factor Authentication</Label>
                    <p className="text-sm text-muted-foreground">
                      Force all users to enable MFA for enhanced security
                    </p>
                  </div>
                  <Switch
                    id="requireMfa"
                    checked={settings.security.requireMfa}
                    onCheckedChange={(checked) =>
                      setSettings({
                        ...settings,
                        security: { ...settings.security, requireMfa: checked },
                      })
                    }
                  />
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="passwordMinLength">Minimum Password Length *</Label>
                    <Input
                      id="passwordMinLength"
                      type="number"
                      min="6"
                      max="32"
                      value={settings.security.passwordMinLength}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          security: {
                            ...settings.security,
                            passwordMinLength: parseInt(e.target.value) || 8,
                          },
                        })
                      }
                    />
                  </div>

                  <div className="space-y-3">
                    <Label>Password Requirements</Label>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="passwordRequireUppercase" className="font-normal">
                          Require Uppercase Letters
                        </Label>
                        <Switch
                          id="passwordRequireUppercase"
                          checked={settings.security.passwordRequireUppercase}
                          onCheckedChange={(checked) =>
                            setSettings({
                              ...settings,
                              security: {
                                ...settings.security,
                                passwordRequireUppercase: checked,
                              },
                            })
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="passwordRequireLowercase" className="font-normal">
                          Require Lowercase Letters
                        </Label>
                        <Switch
                          id="passwordRequireLowercase"
                          checked={settings.security.passwordRequireLowercase}
                          onCheckedChange={(checked) =>
                            setSettings({
                              ...settings,
                              security: {
                                ...settings.security,
                                passwordRequireLowercase: checked,
                              },
                            })
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="passwordRequireNumbers" className="font-normal">
                          Require Numbers
                        </Label>
                        <Switch
                          id="passwordRequireNumbers"
                          checked={settings.security.passwordRequireNumbers}
                          onCheckedChange={(checked) =>
                            setSettings({
                              ...settings,
                              security: {
                                ...settings.security,
                                passwordRequireNumbers: checked,
                              },
                            })
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="passwordRequireSpecialChars" className="font-normal">
                          Require Special Characters
                        </Label>
                        <Switch
                          id="passwordRequireSpecialChars"
                          checked={settings.security.passwordRequireSpecialChars}
                          onCheckedChange={(checked) =>
                            setSettings({
                              ...settings,
                              security: {
                                ...settings.security,
                                passwordRequireSpecialChars: checked,
                              },
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                <Button
                  onClick={() => handleSave('security')}
                  disabled={saving.security}
                  className="w-full md:w-auto"
                >
                  {saving.security ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Security Settings
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notification Settings */}
          <TabsContent value="notifications" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Notification Settings
                </CardTitle>
                <CardDescription>Configure notification channels and providers.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="emailEnabled">Email Notifications</Label>
                      <p className="text-sm text-muted-foreground">
                        Enable email notifications for system events
                      </p>
                    </div>
                    <Switch
                      id="emailEnabled"
                      checked={settings.notifications.emailEnabled}
                      onCheckedChange={(checked) =>
                        setSettings({
                          ...settings,
                          notifications: { ...settings.notifications, emailEnabled: checked },
                        })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="smsEnabled">SMS Notifications</Label>
                      <p className="text-sm text-muted-foreground">
                        Enable SMS notifications for critical alerts
                      </p>
                    </div>
                    <Switch
                      id="smsEnabled"
                      checked={settings.notifications.smsEnabled}
                      onCheckedChange={(checked) =>
                        setSettings({
                          ...settings,
                          notifications: { ...settings.notifications, smsEnabled: checked },
                        })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="whatsappEnabled">WhatsApp Notifications</Label>
                      <p className="text-sm text-muted-foreground">
                        Enable WhatsApp notifications (requires integration)
                      </p>
                    </div>
                    <Switch
                      id="whatsappEnabled"
                      checked={settings.notifications.whatsappEnabled || false}
                      onCheckedChange={(checked) =>
                        setSettings({
                          ...settings,
                          notifications: { ...settings.notifications, whatsappEnabled: checked },
                        })
                      }
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="emailFrom">Email From Address *</Label>
                    <Input
                      id="emailFrom"
                      type="email"
                      value={settings.notifications.emailFrom}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          notifications: { ...settings.notifications, emailFrom: e.target.value },
                        })
                      }
                      placeholder="noreply@example.com"
                    />
                    <p className="text-xs text-muted-foreground">
                      Default sender email address for system notifications
                    </p>
                  </div>
                </div>

                <Separator />

                <Button
                  onClick={() => handleSave('notifications')}
                  disabled={saving.notifications}
                  className="w-full md:w-auto"
                >
                  {saving.notifications ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Notification Settings
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Integrations Settings */}
          <TabsContent value="integrations" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Payment Provider Integrations
                </CardTitle>
                <CardDescription>
                  Configure payment gateway integrations for tenant payments.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Telebirr */}
                <div className="space-y-4 p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Label htmlFor="telebirrEnabled" className="text-base font-semibold">
                          Telebirr
                        </Label>
                        <Badge
                          variant={
                            settings.integrations.paymentProviders.telebirr.enabled
                              ? 'default'
                              : 'secondary'
                          }
                        >
                          {settings.integrations.paymentProviders.telebirr.enabled
                            ? 'Enabled'
                            : 'Disabled'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Ethiopian mobile money payment provider
                      </p>
                    </div>
                    <Switch
                      id="telebirrEnabled"
                      checked={settings.integrations.paymentProviders.telebirr.enabled}
                      onCheckedChange={(checked) =>
                        setSettings({
                          ...settings,
                          integrations: {
                            ...settings.integrations,
                            paymentProviders: {
                              ...settings.integrations.paymentProviders,
                              telebirr: {
                                ...settings.integrations.paymentProviders.telebirr,
                                enabled: checked,
                              },
                            },
                          },
                        })
                      }
                    />
                  </div>
                  {settings.integrations.paymentProviders.telebirr.enabled && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                      <div className="space-y-2">
                        <Label htmlFor="telebirrApiKey">API Key</Label>
                        <Input
                          id="telebirrApiKey"
                          type="password"
                          value={settings.integrations.paymentProviders.telebirr.apiKey || ''}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              integrations: {
                                ...settings.integrations,
                                paymentProviders: {
                                  ...settings.integrations.paymentProviders,
                                  telebirr: {
                                    ...settings.integrations.paymentProviders.telebirr,
                                    apiKey: e.target.value,
                                  },
                                },
                              },
                            })
                          }
                          placeholder="Enter API key"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="telebirrApiSecret">API Secret</Label>
                        <Input
                          id="telebirrApiSecret"
                          type="password"
                          value={settings.integrations.paymentProviders.telebirr.apiSecret || ''}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              integrations: {
                                ...settings.integrations,
                                paymentProviders: {
                                  ...settings.integrations.paymentProviders,
                                  telebirr: {
                                    ...settings.integrations.paymentProviders.telebirr,
                                    apiSecret: e.target.value,
                                  },
                                },
                              },
                            })
                          }
                          placeholder="Enter API secret"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="telebirrMerchantId">Merchant ID</Label>
                        <Input
                          id="telebirrMerchantId"
                          type="text"
                          value={settings.integrations.paymentProviders.telebirr.merchantId || ''}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              integrations: {
                                ...settings.integrations,
                                paymentProviders: {
                                  ...settings.integrations.paymentProviders,
                                  telebirr: {
                                    ...settings.integrations.paymentProviders.telebirr,
                                    merchantId: e.target.value,
                                  },
                                },
                              },
                            })
                          }
                          placeholder="Enter merchant ID"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* CBE Birr */}
                <div className="space-y-4 p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Label htmlFor="cbeBirrEnabled" className="text-base font-semibold">
                          CBE Birr
                        </Label>
                        <Badge
                          variant={
                            settings.integrations.paymentProviders.cbeBirr.enabled
                              ? 'default'
                              : 'secondary'
                          }
                        >
                          {settings.integrations.paymentProviders.cbeBirr.enabled
                            ? 'Enabled'
                            : 'Disabled'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Commercial Bank of Ethiopia mobile payment
                      </p>
                    </div>
                    <Switch
                      id="cbeBirrEnabled"
                      checked={settings.integrations.paymentProviders.cbeBirr.enabled}
                      onCheckedChange={(checked) =>
                        setSettings({
                          ...settings,
                          integrations: {
                            ...settings.integrations,
                            paymentProviders: {
                              ...settings.integrations.paymentProviders,
                              cbeBirr: {
                                ...settings.integrations.paymentProviders.cbeBirr,
                                enabled: checked,
                              },
                            },
                          },
                        })
                      }
                    />
                  </div>
                  {settings.integrations.paymentProviders.cbeBirr.enabled && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                      <div className="space-y-2">
                        <Label htmlFor="cbeBirrApiKey">API Key</Label>
                        <Input
                          id="cbeBirrApiKey"
                          type="password"
                          value={settings.integrations.paymentProviders.cbeBirr.apiKey || ''}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              integrations: {
                                ...settings.integrations,
                                paymentProviders: {
                                  ...settings.integrations.paymentProviders,
                                  cbeBirr: {
                                    ...settings.integrations.paymentProviders.cbeBirr,
                                    apiKey: e.target.value,
                                  },
                                },
                              },
                            })
                          }
                          placeholder="Enter API key"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cbeBirrApiSecret">API Secret</Label>
                        <Input
                          id="cbeBirrApiSecret"
                          type="password"
                          value={settings.integrations.paymentProviders.cbeBirr.apiSecret || ''}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              integrations: {
                                ...settings.integrations,
                                paymentProviders: {
                                  ...settings.integrations.paymentProviders,
                                  cbeBirr: {
                                    ...settings.integrations.paymentProviders.cbeBirr,
                                    apiSecret: e.target.value,
                                  },
                                },
                              },
                            })
                          }
                          placeholder="Enter API secret"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cbeBirrMerchantId">Merchant ID</Label>
                        <Input
                          id="cbeBirrMerchantId"
                          type="text"
                          value={settings.integrations.paymentProviders.cbeBirr.merchantId || ''}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              integrations: {
                                ...settings.integrations,
                                paymentProviders: {
                                  ...settings.integrations.paymentProviders,
                                  cbeBirr: {
                                    ...settings.integrations.paymentProviders.cbeBirr,
                                    merchantId: e.target.value,
                                  },
                                },
                              },
                            })
                          }
                          placeholder="Enter merchant ID"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Chapa */}
                <div className="space-y-4 p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Label htmlFor="chapaEnabled" className="text-base font-semibold">
                          Chapa
                        </Label>
                        <Badge
                          variant={
                            settings.integrations.paymentProviders.chapa.enabled
                              ? 'default'
                              : 'secondary'
                          }
                        >
                          {settings.integrations.paymentProviders.chapa.enabled
                            ? 'Enabled'
                            : 'Disabled'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Ethiopian payment gateway
                      </p>
                    </div>
                    <Switch
                      id="chapaEnabled"
                      checked={settings.integrations.paymentProviders.chapa.enabled}
                      onCheckedChange={(checked) =>
                        setSettings({
                          ...settings,
                          integrations: {
                            ...settings.integrations,
                            paymentProviders: {
                              ...settings.integrations.paymentProviders,
                              chapa: {
                                ...settings.integrations.paymentProviders.chapa,
                                enabled: checked,
                              },
                            },
                          },
                        })
                      }
                    />
                  </div>
                  {settings.integrations.paymentProviders.chapa.enabled && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                      <div className="space-y-2">
                        <Label htmlFor="chapaApiKey">Secret Key *</Label>
                        <Input
                          id="chapaApiKey"
                          type="password"
                          value={settings.integrations.paymentProviders.chapa.apiKey || ''}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              integrations: {
                                ...settings.integrations,
                                paymentProviders: {
                                  ...settings.integrations.paymentProviders,
                                  chapa: {
                                    ...settings.integrations.paymentProviders.chapa,
                                    apiKey: e.target.value,
                                  },
                                },
                              },
                            })
                          }
                          placeholder="CHASECK_TEST-..."
                        />
                        <p className="text-xs text-muted-foreground">
                          Your Chapa secret key (starts with CHASECK_)
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="chapaPublicKey">Public Key</Label>
                        <Input
                          id="chapaPublicKey"
                          type="text"
                          value={settings.integrations.paymentProviders.chapa.publicKey || ''}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              integrations: {
                                ...settings.integrations,
                                paymentProviders: {
                                  ...settings.integrations.paymentProviders,
                                  chapa: {
                                    ...settings.integrations.paymentProviders.chapa,
                                    publicKey: e.target.value,
                                  },
                                },
                              },
                            })
                          }
                          placeholder="CHAPUBK_TEST-..."
                        />
                        <p className="text-xs text-muted-foreground">
                          Your Chapa public key (optional, for client-side)
                        </p>
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="chapaWebhookSecret">Webhook Secret</Label>
                        <Input
                          id="chapaWebhookSecret"
                          type="password"
                          value={settings.integrations.paymentProviders.chapa.webhookSecret || ''}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              integrations: {
                                ...settings.integrations,
                                paymentProviders: {
                                  ...settings.integrations.paymentProviders,
                                  chapa: {
                                    ...settings.integrations.paymentProviders.chapa,
                                    webhookSecret: e.target.value,
                                  },
                                },
                              },
                            })
                          }
                          placeholder="Webhook secret for signature verification"
                        />
                        <p className="text-xs text-muted-foreground">
                          Webhook secret for verifying Chapa webhook signatures (optional, uses
                          secret key if not set)
                        </p>
                      </div>
                      <div className="md:col-span-2 p-3 bg-muted/50 rounded-lg">
                        <p className="text-sm font-medium mb-2">Webhook URL:</p>
                        <code className="text-xs bg-background p-2 rounded block">
                          {typeof window !== 'undefined'
                            ? `${window.location.origin}/api/webhooks/payments/chapa`
                            : '/api/webhooks/payments/chapa'}
                        </code>
                        <p className="text-xs text-muted-foreground mt-2">
                          Configure this URL in your Chapa dashboard for payment callbacks
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* HelloCash */}
                <div className="space-y-4 p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Label htmlFor="helloCashEnabled" className="text-base font-semibold">
                          HelloCash
                        </Label>
                        <Badge
                          variant={
                            settings.integrations.paymentProviders.helloCash.enabled
                              ? 'default'
                              : 'secondary'
                          }
                        >
                          {settings.integrations.paymentProviders.helloCash.enabled
                            ? 'Enabled'
                            : 'Disabled'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Ethiopian mobile payment provider
                      </p>
                    </div>
                    <Switch
                      id="helloCashEnabled"
                      checked={settings.integrations.paymentProviders.helloCash.enabled}
                      onCheckedChange={(checked) =>
                        setSettings({
                          ...settings,
                          integrations: {
                            ...settings.integrations,
                            paymentProviders: {
                              ...settings.integrations.paymentProviders,
                              helloCash: {
                                ...settings.integrations.paymentProviders.helloCash,
                                enabled: checked,
                              },
                            },
                          },
                        })
                      }
                    />
                  </div>
                  {settings.integrations.paymentProviders.helloCash.enabled && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                      <div className="space-y-2">
                        <Label htmlFor="helloCashApiKey">API Key</Label>
                        <Input
                          id="helloCashApiKey"
                          type="password"
                          value={settings.integrations.paymentProviders.helloCash.apiKey || ''}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              integrations: {
                                ...settings.integrations,
                                paymentProviders: {
                                  ...settings.integrations.paymentProviders,
                                  helloCash: {
                                    ...settings.integrations.paymentProviders.helloCash,
                                    apiKey: e.target.value,
                                  },
                                },
                              },
                            })
                          }
                          placeholder="Enter API key"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="helloCashApiSecret">API Secret</Label>
                        <Input
                          id="helloCashApiSecret"
                          type="password"
                          value={settings.integrations.paymentProviders.helloCash.apiSecret || ''}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              integrations: {
                                ...settings.integrations,
                                paymentProviders: {
                                  ...settings.integrations.paymentProviders,
                                  helloCash: {
                                    ...settings.integrations.paymentProviders.helloCash,
                                    apiSecret: e.target.value,
                                  },
                                },
                              },
                            })
                          }
                          placeholder="Enter API secret"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                <Button
                  onClick={() => handleSave('integrations')}
                  disabled={saving.integrations}
                  className="w-full md:w-auto"
                >
                  {saving.integrations ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Integration Settings
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Maintenance Settings */}
          <TabsContent value="maintenance" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  Maintenance Settings
                </CardTitle>
                <CardDescription>
                  Configure system maintenance mode and database operations.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="maintenanceMode">Maintenance Mode</Label>
                      <p className="text-sm text-muted-foreground">
                        Enable maintenance mode to restrict access to the system
                      </p>
                    </div>
                    <Switch
                      id="maintenanceMode"
                      checked={settings.maintenance.maintenanceMode}
                      onCheckedChange={(checked) =>
                        setSettings({
                          ...settings,
                          maintenance: { ...settings.maintenance, maintenanceMode: checked },
                        })
                      }
                    />
                  </div>

                  {settings.maintenance.maintenanceMode && (
                    <div className="p-4 rounded-md bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                            Maintenance Mode Active
                          </p>
                          <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                            Users will see the maintenance message when accessing the system.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="maintenanceMessage">Maintenance Message *</Label>
                    <Textarea
                      id="maintenanceMessage"
                      value={settings.maintenance.maintenanceMessage}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          maintenance: {
                            ...settings.maintenance,
                            maintenanceMessage: e.target.value,
                          },
                        })
                      }
                      rows={4}
                      placeholder="System is under maintenance. Please check back later."
                    />
                    <p className="text-xs text-muted-foreground">
                      Message displayed to users when maintenance mode is enabled
                    </p>
                  </div>
                </div>

                <Separator />

                <Button
                  onClick={() => handleSave('maintenance')}
                  disabled={saving.maintenance}
                  className="w-full md:w-auto"
                >
                  {saving.maintenance ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Maintenance Settings
                    </>
                  )}
                </Button>

                <Separator />

                {/* Database Management */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                      <Database className="h-5 w-5" />
                      Database Management
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Manage database indexes and maintenance tasks.
                    </p>
                  </div>

                  <div className="p-4 rounded-md bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                          Database Operations
                        </p>
                        <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                          Ensure database indexes are properly created. This operation is safe and
                          can be run multiple times.
                        </p>
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={handleEnsureIndexes}
                    disabled={saving.indexes}
                    variant="outline"
                    className="w-full md:w-auto"
                  >
                    {saving.indexes ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Database className="mr-2 h-4 w-4" />
                        Ensure Database Indexes
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardPage>
  );
}
