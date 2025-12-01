# Role-Based Access Control (RBAC)

## Overview

The BMS system implements a comprehensive RBAC system with role-based permissions. All access control is enforced at both the API level (server-side) and UI level (client-side).

## Roles

### Global SaaS Role

- **SUPER_ADMIN** - Platform owner with full system access

### Organization Roles

- **ORG_ADMIN** - Organization administrator with full org access
- **BUILDING_MANAGER** - Manages buildings and related operations
- **FACILITY_MANAGER** - Manages facility maintenance and operations
- **ACCOUNTANT** - Handles financial operations (invoices, payments)
- **SECURITY** - Manages security and access control
- **TECHNICIAN** - Performs maintenance work
- **TENANT** - Tenant portal access (own data only)
- **AUDITOR** - Read-only access for auditing

## Permission Matrix

See `src/lib/auth/permissions.ts` for the complete permission matrix. Each role has specific permissions for:

- Organizations
- Buildings
- Units
- Tenants
- Leases
- Invoices
- Payments
- Complaints
- Maintenance
- Assets
- Utilities
- Security
- Parking
- Reporting
- Users

## SUPER_ADMIN Capabilities

SUPER_ADMIN has special privileges:

- ✅ Manage organizations (create, update, deactivate)
- ✅ Create/seed initial ORG_ADMIN users for each organization
- ✅ View cross-organization metrics and system health
- ✅ Bypass org scoping in RBAC (can act on any `organizationId`)
- ✅ Has all permissions across all modules

## Storage Model

Role assignments are stored **embedded in the `users` collection** as a `roles` array. Roles are interpreted in the context of the user's `organizationId`.

Future enhancement: If needed, roles can be moved to a separate `userRoles` collection with:

- `userId`
- `organizationId`
- `buildingId` (optional, for building-level roles)
- `role`
- `createdAt`

## Server-Side RBAC (API Routes)

### Basic Role Check

```typescript
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requireRole } from '@/lib/auth/authz';

export async function GET() {
  const context = await getAuthContextFromCookies();
  if (!context) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Require specific role
  requireRole(context, ['ORG_ADMIN', 'BUILDING_MANAGER']);

  // ... rest of handler
}
```

### Permission Check

```typescript
import { requirePermission } from '@/lib/auth/authz';

export async function POST() {
  const context = await getAuthContextFromCookies();
  if (!context) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Require specific permission
  requirePermission(context, 'buildings', 'create');

  // ... rest of handler
}
```

### Conditional Permission Check

```typescript
import { hasPermission } from '@/lib/auth/authz';

export async function GET() {
  const context = await getAuthContextFromCookies();
  if (!context) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Check permission without throwing
  if (hasPermission(context, 'buildings', 'delete')) {
    // Allow delete operation
  }
}
```

## Client-Side RBAC (UI Components)

### Using Client-Side Helpers

```typescript
"use client";

import { useEffect, useState } from "react";
import { getUserInfo, hasPermission, hasRole } from "@/lib/auth/rbac-client";
import type { ClientUserInfo } from "@/lib/auth/rbac-client";

export default function BuildingsPage() {
  const [userInfo, setUserInfo] = useState<ClientUserInfo | null>(null);

  useEffect(() => {
    getUserInfo().then(setUserInfo);
  }, []);

  const canCreate = hasPermission(userInfo, "buildings", "create");
  const canDelete = hasPermission(userInfo, "buildings", "delete");
  const isAdmin = hasRole(userInfo, ["ORG_ADMIN"]);

  return (
    <div>
      {canCreate && <button>Create Building</button>}
      {canDelete && <button>Delete Building</button>}
      {isAdmin && <AdminPanel />}
    </div>
  );
}
```

### Conditional Rendering

```typescript
{hasPermission(userInfo, "invoices", "create") && (
  <Link href="/invoices/new">Create Invoice</Link>
)}

{hasRole(userInfo, ["ORG_ADMIN", "ACCOUNTANT"]) && (
  <FinancialReports />
)}
```

## Error Handling

RBAC functions throw errors that should be caught and converted to appropriate HTTP responses:

```typescript
try {
  requirePermission(context, 'buildings', 'create');
  // ... create building
} catch (error) {
  if (error instanceof Error) {
    if (error.message.includes('Access denied')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error.message.includes('Authentication required')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
  }
  throw error;
}
```

## Best Practices

1. **Always check authentication first** - Verify user is authenticated before checking permissions
2. **Use requirePermission/requireRole for critical operations** - Fail fast with clear error messages
3. **Combine with organization scoping** - Always use `withOrganizationScope()` when querying data
4. **Hide UI elements client-side** - Use client-side checks to hide/disable restricted actions
5. **Never trust client-side checks alone** - Always enforce RBAC server-side
6. **Document permission requirements** - Comment which permissions are required for each endpoint

## Seed Endpoints

Seed endpoints are available for development:

- `POST /api/auth/seed-super-admin` - Creates SUPER_ADMIN user
- `POST /api/auth/seed-org-admin` - Creates ORG_ADMIN user
- `POST /api/auth/seed-building-manager` - Creates BUILDING_MANAGER user
- `POST /api/auth/seed-tenant` - Creates TENANT (via tenant collection)

All seed endpoints are disabled in production.


