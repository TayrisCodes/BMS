# Multi-Tenancy Model

## Overview

The BMS system uses a multi-tenant architecture where all data is scoped by `organizationId`. Each organization is isolated from others, and all queries must include organization filtering.

## Organization Context Resolution

The system uses **session-based organization resolution**. When a user logs in, their `organizationId` is stored in their JWT session token. This organizationId is automatically available in all API routes and server components.

### Usage

```typescript
import { resolveOrganizationFromSession } from '@/lib/organizations/resolver';

// In an API route or server component
const orgContext = await resolveOrganizationFromSession(true);
if (!orgContext) {
  // User not authenticated or no organization
  return;
}

const { organizationId, organization } = orgContext;
```

## Organization Scoping

All database queries must include `organizationId` to prevent cross-organization data access.

### Helper Functions

#### `withOrganizationScope()`

Creates a query filter that includes organizationId. Required for all non-SUPER_ADMIN users.

```typescript
import { withOrganizationScope } from '@/lib/organizations/scoping';
import { getAuthContextFromCookies } from '@/lib/auth/session';

const context = await getAuthContextFromCookies();
const query = withOrganizationScope(context, { status: 'active' });
// Result: { status: "active", organizationId: "..." }
```

#### `withOptionalOrganizationScope()`

Allows SUPER_ADMIN to query across organizations if needed.

```typescript
import { withOptionalOrganizationScope } from '@/lib/organizations/scoping';

const query = withOptionalOrganizationScope(context, {}, true);
// SUPER_ADMIN: {} (no org filter)
// Others: { organizationId: "..." }
```

#### `validateOrganizationAccess()`

Validates that a resource belongs to the user's organization.

```typescript
import { validateOrganizationAccess } from '@/lib/organizations/scoping';

validateOrganizationAccess(context, resource.organizationId);
// Throws error if access denied
```

## Core Entities with organizationId

The following entities already include `organizationId`:

- ✅ **users** - Users belong to an organization
- ✅ **tenants** - Tenants belong to an organization
- ✅ **organizations** - Organizations themselves (self-referential)

Future entities that should include `organizationId`:

- **buildings** - Buildings belong to an organization
- **units** - Units belong to buildings (which belong to orgs)
- **leases** - Leases belong to tenants (which belong to orgs)
- **invoices** - Invoices belong to leases/tenants (which belong to orgs)
- **payments** - Payments belong to invoices (which belong to orgs)
- **complaints** - Complaints belong to tenants/units (which belong to orgs)
- **workOrders** - Work orders belong to buildings (which belong to orgs)
- **assets** - Assets belong to buildings (which belong to orgs)
- **meters** - Meters belong to buildings/units (which belong to orgs)
- **parkingSpaces** - Parking spaces belong to buildings (which belong to orgs)
- **vehicles** - Vehicles belong to tenants (which belong to orgs)

## API Route Example

```typescript
import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { withOrganizationScope } from '@/lib/organizations/scoping';
import { getTenantsCollection } from '@/lib/tenants/tenants';

export async function GET() {
  const context = await getAuthContextFromCookies();
  if (!context) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const collection = await getTenantsCollection();
  const query = withOrganizationScope(context, { status: 'active' });
  const tenants = await collection.find(query).toArray();

  return NextResponse.json({ tenants });
}
```

## SUPER_ADMIN Behavior

Users with the `SUPER_ADMIN` role can:

- Access any organization's data (when explicitly allowed)
- Create and manage organizations
- Seed initial ORG_ADMIN users for organizations

For regular operations, even SUPER_ADMIN should use organization scoping unless cross-org access is explicitly needed.
