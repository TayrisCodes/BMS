import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { findOrganizationById, updateOrganization } from '@/lib/organizations/organizations';

/**
 * GET /api/settings/billing
 * Get billing settings (payment reminders) for the organization.
 * Requires settings.read permission.
 */
export async function GET(request: Request) {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to read settings
    requirePermission(context, 'settings', 'read');

    const organizationId = context.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    const organization = await findOrganizationById(organizationId);
    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Default payment reminder settings
    const defaultSettings = {
      daysBeforeDue: [7, 3, 0],
      daysAfterDue: [3, 7, 14, 30],
      escalationEnabled: true,
      reminderChannels: ['in_app', 'email', 'sms'] as ('in_app' | 'email' | 'sms')[],
    };

    const settings = organization.paymentReminderSettings || defaultSettings;

    return NextResponse.json({
      settings: {
        daysBeforeDue: settings.daysBeforeDue,
        daysAfterDue: settings.daysAfterDue,
        escalationEnabled: settings.escalationEnabled,
        reminderChannels: settings.reminderChannels,
      },
    });
  } catch (error) {
    console.error('Get billing settings error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
    }
    return NextResponse.json(
      { error: 'Unexpected error while fetching billing settings' },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/settings/billing
 * Update billing settings (payment reminders) for the organization.
 * Requires settings.update permission.
 */
export async function PUT(request: Request) {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to update settings
    requirePermission(context, 'settings', 'update');

    const organizationId = context.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    const body = (await request.json()) as {
      daysBeforeDue?: number[];
      daysAfterDue?: number[];
      escalationEnabled?: boolean;
      reminderChannels?: ('in_app' | 'email' | 'sms')[];
    };

    // Validate settings
    if (
      body.daysBeforeDue &&
      (!Array.isArray(body.daysBeforeDue) ||
        body.daysBeforeDue.some((d) => typeof d !== 'number' || d < 0))
    ) {
      return NextResponse.json(
        { error: 'daysBeforeDue must be an array of non-negative numbers' },
        { status: 400 },
      );
    }

    if (
      body.daysAfterDue &&
      (!Array.isArray(body.daysAfterDue) ||
        body.daysAfterDue.some((d) => typeof d !== 'number' || d < 0))
    ) {
      return NextResponse.json(
        { error: 'daysAfterDue must be an array of non-negative numbers' },
        { status: 400 },
      );
    }

    if (
      body.reminderChannels &&
      (!Array.isArray(body.reminderChannels) ||
        !body.reminderChannels.every((c) => ['in_app', 'email', 'sms'].includes(c)))
    ) {
      return NextResponse.json(
        { error: 'reminderChannels must be an array containing only: in_app, email, sms' },
        { status: 400 },
      );
    }

    // Get existing organization
    const organization = await findOrganizationById(organizationId);
    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Update payment reminder settings
    const existingSettings = organization.paymentReminderSettings || {
      daysBeforeDue: [7, 3, 0],
      daysAfterDue: [3, 7, 14, 30],
      escalationEnabled: true,
      reminderChannels: ['in_app', 'email', 'sms'],
    };

    const updatedSettings = {
      daysBeforeDue: body.daysBeforeDue ?? existingSettings.daysBeforeDue,
      daysAfterDue: body.daysAfterDue ?? existingSettings.daysAfterDue,
      escalationEnabled: body.escalationEnabled ?? existingSettings.escalationEnabled,
      reminderChannels: body.reminderChannels ?? existingSettings.reminderChannels,
    };

    const updatedOrganization = await updateOrganization(organizationId, {
      paymentReminderSettings: updatedSettings,
    });

    if (!updatedOrganization) {
      return NextResponse.json({ error: 'Failed to update billing settings' }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Billing settings updated successfully',
      settings: updatedSettings,
    });
  } catch (error) {
    console.error('Update billing settings error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
    }
    return NextResponse.json(
      { error: 'Unexpected error while updating billing settings' },
      { status: 500 },
    );
  }
}

