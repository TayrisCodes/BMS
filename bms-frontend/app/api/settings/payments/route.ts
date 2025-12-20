import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { getSystemSettings, updateSystemSettings } from '@/lib/settings/system-settings';

/**
 * GET /api/settings/payments
 * Get payment provider settings.
 * Requires settings.read permission.
 */
export async function GET() {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to read settings
    requirePermission(context, 'settings', 'read');

    const settings = await getSystemSettings();

    // Return payment providers with masked secrets
    const providers = {
      telebirr: {
        enabled: settings.integrations.paymentProviders.telebirr.enabled,
        apiKey: settings.integrations.paymentProviders.telebirr.apiKey
          ? maskSecret(settings.integrations.paymentProviders.telebirr.apiKey)
          : undefined,
        apiSecret: settings.integrations.paymentProviders.telebirr.apiSecret
          ? maskSecret(settings.integrations.paymentProviders.telebirr.apiSecret)
          : undefined,
        merchantId: settings.integrations.paymentProviders.telebirr.merchantId,
      },
      cbeBirr: {
        enabled: settings.integrations.paymentProviders.cbeBirr.enabled,
        apiKey: settings.integrations.paymentProviders.cbeBirr.apiKey
          ? maskSecret(settings.integrations.paymentProviders.cbeBirr.apiKey)
          : undefined,
        apiSecret: settings.integrations.paymentProviders.cbeBirr.apiSecret
          ? maskSecret(settings.integrations.paymentProviders.cbeBirr.apiSecret)
          : undefined,
        merchantId: settings.integrations.paymentProviders.cbeBirr.merchantId,
      },
      chapa: {
        enabled: settings.integrations.paymentProviders.chapa.enabled,
        apiKey: settings.integrations.paymentProviders.chapa.apiKey
          ? maskSecret(settings.integrations.paymentProviders.chapa.apiKey)
          : undefined,
        publicKey: settings.integrations.paymentProviders.chapa.publicKey
          ? maskSecret(settings.integrations.paymentProviders.chapa.publicKey)
          : undefined,
        webhookSecret: settings.integrations.paymentProviders.chapa.webhookSecret
          ? maskSecret(settings.integrations.paymentProviders.chapa.webhookSecret)
          : undefined,
      },
      helloCash: {
        enabled: settings.integrations.paymentProviders.helloCash.enabled,
        apiKey: settings.integrations.paymentProviders.helloCash.apiKey
          ? maskSecret(settings.integrations.paymentProviders.helloCash.apiKey)
          : undefined,
        apiSecret: settings.integrations.paymentProviders.helloCash.apiSecret
          ? maskSecret(settings.integrations.paymentProviders.helloCash.apiSecret)
          : undefined,
      },
    };

    return NextResponse.json({ providers });
  } catch (error) {
    console.error('Get payment settings error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
    }
    return NextResponse.json({ error: 'Failed to fetch payment settings' }, { status: 500 });
  }
}

/**
 * PATCH /api/settings/payments
 * Update payment provider settings.
 * Requires settings.write permission.
 */
export async function PATCH(request: Request) {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to write settings
    requirePermission(context, 'settings', 'write');

    const body = (await request.json()) as {
      providers: {
        telebirr?: {
          enabled?: boolean;
          apiKey?: string;
          apiSecret?: string;
          merchantId?: string;
        };
        cbeBirr?: {
          enabled?: boolean;
          apiKey?: string;
          apiSecret?: string;
          merchantId?: string;
        };
        chapa?: {
          enabled?: boolean;
          apiKey?: string;
          publicKey?: string;
          webhookSecret?: string;
        };
        helloCash?: {
          enabled?: boolean;
          apiKey?: string;
          apiSecret?: string;
        };
      };
    };

    // Get current settings
    const currentSettings = await getSystemSettings();

    // Update payment providers
    const updatedProviders = {
      ...currentSettings.integrations.paymentProviders,
    };

    // Update each provider if provided
    if (body.providers.telebirr) {
      updatedProviders.telebirr = {
        ...updatedProviders.telebirr,
        ...body.providers.telebirr,
        // Only update secrets if new values are provided (not masked)
        apiKey:
          body.providers.telebirr.apiKey && !body.providers.telebirr.apiKey.includes('***')
            ? body.providers.telebirr.apiKey
            : updatedProviders.telebirr.apiKey,
        apiSecret:
          body.providers.telebirr.apiSecret && !body.providers.telebirr.apiSecret.includes('***')
            ? body.providers.telebirr.apiSecret
            : updatedProviders.telebirr.apiSecret,
      };
    }

    if (body.providers.cbeBirr) {
      updatedProviders.cbeBirr = {
        ...updatedProviders.cbeBirr,
        ...body.providers.cbeBirr,
        apiKey:
          body.providers.cbeBirr.apiKey && !body.providers.cbeBirr.apiKey.includes('***')
            ? body.providers.cbeBirr.apiKey
            : updatedProviders.cbeBirr.apiKey,
        apiSecret:
          body.providers.cbeBirr.apiSecret && !body.providers.cbeBirr.apiSecret.includes('***')
            ? body.providers.cbeBirr.apiSecret
            : updatedProviders.cbeBirr.apiSecret,
      };
    }

    if (body.providers.chapa) {
      updatedProviders.chapa = {
        ...updatedProviders.chapa,
        ...body.providers.chapa,
        apiKey:
          body.providers.chapa.apiKey && !body.providers.chapa.apiKey.includes('***')
            ? body.providers.chapa.apiKey
            : updatedProviders.chapa.apiKey,
        publicKey:
          body.providers.chapa.publicKey && !body.providers.chapa.publicKey.includes('***')
            ? body.providers.chapa.publicKey
            : updatedProviders.chapa.publicKey,
        webhookSecret:
          body.providers.chapa.webhookSecret && !body.providers.chapa.webhookSecret.includes('***')
            ? body.providers.chapa.webhookSecret
            : updatedProviders.chapa.webhookSecret,
      };
    }

    if (body.providers.helloCash) {
      updatedProviders.helloCash = {
        ...updatedProviders.helloCash,
        ...body.providers.helloCash,
        apiKey:
          body.providers.helloCash.apiKey && !body.providers.helloCash.apiKey.includes('***')
            ? body.providers.helloCash.apiKey
            : updatedProviders.helloCash.apiKey,
        apiSecret:
          body.providers.helloCash.apiSecret && !body.providers.helloCash.apiSecret.includes('***')
            ? body.providers.helloCash.apiSecret
            : updatedProviders.helloCash.apiSecret,
      };
    }

    // Update settings
    await updateSystemSettings({
      integrations: {
        paymentProviders: updatedProviders,
      },
    } as any);

    return NextResponse.json({ message: 'Payment settings updated successfully' });
  } catch (error) {
    console.error('Update payment settings error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
    }
    return NextResponse.json({ error: 'Failed to update payment settings' }, { status: 500 });
  }
}

/**
 * Mask secret values for display (show only last 4 characters)
 */
function maskSecret(secret: string): string {
  if (!secret || secret.length <= 4) {
    return '****';
  }
  return '***' + secret.slice(-4);
}

