import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission, isSuperAdmin } from '@/lib/auth/authz';
import { validateOrganizationAccess } from '@/lib/organizations/scoping';
import { findUserByEmailOrPhone } from '@/lib/auth/users';
import { createInvitation } from '@/modules/users/invitation-service';
import { logActivitySafe } from '@/modules/users/activity-logger';
import type { UserRole } from '@/lib/auth/types';

/**
 * Simple CSV parser - parses CSV string into array of objects
 */
function parseCSV(csvText: string): Array<Record<string, string>> {
  const lines = csvText.trim().split('\n');
  if (lines.length === 0) return [];

  // Parse header
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));

  // Parse rows
  const rows: Array<Record<string, string>> = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Simple CSV parsing (handles quoted values)
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim()); // Add last value

    if (values.length === headers.length) {
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index]?.replace(/^"|"$/g, '') || '';
      });
      rows.push(row);
    }
  }

  return rows;
}

/**
 * POST /api/users/import
 * Import users from CSV file.
 * CSV format: name,email,phone,roles
 */
export async function POST(request: NextRequest) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Require permission to create users
    requirePermission(context, 'users', 'create');

    // Determine organizationId
    if (!context.organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }
    const organizationId = context.organizationId;

    // Validate organization access (unless SUPER_ADMIN)
    if (!isSuperAdmin(context)) {
      validateOrganizationAccess(context, organizationId);
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'CSV file is required' }, { status: 400 });
    }

    // Validate file type
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      return NextResponse.json({ error: 'File must be a CSV file' }, { status: 400 });
    }

    // Read file content
    const text = await file.text();

    // Parse CSV
    const rows = parseCSV(text);

    if (rows.length === 0) {
      return NextResponse.json({ error: 'CSV file is empty or invalid' }, { status: 400 });
    }

    // Validate required columns
    const requiredColumns = ['phone', 'roles'];
    const firstRow = rows[0];
    const missingColumns = requiredColumns.filter((col) => !(col in firstRow));

    if (missingColumns.length > 0) {
      return NextResponse.json(
        {
          error: `Missing required columns: ${missingColumns.join(', ')}`,
          expectedColumns: ['name', 'email', 'phone', 'roles'],
        },
        { status: 400 },
      );
    }

    // Validate role restrictions for ORG_ADMIN
    const restrictedRoles: UserRole[] = ['ORG_ADMIN', 'SUPER_ADMIN', 'TENANT'];

    // Process each row
    const results: Array<{
      row: number;
      identifier: string;
      success: boolean;
      userId?: string;
      error?: string;
    }> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2; // +2 because header is row 1, and arrays are 0-indexed
      const identifier = row.email || row.phone || `Row ${rowNumber}`;

      try {
        // Validate phone
        if (!row.phone || !row.phone.trim()) {
          results.push({
            row: rowNumber,
            identifier,
            success: false,
            error: 'Phone is required',
          });
          continue;
        }

        // Validate roles
        if (!row.roles || !row.roles.trim()) {
          results.push({
            row: rowNumber,
            identifier,
            success: false,
            error: 'Roles are required',
          });
          continue;
        }

        // Parse roles (comma-separated)
        const roles = row.roles
          .split(',')
          .map((r) => r.trim())
          .filter(Boolean) as UserRole[];

        if (roles.length === 0) {
          results.push({
            row: rowNumber,
            identifier,
            success: false,
            error: 'At least one role is required',
          });
          continue;
        }

        // Validate role restrictions for ORG_ADMIN
        if (!isSuperAdmin(context)) {
          const hasRestrictedRole = roles.some((role) => restrictedRoles.includes(role));
          if (hasRestrictedRole) {
            results.push({
              row: rowNumber,
              identifier,
              success: false,
              error:
                'Cannot assign ORG_ADMIN, SUPER_ADMIN, or TENANT roles. TENANT accounts must be created through the tenants page.',
            });
            continue;
          }
        }

        // Validate email format if provided
        if (row.email && row.email.trim()) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(row.email.trim())) {
            results.push({
              row: rowNumber,
              identifier,
              success: false,
              error: 'Invalid email format',
            });
            continue;
          }
        }

        // Check if user already exists
        const existingUser = await findUserByEmailOrPhone(row.phone.trim());
        if (existingUser && existingUser.organizationId === organizationId) {
          results.push({
            row: rowNumber,
            identifier,
            success: false,
            error: 'User with this phone number already exists',
          });
          continue;
        }

        if (row.email && row.email.trim()) {
          const existingByEmail = await findUserByEmailOrPhone(row.email.trim());
          if (existingByEmail) {
            results.push({
              row: rowNumber,
              identifier,
              success: false,
              error: 'User with this email already exists',
            });
            continue;
          }
        }

        // Create invitation (default to invite, not direct creation)
        const result = await createInvitation({
          organizationId,
          email: row.email?.trim() || null,
          phone: row.phone.trim(),
          roles,
          invitedBy: context.userId,
          name: row.name?.trim() || null,
        });

        // Log user invitation
        await logActivitySafe({
          userId: result.user._id.toString(),
          organizationId: result.user.organizationId,
          action: 'user_invited',
          details: {
            createdBy: context.userId,
            roles,
            email: row.email || null,
            phone: row.phone,
            importedFromCSV: true,
            csvRow: rowNumber,
          },
          request,
        });

        results.push({
          row: rowNumber,
          identifier,
          success: true,
          userId: result.user._id.toString(),
        });
      } catch (error) {
        console.error(`Failed to process row ${rowNumber}:`, error);
        results.push({
          row: rowNumber,
          identifier,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return NextResponse.json({
      total: rows.length,
      successful,
      failed,
      results,
    });
  } catch (error) {
    console.error('CSV import error:', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }
    return NextResponse.json({ error: 'Failed to import users' }, { status: 500 });
  }
}

