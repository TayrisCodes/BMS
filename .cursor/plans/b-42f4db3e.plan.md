<!-- 42f4db3e-8663-4dac-850d-341349744ca7 7c7f2512-fd82-4c5a-ba35-8b3dac34b1e1 -->
# SaaS BMS – Next.js + MongoDB Implementation Plan

## Overview

Build a multi-tenant SaaS BMS for the Ethiopian market using **Next.js** (web + API) and **MongoDB**, running locally via **Docker** (and Docker Compose), with a clear path to production hosting later.

The plan is organized into phases: platform foundation, core modules, tenant portal, operational modules, and hardening/integrations.

---

## Phase 1 – Project & Infrastructure Setup

1. **Repository and Project Scaffolding**

- Initialize a monorepo or single repo with a Next.js app (App Router, TypeScript, ESLint, Prettier).
- Define basic app layout, theming (light/dark), and global styles.

2. **Docker & MongoDB Setup**

- Create `docker-compose.yml` with services:
- `web`: Next.js app (dev & prod profiles).
- `mongo`: MongoDB database with persistent volume.
- Optional: `mongo-express` for debugging.
- Add environment configuration for DB connection (local vs prod).

3. **Base Architecture & Folder Structure**

- Establish directories:
- `app/` for routes (public site, tenant portal, admin portal).
- `app/api/` for REST APIs (App Router handlers).
- `lib/` for shared utilities (db client, auth helpers, config).
- `modules/` for domain modules (tenants, billing, maintenance, etc.).
- Implement a shared MongoDB connection utility with proper connection reuse.

---

## Phase 2 – Authentication, Tenancy, and RBAC (Detailed Plan)

4. **Authentication**

- **4.1 Choose auth approach**
- **4.1.1** Use custom auth with JWT + HttpOnly cookies (no NextAuth):
- Define session strategy around signed JWTs stored in HttpOnly cookies.
- Ensure JWT payload includes `userId`, `organizationId`, and roles.
- **4.1.2** Add required dependencies:
- `bcryptjs` or `argon2` for password hashing.
- A JWT/signing library such as `jose`.

- **4.2 User model and collection**
- **4.2.1** Create `users` collection schema (logical, not enforced by Mongo):
- Fields: `_id`, `organizationId`, `phone`, `email`, `passwordHash`, `roles`, `status`, `createdAt`, `updatedAt`.
- **4.2.2** Add indexes:
- Unique index on `{ organizationId, phone }` (per organization).
- Optional unique sparse index on `email` for uniqueness when present.

- **4.3 Credential-based login (email/phone + password)**
- **4.3.1** Implement registration endpoint or seed script for initial admin user.
- **4.3.2** Implement login endpoint/handler:
- Verify identifier (phone/email).
- Compare password using secure hash (`bcrypt` or `argon2`).
- On success, issue session (NextAuth session/JWT or custom cookie).
- **4.3.3** Add basic login page in the web app:
- Fields: phone/email, password.
- Show error messages for invalid credentials.

- **4.4 Tenant OTP (phone + one-time code)**
- **4.4.1** Define `otpCodes` collection or in-memory store for dev:
- Fields: `_id`, `phone`, `code`, `expiresAt`, `consumed`.
- **4.4.2** Implement endpoint to request OTP:
- Validate phone exists for a tenant user.
- Generate short numeric code (e.g., 4–6 digits).
- Store with expiry (e.g., 5–10 minutes).
- In dev, respond with the code in the API response or log it (mock SMS).
- **4.4.3** Implement endpoint to verify OTP:
- Check code, phone, expiry, and `consumed` flag.
- On success, mark OTP consumed and create tenant session.
- **4.4.4** Build simple tenant login UI:
- Screen 1: enter phone, tap "Send Code".
- Screen 2: enter received code, submit to complete login.

- **4.5 Session management and protection**
- **4.5.1** Configure session storage (JWT or database sessions).
- **4.5.2** Implement middleware/route guards:
- Protect authenticated routes and redirect unauthenticated users to login.
- Ensure sessions include `userId`, `organizationId`, and roles.

5. **Multi-Tenancy Model**

- **5.1 Organizations collection**
- **5.1.1** Introduce `organizations` collection:
- Fields: `_id`, `name`, `code`, `contactInfo`, `settings`, `createdAt`, `updatedAt`.
- **5.1.2** Add indexes:
- Optional unique index on `code` or subdomain.

