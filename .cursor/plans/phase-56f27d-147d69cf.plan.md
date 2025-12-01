<!-- 147d69cf-c542-4603-8fa6-35084144da6f e266dde3-fc46-4e45-b2e9-08322a6a271c -->
# Phase 2 – Authentication, Tenancy, and RBAC

## Goals

- Implement secure authentication for staff and tenants.
- Introduce a clear multi-tenant model based on organizations.
- Enforce role-based access control (RBAC) across APIs and UI.

---

## Step 1 – Choose Auth Strategy and Set Up Basics

- Decide between NextAuth (Auth.js) or a custom auth implementation using JWT/cookies.
- Install required packages (e.g., `next-auth`, `bcryptjs`/`argon2`, JWT helper library).
- Create a `users` collection (logical schema) with:
- `_id`, `organizationId`, `phone`, `email`, `passwordHash`, `roles`, `status`, `createdAt`, `updatedAt`.
- Add MongoDB indexes:
- Unique on `phone` (per org or global).
- Optional unique on `email`.

---

## Step 2 – Credential-based Auth (Email/Phone + Password)

- Implement a registration/seed path for the initial `ORG_ADMIN` user (e.g., script or protected setup endpoint).
- Create login API route (e.g., `app/api/auth/login/route.ts`):
- Lookup user by phone/email.
- Verify password using secure hash.
- On success, establish session (NextAuth session or signed cookie/JWT).
- Build login UI page (e.g., `app/login/page.tsx`):
- Form with email/phone + password, errors, loading states.
- Configure session storage and middleware to attach session user to the request context.

---

## Step 3 – Tenant OTP Flow (Phone + One-Time Code)

- Create `otpCodes` collection (or in-memory store for dev):
- `_id`, `phone`, `code`, `expiresAt`, `consumed`.
- Implement `request-otp` endpoint (e.g., `app/api/auth/request-otp/route.ts`):
- Validate that phone belongs to a tenant user.
- Generate a short numeric code and store with expiry.
- In dev, return the code in the response or log it (mock SMS provider).
- Implement `verify-otp` endpoint:
- Check phone, code, expiry, and not `consumed`.
- Mark OTP as consumed and create a tenant session.
- Build tenant login UI (e.g., `app/tenant/login/page.tsx`):
- Step 1: input phone, call `request-otp`.
- Step 2: input code, call `verify-otp`, then redirect to tenant dashboard.

---

## Step 4 – Multi-Tenancy Model

- Define `organizations` collection:
- `_id`, `name`, `code`, `contactInfo`, `settings`, `createdAt`, `updatedAt`.
- Optional unique index on `code` or subdomain.
- Ensure all core domain entities include `organizationId` (e.g., `organizations`, `buildings`, `units`, `tenants`, `leases`, `invoices`, `payments`).
- Choose organization context method:
- Subdomain (`org1.bms.localhost`), or
- Path prefix (e.g., `/org/[orgId]/...`), or
- Explicit selection in UI (stored in session).
- Implement an organization resolver middleware (e.g., in `middleware.ts` or a shared helper):
- Derive `organizationId` from subdomain/path/session.
- Attach it to request context/session for use in APIs.
- Update API handlers to enforce org scoping:
- All reads/writes include `organizationId` filters.
- No queries without org filter for multi-tenant data.

---

## Step 5 – Role-Based Access Control (RBAC)

- Enumerate roles:
- `ORG_ADMIN`, `BUILDING_MANAGER`, `FACILITY_MANAGER`, `ACCOUNTANT`, `SECURITY`, `TECHNICIAN`, `TENANT`, `AUDITOR`.
- Define a simple permission matrix (document only, e.g. in `docs` or a TS file):
- For each role, list allowed actions (manage buildings, view invoices, manage complaints, etc.).
- Decide how to store role assignments:
- Either embed in `users` as `rolesByOrg` / `rolesByBuilding` arrays, or
- Create a `userRoles` collection with `userId`, `organizationId`, optional `buildingId`, `role`.
- Seed initial role assignments for dev:
- Admin user with `ORG_ADMIN`.
- A `BUILDING_MANAGER` and `TENANT` account.
- Implement an authorization helper (e.g., `lib/authz.ts`):
- Functions like `requireRole(allowedRoles, context)` or `canPerform(action, context)`.
- Use session info + `organizationId` (and optional `buildingId`).
- Apply RBAC checks in API routes and server components:
- Early in the handler, call the authz helper and return 403 if not allowed.
- Hide or disable UI actions based on user role.

---

## Step 6 – Middleware and Guards

- Implement a shared function to fetch the current user/session for server components and API routes.
- Add route protection for:
- Admin/staff areas (e.g., `app/admin/**`, `app/org/**`).
- Tenant portal (e.g., `app/tenant/**`).
- Redirect unauthenticated users to appropriate login pages.

---

## Step 7 – Phase 2 Exit Criteria

- `ORG_ADMIN` user can log in, see an authenticated admin page, and access only their organization data.
- A tenant can log in using phone + OTP and see their own tenant dashboard.
- All multi-tenant APIs enforce `organizationId` scoping.
- RBAC consistently blocks unauthorized actions and hides restricted UI for users without the right roles.

### To-dos

- [ ] Choose auth approach (NextAuth vs custom) and set up base user model and indexes.
- [ ] Implement credential-based login (API + UI) and session management for staff users.
- [ ] Implement tenant phone + OTP flow (request/verify endpoints and UI).
- [ ] Create organizations collection, add organizationId to domain models, and implement organization context resolver.
- [ ] Define roles and permission matrix, implement role assignment storage and seeding.
- [ ] Implement authorization helper and apply RBAC checks in APIs and protected UI routes.
- [ ] Implement middleware/guards to protect staff and tenant routes, redirecting unauthenticated users.