import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import type { UserRole } from '@/lib/auth/types';

export interface OnboardingTemplate {
  id: string;
  name: string;
  description: string;
  roles: UserRole[];
  isDefault: boolean;
}

const DEFAULT_TEMPLATES: OnboardingTemplate[] = [
  {
    id: 'building-manager',
    name: 'Building Manager',
    description: 'Manages a specific building: units, tenants, complaints, invoices',
    roles: ['BUILDING_MANAGER'],
    isDefault: true,
  },
  {
    id: 'facility-team',
    name: 'Facility Team',
    description: 'Facility manager and technician for maintenance operations',
    roles: ['FACILITY_MANAGER', 'TECHNICIAN'],
    isDefault: true,
  },
  {
    id: 'finance-team',
    name: 'Finance Team',
    description: 'Accountant for financial operations and reporting',
    roles: ['ACCOUNTANT'],
    isDefault: true,
  },
  {
    id: 'security-team',
    name: 'Security Team',
    description: 'Security personnel for visitor management and parking',
    roles: ['SECURITY'],
    isDefault: true,
  },
];

/**
 * GET /api/users/onboarding/templates
 * Get onboarding templates (default + custom).
 */
export async function GET(request: NextRequest) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get custom templates from database (stored per organization)
    const { getDb } = await import('@/lib/db');
    const db = await getDb();

    let customTemplates: OnboardingTemplate[] = [];
    if (context.organizationId) {
      const templates = await db
        .collection('onboardingTemplates')
        .find({
          organizationId: context.organizationId,
        })
        .toArray();

      customTemplates = templates.map((t: any) => ({
        id: t._id.toString(),
        name: t.name,
        description: t.description,
        roles: t.roles,
        isDefault: false,
      }));
    }

    // Combine default and custom templates
    const allTemplates = [...DEFAULT_TEMPLATES, ...customTemplates];

    return NextResponse.json({
      templates: allTemplates,
    });
  } catch (error) {
    console.error('Get templates error:', error);
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
  }
}

/**
 * POST /api/users/onboarding/templates
 * Create custom onboarding template.
 */
export async function POST(request: NextRequest) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!context.organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    const body = (await request.json()) as {
      name: string;
      description: string;
      roles: UserRole[];
    };

    // Validate
    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ error: 'Template name is required' }, { status: 400 });
    }

    if (!body.roles || !Array.isArray(body.roles) || body.roles.length === 0) {
      return NextResponse.json({ error: 'At least one role is required' }, { status: 400 });
    }

    // Validate role restrictions for ORG_ADMIN
    const { isSuperAdmin } = await import('@/lib/auth/authz');
    if (!isSuperAdmin(context)) {
      const restrictedRoles: UserRole[] = ['ORG_ADMIN', 'SUPER_ADMIN', 'TENANT'];
      const hasRestrictedRole = body.roles.some((role) => restrictedRoles.includes(role));

      if (hasRestrictedRole) {
        return NextResponse.json(
          {
            error: 'You cannot create templates with ORG_ADMIN, SUPER_ADMIN, or TENANT roles.',
          },
          { status: 403 },
        );
      }
    }

    // Save template
    const { getDb } = await import('@/lib/db');
    const db = await getDb();

    const template = {
      organizationId: context.organizationId,
      name: body.name.trim(),
      description: body.description?.trim() || '',
      roles: body.roles,
      createdBy: context.userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('onboardingTemplates').insertOne(template);

    return NextResponse.json(
      {
        template: {
          id: result.insertedId.toString(),
          name: template.name,
          description: template.description,
          roles: template.roles,
          isDefault: false,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Create template error:', error);
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
  }
}

