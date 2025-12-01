# Route Guards and Middleware

## Overview

The BMS system implements multi-layer route protection:

1. **Middleware** - Edge-level protection that runs before requests reach route handlers
2. **Layout Guards** - Server component guards at the layout level
3. **Route Guards** - Reusable guard functions for individual pages

## Middleware (`middleware.ts`)

The middleware runs on the Edge Runtime and provides first-line defense:

- ✅ Verifies session tokens before requests reach route handlers
- ✅ Redirects unauthenticated users to appropriate login pages
- ✅ Separates tenant vs staff areas
- ✅ Adds auth context to request headers for route handlers

### Protected Routes

- **Admin/Staff routes**: `/admin/**`, `/org/**`
  - Requires staff role (not TENANT)
  - Redirects to `/login` if not authenticated

- **Tenant routes**: `/tenant/**`
  - Requires TENANT role
  - Redirects to `/tenant/login` if not authenticated

### Public Routes

The following routes are public and don't require authentication:

- `/` (home page)
- `/login` (staff login)
- `/tenant/login` (tenant login)
- `/api/auth/login`
- `/api/auth/logout`
- `/api/auth/request-otp`
- `/api/auth/verify-otp`
- `/api/health`

## Layout Guards

Layout guards provide route-level protection using server components:

### Admin Layout (`app/admin/layout.tsx`)

```typescript
import { requireStaff } from "@/lib/auth/guards";

export default async function AdminLayout({ children }) {
  await requireStaff(); // Redirects if not staff
  return <>{children}</>;
}
```

All routes under `/admin/**` are automatically protected.

### Tenant Layout (`app/tenant/layout.tsx`)

```typescript
import { requireTenant } from "@/lib/auth/guards";

export default async function TenantLayout({ children }) {
  await requireTenant(); // Redirects if not tenant
  return <>{children}</>;
}
```

All routes under `/tenant/**` are automatically protected.

### Org Layout (`app/org/layout.tsx`)

```typescript
import { requireStaff } from "@/lib/auth/guards";

export default async function OrgLayout({ children }) {
  await requireStaff(); // Redirects if not staff
  return <>{children}</>;
}
```

All routes under `/org/**` are automatically protected.

## Route Guard Functions

Reusable guard functions in `src/lib/auth/guards.ts`:

### `getCurrentSession()`

Gets the current session without redirecting. Returns `null` if not authenticated.

```typescript
import { getCurrentSession } from '@/lib/auth/guards';

const context = await getCurrentSession();
if (!context) {
  // Not authenticated
}
```

### `requireAuth()`

Requires authentication. Redirects to `/login` if not authenticated.

```typescript
import { requireAuth } from '@/lib/auth/guards';

const context = await requireAuth();
// Guaranteed to have context here
```

### `requireRole(allowedRoles, redirectTo?)`

Requires specific role(s). Redirects if not authenticated or doesn't have role.

```typescript
import { requireRole } from '@/lib/auth/guards';

const context = await requireRole(['ORG_ADMIN', 'BUILDING_MANAGER']);
```

### `requireStaff()`

Requires staff role (not TENANT). Redirects tenants to tenant dashboard.

```typescript
import { requireStaff } from '@/lib/auth/guards';

const context = await requireStaff();
// Guaranteed to be staff (not tenant)
```

### `requireTenant()`

Requires tenant role. Redirects to `/tenant/login` if not authenticated or not a tenant.

```typescript
import { requireTenant } from '@/lib/auth/guards';

const context = await requireTenant();
// Guaranteed to be a tenant
```

### `requireSuperAdmin()`

Requires SUPER_ADMIN role. Redirects to `/login` if not authenticated or not SUPER_ADMIN.

```typescript
import { requireSuperAdmin } from '@/lib/auth/guards';

const context = await requireSuperAdmin();
// Guaranteed to be SUPER_ADMIN
```

## Redirect Logic

### Login Pages with Redirect

Both login pages support a `redirect` query parameter:

- **Staff login**: `/login?redirect=/admin/buildings`
- **Tenant login**: `/tenant/login?redirect=/tenant/invoices`

After successful login, users are redirected to the requested page.

### Automatic Redirects

- Unauthenticated users accessing `/admin/**` → `/login?redirect=/admin/...`
- Unauthenticated users accessing `/tenant/**` → `/tenant/login?redirect=/tenant/...`
- Tenants accessing `/admin/**` → `/tenant/dashboard`
- Staff accessing `/tenant/**` → `/login`

## Separation of Tenant vs Staff Areas

The system ensures clear separation:

1. **Middleware** checks roles and redirects tenants away from staff areas
2. **Layout guards** enforce role requirements at the layout level
3. **Route guards** provide fine-grained control in individual pages

### Tenant Access Rules

- ✅ Can access `/tenant/**` routes
- ❌ Cannot access `/admin/**` or `/org/**` routes (redirected to tenant dashboard)

### Staff Access Rules

- ✅ Can access `/admin/**` and `/org/**` routes
- ❌ Cannot access `/tenant/**` routes (redirected to staff login)

## Best Practices

1. **Use layout guards for route groups** - Protect entire route groups with layout guards
2. **Use route guards for fine-grained control** - Use `requireRole()` or `requirePermission()` in individual pages
3. **Always check authentication first** - Verify user is authenticated before checking roles/permissions
4. **Use middleware for edge protection** - Middleware provides fast, edge-level protection
5. **Handle redirects gracefully** - Login pages should redirect users back to their intended destination

## Example: Protected Page

```typescript
import { requireRole } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/authz";

export default async function BuildingsPage() {
  // Require staff role
  const context = await requireStaff();

  // Check specific permission
  const canCreate = hasPermission(context, "buildings", "create");

  return (
    <div>
      <h1>Buildings</h1>
      {canCreate && <button>Create Building</button>}
    </div>
  );
}
```

## Testing Route Protection

1. **Test unauthenticated access**:
   - Visit `/admin` without logging in → Should redirect to `/login`
   - Visit `/tenant/dashboard` without logging in → Should redirect to `/tenant/login`

2. **Test tenant access**:
   - Log in as tenant → Try accessing `/admin` → Should redirect to `/tenant/dashboard`

3. **Test staff access**:
   - Log in as staff → Try accessing `/tenant/dashboard` → Should redirect to `/login`

4. **Test redirect after login**:
   - Visit `/admin?redirect=/admin/buildings` → Login → Should redirect to `/admin/buildings`

