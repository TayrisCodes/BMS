import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { isSuperAdmin } from '@/lib/auth/authz';
import {
  getSystemSettings,
  updateSystemSettings,
  updateSystemSettingsSection,
  type SystemSettings,
} from '@/lib/settings/system-settings';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only SUPER_ADMIN can view system settings
    if (!isSuperAdmin(context)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const settings = await getSystemSettings();

    // Remove sensitive data before sending
    const safeSettings = {
      ...settings,
      integrations: {
        ...settings.integrations,
        paymentProviders: {
          telebirr: {
            enabled: settings.integrations.paymentProviders.telebirr.enabled,
            // Don't send API keys
          },
          cbeBirr: {
            enabled: settings.integrations.paymentProviders.cbeBirr.enabled,
          },
          chapa: {
            enabled: settings.integrations.paymentProviders.chapa.enabled,
          },
          helloCash: {
            enabled: settings.integrations.paymentProviders.helloCash.enabled,
          },
        },
      },
    };

    return NextResponse.json({ settings: safeSettings });
  } catch (error) {
    console.error('Get settings error:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only SUPER_ADMIN can update system settings
    if (!isSuperAdmin(context)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = (await request.json()) as {
      section?: keyof Omit<SystemSettings, '_id' | 'createdAt' | 'updatedAt'>;
      data?: Partial<SystemSettings>;
    };

    let updatedSettings: SystemSettings;

    if (body.section && body.data) {
      // Update specific section
      updatedSettings = await updateSystemSettingsSection(body.section, body.data as any);
    } else if (body.data) {
      // Update entire settings
      updatedSettings = await updateSystemSettings(body.data);
    } else {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    // Remove sensitive data before sending
    const safeSettings = {
      ...updatedSettings,
      integrations: {
        ...updatedSettings.integrations,
        paymentProviders: {
          telebirr: {
            enabled: updatedSettings.integrations.paymentProviders.telebirr.enabled,
          },
          cbeBirr: {
            enabled: updatedSettings.integrations.paymentProviders.cbeBirr.enabled,
          },
          chapa: {
            enabled: updatedSettings.integrations.paymentProviders.chapa.enabled,
          },
          helloCash: {
            enabled: updatedSettings.integrations.paymentProviders.helloCash.enabled,
          },
        },
      },
    };

    return NextResponse.json({
      message: 'Settings updated successfully',
      settings: safeSettings,
    });
  } catch (error) {
    console.error('Update settings error:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