- **5.2 Tenant scoping via organizationId**
- **5.2.1** Ensure domain models (`buildings`, `units`, `tenants`, `leases`, `invoices`, etc.) include `organizationId`.
- **5.2.2** Update any existing schema definitions/types to include `organizationId`.

- **5.3 Organization context resolution**
- **5.3.1** Decide how organization is selected:
- Subdomain-based (e.g., `org1.yourbms.com`).
- URL path prefix (e.g., `/org/[orgId]/...`).
- Header or selection in UI for multi-org admins.
- **5.3.2** Implement organization resolver middleware:
- Parse request (subdomain/path/header).
- Lookup organization and attach `organizationId` to request context/session.
- **5.3.3** Ensure all API handlers:
- Accept organization context from middleware.
- Filter queries by `organizationId` (no cross-org data leakage).

6. **Role-Based Access Control (RBAC)**

- **6.1 Define roles and permissions**
- **6.1.1** Enumerate roles:
- Global SaaS/platform role: `SUPER_ADMIN`.
- Org/tenant roles: `ORG_ADMIN`, `BUILDING_MANAGER`, `FACILITY_MANAGER`, `ACCOUNTANT`, `SECURITY`, `TECHNICIAN`, `TENANT`, `AUDITOR`.
- **6.1.2** Define permission matrix at a high level:
- For each role, list allowed operations (e.g., manage buildings, view invoices, manage complaints).
- `SUPER_ADMIN` can manage organizations (create/update/deactivate), seed `ORG_ADMIN` users, and see cross-organization metrics.

- **6.2 Role assignments**
- **6.2.1** Initial storage model:
- Embed roles directly in `users` documents as a `roles` array.
- Interpret roles in the context of `organizationId`, with `SUPER_ADMIN` treated as global.
- **6.2.2** Optional later model:
- Introduce a `userRoles` collection for more complex assignments:
- Fields: `userId`, `organizationId`, optional `buildingId`, `role`, `createdAt`.
- **6.2.3** Seed sample role assignments for dev:
- At least one `SUPER_ADMIN`, one `ORG_ADMIN` user, one `BUILDING_MANAGER`, and one `TENANT`.

- **6.3 Authorization helper**
- **6.3.1** Implement reusable authorization utilities (e.g., in `lib/auth/authz.ts`):
- Functions like `isSuperAdmin(context)`, `hasOrgRole(context, allowedRoles)`, and optionally `checkPermission(action, context)`.
- Takes session user, `organizationId`, optional `buildingId`.
- **6.3.2** Apply helper in API routes:
- Early in each handler, call the auth check.
- Return 403 or redirect on insufficient permissions.
- **6.3.3** Use RBAC helper in server components (if needed):
- Restrict UI sections and actions based on roles (e.g., hide admin menus for tenants).

- **6.4 Phase 2 exit criteria**
- **6.4.1** A user with `SUPER_ADMIN` can log in and perform cross-organization administration tasks (e.g., create organizations, seed org admins).
- **6.4.2** A user with `ORG_ADMIN` can log in, see an authenticated page, and access organization-scoped data.
- **6.4.3** A tenant can log in using phone + OTP and see only their tenant-specific views.
- **6.4.4** APIs enforce `organizationId` scoping and role-based authorization (no unauthorized cross-organization access).

---

## Phase 3 – Core Domain Models and APIs

7. **Domain Schemas in MongoDB**

- Design collections with indexes:
- `organizations`, `buildings`, `units`.
- `tenants`, `leases`.
- `invoices`, `payments`.
- `complaints`, `workOrders`, `assets`.
- `meters`, `meterReadings`.
- Implement TypeScript models/types for each entity.

8. **Building & Unit Management**

- CRUD APIs for organizations, buildings, and units.
- Admin UI for Org Admin/Building Manager to configure buildings and units.

9. **Tenant & Lease Management**

- APIs for:
- Creating tenants (with preferred language, contact info).
- Creating leases (unit, rent, charges, cycle, dates).
- Admin UI screens for listing and editing tenants/leases.
- Background job or scheduled endpoint for lease-based invoice generation.

10. **Billing & Invoicing**

- Implement invoice generation logic from leases.
- Expose APIs to list invoices by tenant/building, and to mark payments.
- Add basic financial reporting endpoints (per building, per org).

---

## Phase 4 – Tenant Portal (Web/PWA)

11. **Tenant Dashboard UI**

