## Phase 2 – Authentication, Tenancy, and RBAC (Detailed Plan)

### Goals

- Implement secure authentication for staff and tenants.
- Introduce a clear multi-tenant model based on organizations.
- Enforce role-based access control (RBAC) across APIs and UI.

---

### Step 1 – Choose Auth Strategy and Set Up Basics

- Use custom auth with JWT + HttpOnly cookies (no NextAuth).
- Install packages:
  - `bcryptjs` (password hashing), `jose` (JWT helper).
- Define `users` collection (logical schema):
  - `_id`, `organizationId`, `phone`, `email`, `passwordHash`, `roles`, `status`, `createdAt`, `updatedAt`.
- Add indexes:
  - Unique on `phone` per `organizationId`.
  - Optional unique on `email` (sparse).

---

### Step 2 – Credential-based Auth (Email/Phone + Password)

- Seed or register initial `ORG_ADMIN` user.
- Create login API route (e.g. `app/api/auth/login/route.ts`):
  - Lookup user by phone/email.
  - Verify password hash.
  - On success, create session (NextAuth session or signed cookie/JWT).
- Build login UI (e.g. `app/login/page.tsx`):
  - Form: phone/email + password, validation, error display.
- Configure session handling and helper to access session user in APIs/server components.

---

### Step 3 – Tenant OTP Flow (Phone + One-Time Code)

- Create `otpCodes` collection:
  - `_id`, `phone`, `code`, `expiresAt`, `consumed`.
- Implement `request-otp` endpoint (e.g. `app/api/auth/request-otp/route.ts`):
  - Validate phone belongs to a tenant.
  - Generate numeric code, store with expiry.
  - In dev, return/log the code (mock SMS).
- Implement `verify-otp` endpoint:
  - Validate phone, code, expiry, `consumed`.
  - Mark as consumed and create tenant session.
- Build tenant login UI (e.g. `app/tenant/login/page.tsx`):
  - Step 1: enter phone → call `request-otp`.
  - Step 2: enter code → call `verify-otp` → redirect to tenant dashboard.

---

### Step 4 – Multi-Tenancy Model

- Define `organizations` collection:
  - `_id`, `name`, `code`, `contactInfo`, `settings`, `createdAt`, `updatedAt`.
  - Add unique index on `code` or subdomain if used.
- Ensure core entities include `organizationId`:
  - `buildings`, `units`, `tenants`, `leases`, `invoices`, `payments`, etc.
- Choose organization context method:
  - Subdomain, path prefix, or explicit org selection stored in session.
- Implement organization resolver (middleware/helper):
  - Derive `organizationId` from request.
  - Attach to request context/session.
- Update APIs to enforce org scoping:
  - All queries filter by `organizationId`.
  - No multi-tenant data access without org filter.

---

### Step 5 – Role-Based Access Control (RBAC)

- Enumerate roles:
  - Global SaaS role: `SUPER_ADMIN` (platform owner).
  - Org/tenant roles: `ORG_ADMIN`, `BUILDING_MANAGER`, `FACILITY_MANAGER`, `ACCOUNTANT`, `SECURITY`, `TECHNICIAN`, `TENANT`, `AUDITOR`.
- Superadmin (`SUPER_ADMIN`):
  - Manage `organizations` (create, update, deactivate).
  - Create/seed initial `ORG_ADMIN` users for each organization.
  - View cross-organization metrics and system health.
  - Bypass org scoping in RBAC (can act on any `organizationId`).
- Define permission matrix (documented in code or docs):
  - Per role, list allowed actions (manage buildings, view invoices, manage complaints, etc.).
- Choose storage model for role assignments:
  - Embedded in `users` as `roles` (array of role strings), interpreted in context of `organizationId`.
  - Later, if needed, move to separate `userRoles` collection: `userId`, `organizationId`, optional `buildingId`, `role`, `createdAt`.
- Seed dev data:
  - At least: one `SUPER_ADMIN`, one `ORG_ADMIN`, one `BUILDING_MANAGER`, one `TENANT`.
- Implement authorization helper (e.g. `lib/auth/authz.ts`):
  - `isSuperAdmin(context)`, `hasOrgRole(context, allowedRoles)`.
  - Uses session + `organizationId` (+ optional `buildingId`).
- Apply RBAC:
  - In API routes: early check → 403 on failure.
  - In UI: hide/disable restricted sections/actions.

---

### Step 6 – Middleware and Guards

- Implement shared function to fetch current user/session.
- Protect routes:
  - Admin/staff: `app/admin/**`, `app/org/**` (example).
  - Tenant portal: `app/tenant/**`.
- Redirect unauthenticated users to correct login page.
- Ensure tenant vs staff areas are clearly separated.

---

### Step 7 – Phase 2 Exit Criteria

- `ORG_ADMIN` logs in with password, sees admin area, only their org’s data.
- Tenant logs in with phone + OTP, sees only their own data and actions.
- All multi-tenant APIs enforce `organizationId` scoping.
- RBAC correctly blocks unauthorized actions and hides restricted UI elements.