- Build tenant-facing routes under `app/tenant/` (or similar):
- Overview (current balance, next due date).
- Invoices & payments history.
- Lease details.

12. **Local Payment Initiation**

- Design payment initiation endpoint that creates a **payment intent** with provider metadata.
- For MVP, mock provider responses in dev; design interface to plug in Telebirr/CBE Birr/Chapa/HelloCash later.

13. **Complaints/Requests from Tenants**

- Tenant UI to submit complaints (category, description, photos).
- API to create complaints and assign to building/facility managers.
- Tenant UI to track complaint status.

14. **Multi-language Support**

- Integrate i18n solution (e.g., `next-intl` or custom) with Amharic, English, Afaan Oromo, Tigrigna.
- Externalize strings; support user-level language preferences on tenant side first.

---

## Phase 5 – Staff/Admin Portals and Operations

15. **Admin/Staff Dashboard**

- Under `app/admin/`, implement dashboards for:
- Org Admin: portfolio metrics, buildings list, configuration.
- Building Manager: building-level status (occupancy, arrears, complaints, work orders).

16. **Complaint Triage and Maintenance Work Orders**

- UI for Building/Facility Managers to triage complaints into work orders.
- Work-order CRUD APIs, status changes (open, in progress, resolved), assignment to technicians.
- Technician UI (mobile-friendly) for viewing assigned work orders and updating status.

17. **Basic Utilities Module**

- APIs and UI for registering meters and entering readings.
- Consumption calculations and simple threshold alerts (list view first, notifications later).

18. **Parking & Security Basics**

- Collections and APIs for parking spaces and vehicles.
- Simple visitor log entity and UI for guards (manual entry flow).

---

## Phase 6 – Integrations and Advanced Features

19. **Payment Provider Integrations (Telebirr, CBE Birr, Chapa, HelloCash)**

- Implement provider-specific adapters (separate files/modules) with:
- Payment initiation (creating references or redirect URLs).
- Webhook/callback handlers under `app/api/webhooks/...`.
- Ensure idempotent payment recording and secure signature verification.

20. **Notifications (Email/SMS/App)**

- Introduce a notification service module.
- Integrate basic email provider and one SMS provider local to Ethiopia.
- Wire up events: invoice created, payment due, complaint status changed.

21. **Reporting and Exports**

- Build admin UI for financial and operational reports.
- Generate CSV/PDF exports suitable for ERCA and auditors.

22. **IoT & Advanced Security Hooks (Later Phase)**

- Define data structures and API endpoints to receive meter/IoT events.
- Reserve endpoints/hooks for future QR/RFID access control and visitor QR flows.

---

## Phase 7 – Quality, Observability, and Deployment Readiness

23. **Testing & Quality Gates**

- Add unit tests for domain logic (e.g., invoice generation, RBAC guards).
- Add API tests for critical flows (auth, payments, complaints, work orders).

24. **Observability & Logging**

- Structured logging in API routes.
- Basic metrics (request rates, errors) and health checks.

25. **Security Hardening**

- Review authentication flows, password hashing, session handling.
- Validate all inputs, enforce strict org scoping on all queries.

26. **Production Deployment Plan**

- Define container images for web and database (or managed MongoDB in prod).
- Choose initial hosting (e.g., container-based platform or Vercel + managed MongoDB) and map environment variables.

---

This plan can be converted into an issue/sprint backlog. The early phases (1–4) should be prioritized to get a working MVP for a small number of pilot customers, then iterated forward into the more advanced modules and integrations.

### To-dos

- [ ] Scaffold Next.js (App Router, TS) project and set up MongoDB with Docker Compose for local development.
- [ ] Implement authentication, organization-based multi-tenancy, and role-based access control in Next.js APIs and middleware.
- [ ] Design MongoDB collections and implement core APIs for organizations, buildings, units, tenants, leases, invoices, and payments.
- [ ] Build tenant-facing Next.js routes for dashboard, invoices/payments, complaints, and multi-language support.
- [ ] Implement admin/staff dashboards for building management, complaints triage, work orders, meters, and basic parking/security flows.
- [ ] Integrate Telebirr, CBE Birr, Chapa, and HelloCash payment flows with webhook handling and idempotent payment recording.
- [ ] Add notifications (email/SMS/app) and build reporting/export features for finance and operations.
- [ ] Add tests, logging, security hardening, and define production deployment approach for the SaaS BMS.