## Phase 3 – Core Domain Models and APIs (Detailed Plan)

### Goals

- Complete MongoDB collections for core BMS entities with proper indexes (following existing patterns).
- Build CRUD APIs for buildings, units, tenants, leases, invoices, and payments.
- Create admin UI for managing buildings, units, tenants, and leases.
- Implement invoice generation logic from leases with automated billing cycles.
- Add basic financial reporting endpoints.

### Current State Analysis

**✅ Already Implemented:**

- `organizations` collection: Full TypeScript interface, collection getter, indexes, CRUD functions (`src/lib/organizations/organizations.ts`).
- `users` collection: Full implementation with RBAC (`src/lib/auth/users.ts`).
- `tenants` collection: Partial - interface and collection getter exist, `findTenantByPhone` function (`src/lib/tenants/tenants.ts`).
- `otpCodes` collection: Full implementation for OTP flow (`src/lib/auth/otp.ts`).
- Organization scoping utilities: `withOrganizationScope()`, `validateOrganizationAccess()` (`src/lib/organizations/scoping.ts`).
- Auth system: JWT sessions, RBAC helpers, permission checks (`src/lib/auth/*`).
- Dashboard APIs: `/api/dashboard/stats` and `/api/dashboard/activity` reference collections that don't exist yet.

**❌ Needs Implementation:**

- Buildings, Units, Leases, Invoices, Payments, Complaints collections (interfaces, getters, indexes, CRUD).
- Complete CRUD for Tenants (currently only has `findTenantByPhone`).
- Full API routes for all entities (buildings route exists but is skeleton only).
- Invoice generation service.
- Financial reporting endpoints.

---

### Step 1 – Complete Tenants Collection (Enhance Existing)

- **1.1 Enhance Tenant interface**
  - **1.1.1** Update `src/lib/tenants/tenants.ts`:
    - Current interface has: `_id`, `organizationId`, `primaryPhone`, `email`, `nationalId`, `language`, `status`, `createdAt`, `updatedAt`.
    - Add missing fields: `firstName`, `lastName`, `emergencyContact` (object: name, phone), `notes` (string).
    - Update `language` to be enum type: `"am" | "en" | "om" | "ti" | null`.
    - Ensure `status` is: `"active" | "inactive" | "suspended"`.

- **1.2 Add indexes**
  - **1.2.1** Create `ensureTenantIndexes()` function:
    - Compound unique index on `{ organizationId, primaryPhone }` (phone unique per org).
    - Compound index on `{ organizationId, status }`.
    - Index on `primaryPhone` (for OTP lookup, sparse).
  - **1.2.2** Call `ensureTenantIndexes()` on app startup or in seed script.

- **1.3 Add CRUD functions**
  - **1.3.1** `createTenant(input: CreateTenantInput)`: Create new tenant.
  - **1.3.2** `findTenantById(tenantId: string, organizationId?: string)`: Find by ID with org validation.
  - **1.3.3** `updateTenant(tenantId: string, updates: Partial<Tenant>)`: Update tenant.
  - **1.3.4** `deleteTenant(tenantId: string)`: Soft delete (set status to inactive).
  - **1.3.5** `listTenants(query: Record<string, unknown>)`: List with filters.

- **1.4 Update API route**
  - **1.4.1** Enhance `app/api/tenants/route.ts`:
    - Add `POST` handler for creating tenants (requires `ORG_ADMIN`, `BUILDING_MANAGER`, or `ACCOUNTANT`).
    - Add `PATCH` and `DELETE` handlers (or create `[id]/route.ts` for individual operations).
    - Use `requirePermission()` from `@/lib/auth/authz`.
    - Use `withOrganizationScope()` for all queries.

---

### Step 2 – Buildings Collection

- **2.1 Create TypeScript interface**
  - **2.1.1** Create `src/lib/buildings/buildings.ts`:
    - Define `Building` interface:
      ```typescript
      interface Building {
        _id: string;
        organizationId: string;
        name: string;
        address?: {
          street?: string;
          city?: string;
          region?: string;
          postalCode?: string;
        } | null;
        buildingType: 'residential' | 'commercial' | 'mixed';
        totalFloors?: number | null;
        totalUnits?: number | null; // Computed or manual
        status: 'active' | 'under-construction' | 'inactive';
        managerId?: string | null; // ObjectId ref to users
        settings?: {
          parkingSpaces?: number;
          amenities?: string[];
          [key: string]: unknown;
        } | null;
        createdAt: Date;
        updatedAt: Date;
      }
      ```

- **2.2 Collection getter and indexes**
  - **2.2.1** Create `getBuildingsCollection()` function (following pattern from `organizations.ts`).
  - **2.2.2** Create `ensureBuildingIndexes()` function:
    - Compound index on `{ organizationId, status }`.
    - Index on `managerId` (sparse).
    - Index on `organizationId` (for general queries).

- **2.3 CRUD functions**
  - **2.3.1** `createBuilding(input: CreateBuildingInput)`: Create new building.
  - **2.3.2** `findBuildingById(buildingId: string, organizationId?: string)`: Find by ID.
  - **2.3.3** `findBuildingsByOrganization(organizationId: string, filters?: Record<string, unknown>)`: List buildings.
  - **2.3.4** `updateBuilding(buildingId: string, updates: Partial<Building>)`: Update building.
  - **2.3.5** `deleteBuilding(buildingId: string)`: Soft delete (set status to inactive, only if no active leases).

- **2.4 API routes**
  - **2.4.1** Complete `app/api/buildings/route.ts`:
    - Implement actual CRUD in `GET` and `POST` handlers (currently skeleton).
    - Use `requirePermission(context, "buildings", "read" | "create")`.
    - Use `withOrganizationScope()` for queries.
  - **2.4.2** Create `app/api/buildings/[id]/route.ts`:
    - `GET`: Get single building.
    - `PATCH`: Update building.
    - `DELETE`: Soft delete building.

---

### Step 3 – Units Collection

- **3.1 Create TypeScript interface**
  - **3.1.1** Create `src/lib/units/units.ts`:
    - Define `Unit` interface:
      ```typescript
      interface Unit {
        _id: string;
        organizationId: string;
        buildingId: string; // ObjectId ref to buildings
        unitNumber: string; // e.g., "A-101"
        floor?: number | null;
        unitType: 'apartment' | 'office' | 'shop' | 'warehouse' | 'parking';
        area?: number | null; // square meters
        bedrooms?: number | null;
        bathrooms?: number | null;
        status: 'available' | 'occupied' | 'maintenance' | 'reserved';
        rentAmount?: number | null; // base rent in ETB
        createdAt: Date;
        updatedAt: Date;
      }
      ```

- **3.2 Collection getter and indexes**
  - **3.2.1** Create `getUnitsCollection()` function.
  - **3.2.2** Create `ensureUnitIndexes()` function:
    - Compound unique index on `{ buildingId, unitNumber }` (unit number unique per building).
    - Compound index on `{ organizationId, buildingId, status }`.
    - Index on `buildingId`.
    - Index on `organizationId`.

- **3.3 CRUD functions**
  - **3.3.1** `createUnit(input: CreateUnitInput)`: Create new unit.
    - Validate `buildingId` belongs to same `organizationId`.
    - Validate `unitNumber` is unique within building.
  - **3.3.2** `findUnitById(unitId: string, organizationId?: string)`: Find by ID.
  - **3.3.3** `findUnitsByBuilding(buildingId: string, filters?: Record<string, unknown>)`: List units for a building.
  - **3.3.4** `updateUnit(unitId: string, updates: Partial<Unit>)`: Update unit.
  - **3.3.5** `deleteUnit(unitId: string)`: Soft delete (only if no active lease).

- **3.4 API routes**
  - **3.4.1** Create `app/api/units/route.ts`:
    - `GET`: List units (query params: `buildingId`, `status`, `unitType`).
    - `POST`: Create unit (requires `ORG_ADMIN` or `BUILDING_MANAGER`).
  - **3.4.2** Create `app/api/units/[id]/route.ts`:
    - `GET`: Get single unit.
    - `PATCH`: Update unit.
    - `DELETE`: Soft delete unit.

---

### Step 4 – Leases Collection

- **4.1 Create TypeScript interface**
  - **4.1.1** Create `src/lib/leases/leases.ts`:
    - Define `Lease` interface:
      ```typescript
      interface Lease {
        _id: string;
        organizationId: string;
        tenantId: string; // ObjectId ref to tenants
        unitId: string; // ObjectId ref to units
        startDate: Date;
        endDate?: Date | null; // null for month-to-month
        rentAmount: number; // ETB
        depositAmount?: number | null; // ETB
        billingCycle: 'monthly' | 'quarterly' | 'annually';
        dueDay: number; // 1-31, day of month
        additionalCharges?: Array<{
          name: string;
          amount: number;
          frequency: 'monthly' | 'quarterly' | 'annually' | 'one-time';
        }> | null;
        status: 'active' | 'expired' | 'terminated' | 'pending';
        terminationDate?: Date | null;
        terminationReason?: string | null;
        createdAt: Date;
        updatedAt: Date;
      }
      ```

- **4.2 Collection getter and indexes**
  - **4.2.1** Create `getLeasesCollection()` function.
  - **4.2.2** Create `ensureLeaseIndexes()` function:
    - Compound index on `{ organizationId, tenantId, status }`.
    - Compound index on `{ organizationId, unitId, status }`.
    - Index on `startDate` and `endDate` (for active lease queries).
    - Index on `status`.

- **4.3 CRUD functions**
  - **4.3.1** `createLease(input: CreateLeaseInput)`: Create new lease.
    - Validate unit is available (no active lease).
    - Validate tenant exists and belongs to same org.
    - Validate dates are valid.
    - On create: update unit status to "occupied".
  - **4.3.2** `findLeaseById(leaseId: string, organizationId?: string)`: Find by ID.
  - **4.3.3** `findLeasesByTenant(tenantId: string, organizationId?: string)`: List leases for tenant.
  - **4.3.4** `findLeasesByUnit(unitId: string, organizationId?: string)`: List leases for unit.
  - **4.3.5** `findActiveLeaseForUnit(unitId: string, organizationId?: string)`: Get current active lease.
  - **4.3.6** `updateLease(leaseId: string, updates: Partial<Lease>)`: Update lease.
  - **4.3.7** `terminateLease(leaseId: string, reason?: string)`: Terminate lease (set status, endDate, update unit status).

- **4.4 API routes**
  - **4.4.1** Create `app/api/leases/route.ts`:
    - `GET`: List leases (query params: `tenantId`, `unitId`, `buildingId`, `status`).
    - `POST`: Create lease (requires `ORG_ADMIN`, `BUILDING_MANAGER`, or `ACCOUNTANT`).
  - **4.4.2** Create `app/api/leases/[id]/route.ts`:
    - `GET`: Get single lease.
    - `PATCH`: Update lease.
    - `DELETE`: Terminate lease.

---

### Step 5 – Invoices Collection

- **5.1 Create TypeScript interface**
  - **5.1.1** Create `src/lib/invoices/invoices.ts`:
    - Define `Invoice` interface:
      ```typescript
      interface Invoice {
        _id: string;
        organizationId: string;
        leaseId: string; // ObjectId ref to leases
        tenantId: string; // ObjectId ref to tenants
        unitId: string; // ObjectId ref to units
        invoiceNumber: string; // Unique per org, e.g., "INV-2024-001"
        issueDate: Date;
        dueDate: Date;
        periodStart: Date;
        periodEnd: Date;
        items: Array<{
          description: string;
          amount: number;
          type: 'rent' | 'charge' | 'penalty' | 'deposit' | 'other';
        }>;
        subtotal: number;
        tax?: number | null;
        total: number;
        status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
        paidAt?: Date | null;
        notes?: string | null;
        createdAt: Date;
        updatedAt: Date;
      }
      ```

- **5.2 Collection getter and indexes**
  - **5.2.1** Create `getInvoicesCollection()` function.
  - **5.2.2** Create `ensureInvoiceIndexes()` function:
    - Compound unique index on `{ organizationId, invoiceNumber }`.
    - Compound index on `{ organizationId, tenantId, status }`.
    - Compound index on `{ organizationId, leaseId, status }`.
    - Index on `dueDate` (for overdue queries).
    - Index on `status`.

- **5.3 CRUD functions**
  - **5.3.1** `generateInvoiceNumber(organizationId: string)`: Generate unique invoice number (e.g., "INV-2024-001").
  - **5.3.2** `createInvoice(input: CreateInvoiceInput)`: Create new invoice.
  - **5.3.3** `findInvoiceById(invoiceId: string, organizationId?: string)`: Find by ID.
  - **5.3.4** `findInvoicesByTenant(tenantId: string, organizationId?: string, filters?: Record<string, unknown>)`: List invoices for tenant.
  - **5.3.5** `findInvoicesByLease(leaseId: string, organizationId?: string)`: List invoices for lease.
  - **5.3.6** `findOverdueInvoices(organizationId: string, asOfDate?: Date)`: Find overdue invoices.
  - **5.3.7** `updateInvoiceStatus(invoiceId: string, status: Invoice["status"], paidAt?: Date)`: Update invoice status.

- **5.4 API routes**
  - **5.4.1** Create `app/api/invoices/route.ts`:
    - `GET`: List invoices (query params: `tenantId`, `leaseId`, `unitId`, `buildingId`, `status`, `dueDateFrom`, `dueDateTo`).
    - `POST`: Manual invoice creation (requires `ORG_ADMIN` or `ACCOUNTANT`).
  - **5.4.2** Create `app/api/invoices/[id]/route.ts`:
    - `GET`: Get single invoice.
    - `PATCH`: Update invoice (draft invoices only, or mark as sent/paid).
    - `DELETE`: Cancel invoice (set status to cancelled, only if not paid).

---

### Step 6 – Payments Collection

- **6.1 Create TypeScript interface**
  - **6.1.1** Create `src/lib/payments/payments.ts`:
    - Define `Payment` interface:
      ```typescript
      interface Payment {
        _id: string;
        organizationId: string;
        invoiceId?: string | null; // ObjectId ref to invoices (optional for manual payments)
        tenantId: string; // ObjectId ref to tenants
        amount: number; // ETB
        paymentMethod:
          | 'cash'
          | 'bank_transfer'
          | 'telebirr'
          | 'cbe_birr'
          | 'chapa'
          | 'hellocash'
          | 'other';
        paymentDate: Date;
        referenceNumber?: string | null; // External payment reference (for idempotency)
        status: 'pending' | 'completed' | 'failed' | 'refunded';
        providerResponse?: Record<string, unknown> | null; // Payment gateway response data
        notes?: string | null;
        createdBy?: string | null; // ObjectId ref to users
        createdAt: Date;
        updatedAt: Date;
      }
      ```

- **6.2 Collection getter and indexes**
  - **6.2.1** Create `getPaymentsCollection()` function.
  - **6.2.2** Create `ensurePaymentIndexes()` function:
    - Compound index on `{ organizationId, tenantId, status }`.
    - Compound index on `{ organizationId, invoiceId }`.
    - Index on `paymentDate`.
    - Unique sparse index on `referenceNumber` (for idempotency checks).

- **6.3 CRUD functions**
  - **6.3.1** `createPayment(input: CreatePaymentInput)`: Create new payment.
    - If `invoiceId` provided, link payment and update invoice status to "paid".
    - Validate amount matches invoice total (or allow partial payments).
    - Check `referenceNumber` for idempotency (prevent duplicate payments).
  - **6.3.2** `findPaymentById(paymentId: string, organizationId?: string)`: Find by ID.
  - **6.3.3** `findPaymentsByTenant(tenantId: string, organizationId?: string, filters?: Record<string, unknown>)`: List payments for tenant.
  - **6.3.4** `findPaymentsByInvoice(invoiceId: string, organizationId?: string)`: List payments for invoice.
  - **6.3.5** `findPaymentByReference(referenceNumber: string, organizationId?: string)`: Find by reference (for webhook idempotency).

- **6.4 API routes**
  - **6.4.1** Create `app/api/payments/route.ts`:
    - `GET`: List payments (query params: `tenantId`, `invoiceId`, `status`, `paymentDateFrom`, `paymentDateTo`).
    - `POST`: Record payment (requires `ORG_ADMIN`, `ACCOUNTANT`, or `BUILDING_MANAGER`).
  - **6.4.2** Create `app/api/payments/[id]/route.ts`:
    - `GET`: Get single payment.
    - `PATCH`: Update payment (pending payments only).
    - `DELETE`: Refund/cancel payment (set status to refunded, update linked invoice if needed).

---

### Step 7 – Complaints Collection

- **7.1 Create TypeScript interface**
  - **7.1.1** Create `src/lib/complaints/complaints.ts`:
    - Define `Complaint` interface:
      ```typescript
      interface Complaint {
        _id: string;
        organizationId: string;
        tenantId: string; // ObjectId ref to tenants
        unitId?: string | null; // ObjectId ref to units (optional)
        category: 'maintenance' | 'noise' | 'security' | 'cleanliness' | 'other';
        title: string;
        description: string;
        photos?: string[] | null; // URLs or base64
        priority: 'low' | 'medium' | 'high' | 'urgent';
        status: 'open' | 'assigned' | 'in_progress' | 'resolved' | 'closed';
        assignedTo?: string | null; // ObjectId ref to users
        resolvedAt?: Date | null;
        resolutionNotes?: string | null;
        createdAt: Date;
        updatedAt: Date;
      }
      ```

- **7.2 Collection getter and indexes**
  - **7.2.1** Create `getComplaintsCollection()` function.
  - **7.2.2** Create `ensureComplaintIndexes()` function:
    - Compound index on `{ organizationId, tenantId, status }`.
    - Compound index on `{ organizationId, status, priority }`.
    - Index on `assignedTo`.

- **7.3 CRUD functions**
  - **7.3.1** `createComplaint(input: CreateComplaintInput)`: Create new complaint.
  - **7.3.2** `findComplaintById(complaintId: string, organizationId?: string)`: Find by ID.
  - **7.3.3** `findComplaintsByTenant(tenantId: string, organizationId?: string)`: List complaints for tenant.
  - **7.3.4** `findComplaintsByStatus(organizationId: string, status: Complaint["status"])`: List by status.
  - **7.3.5** `updateComplaintStatus(complaintId: string, status: Complaint["status"], assignedTo?: string)`: Update status and assignment.

- **7.4 API routes**
  - **7.4.1** Create `app/api/complaints/route.ts`:
    - `GET`: List complaints (query params: `tenantId`, `unitId`, `status`, `priority`).
    - `POST`: Create complaint (tenants can create, staff can create on behalf of tenant).
  - **7.4.2** Create `app/api/complaints/[id]/route.ts`:
    - `GET`: Get single complaint.
    - `PATCH`: Update complaint (status, assignment, resolution notes).

---

### Step 8 – Invoice Generation Service

- **8.1 Create invoice generation service**
  - **8.1.1** Create `src/modules/billing/invoice-generation.ts`:
    - Function: `generateInvoicesForLeases(organizationId: string, periodStart: Date, periodEnd: Date)`.
    - Logic:
      - Find all active leases for the organization.
      - For each lease, check if invoice already exists for the period.
      - Generate invoice with:
        - Base rent from lease.
        - Additional charges (filter by frequency matching billing cycle).
        - Calculate due date based on lease `dueDay`.
        - Set period dates based on billing cycle.
    - Handle edge cases:
      - Partial periods (lease starts mid-cycle).
      - Lease termination mid-cycle (prorate if needed).
      - Skip if invoice already exists for period.

- **8.2 Scheduled invoice generation**
  - **8.2.1** Create API route: `POST /api/billing/generate-invoices`:
    - Protected route (requires `ORG_ADMIN` or `ACCOUNTANT`).
    - Accepts optional `organizationId` (defaults to session org), `periodStart`, `periodEnd`.
    - Calls invoice generation service.
    - Returns count of invoices created.
  - **8.2.2** For MVP, manual trigger via API is acceptable.
    - Later: Use Next.js API route with cron trigger (e.g., Vercel Cron) or external scheduler.

- **8.3 Manual invoice creation**
  - **8.3.1** Enhance `POST /api/invoices`:
    - Accepts `leaseId`, `periodStart`, `periodEnd`, optional `items` override.
    - Creates single invoice for a specific lease.
    - Uses invoice generation logic for consistency.

---

### Step 9 – Financial Reporting Endpoints

- **9.1 Financial reports API**
  - **9.1.1** Create `app/api/reports/financial/route.ts`:
    - `GET` endpoint with query params: `organizationId` (defaults to session), `buildingId` (optional), `startDate`, `endDate`.
    - Returns:
      - Total revenue (sum of completed payments).
      - Outstanding receivables (sum of unpaid/overdue invoices).
      - Payment breakdown by method.
      - Monthly trends (optional, for charts).
    - Requires `ORG_ADMIN`, `ACCOUNTANT`, or `BUILDING_MANAGER` role.
    - Use `withOrganizationScope()` for queries.

- **9.2 Occupancy reports API**
  - **9.2.1** Create `app/api/reports/occupancy/route.ts`:
    - `GET` endpoint with query params: `organizationId`, `buildingId` (optional).
    - Returns:
      - Total units, occupied units, vacancy rate.
      - Occupancy by building (if org-level).
    - Same role requirements as financial reports.

- **9.3 Update dashboard stats API**
  - **9.3.1** Update `app/api/dashboard/stats/route.ts`:
    - Currently references collections that don't exist yet.
    - After implementing collections, verify all queries work correctly.
    - Ensure proper org scoping and error handling.

---

### Step 10 – Admin UI for Core Entities

- **10.1 Buildings Management UI**
  - **10.1.1** Create `app/admin/buildings/page.tsx`:
    - List view: name, address, type, total units, status, manager, actions.
    - Filter by status, search by name.
    - "Create Building" button.
  - **10.1.2** Create `app/admin/buildings/new/page.tsx`:
    - Form: name, address fields, building type, floors, manager selection, settings.
    - Validation.
  - **10.1.3** Create `app/admin/buildings/[id]/page.tsx`:
    - Building details, units list (sub-table or separate section), edit button.
  - **10.1.4** Create `app/admin/buildings/[id]/edit/page.tsx`:
    - Pre-populated form, update on submit.

- **10.2 Units Management UI**
  - **10.2.1** Create `app/admin/buildings/[id]/units/page.tsx`:
    - List units for a specific building: unit number, floor, type, area, status, current tenant (if occupied), actions.
    - Filter by status, unit type.
    - "Add Unit" button.
  - **10.2.2** Create `app/admin/buildings/[id]/units/new/page.tsx`:
    - Form: unit number, floor, type, area, bedrooms, bathrooms, base rent, status.
    - Validation (unique unit number within building).
  - **10.2.3** Create `app/admin/units/[id]/page.tsx`:
    - Unit details, current lease info (if occupied), edit/delete actions.

- **10.3 Tenants Management UI**
  - **10.3.1** Create `app/admin/tenants/page.tsx`:
    - List view: name, phone, email, preferred language, status, current unit (via lease), actions.
    - Search by name/phone, filter by status.
    - "Add Tenant" button.
  - **10.3.2** Create `app/admin/tenants/new/page.tsx`:
    - Form: name, phone, email, preferred language, ID number, emergency contact, notes.
    - Validation (phone uniqueness).
  - **10.3.3** Create `app/admin/tenants/[id]/page.tsx`:
    - Tenant info, current lease, payment history, complaints history, edit/delete actions.

- **10.4 Leases Management UI**
  - **10.4.1** Create `app/admin/leases/page.tsx`:
    - List view: tenant name, unit, start date, end date, rent amount, status, actions.
    - Filter by status, building, tenant.
    - "Create Lease" button.
  - **10.4.2** Create `app/admin/leases/new/page.tsx`:
    - Form: tenant selection (search/autocomplete), unit selection (filter by available units), dates, rent, deposit, billing cycle, due day, additional charges.
    - Validation: unit availability, date ranges.
  - **10.4.3** Create `app/admin/leases/[id]/page.tsx`:
    - Lease details, invoice history, terminate lease action, edit button.

- **10.5 Invoices & Payments UI**
  - **10.5.1** Create `app/admin/invoices/page.tsx`:
    - List view: invoice number, tenant, unit, issue date, due date, total, status, actions.
    - Filter by status, tenant, building, date range.
    - "Generate Invoices" button (calls generation API).
    - "Create Invoice" button (manual).
  - **10.5.2** Create `app/admin/payments/page.tsx`:
    - List view: payment date, tenant, amount, method, reference, status, linked invoice, actions.
    - Filter by tenant, date range, method.
    - "Record Payment" button.

---

### Step 11 – Update Dashboard Activity API

- **11.1 Fix dashboard activity API**
  - **11.1.1** Update `app/api/dashboard/activity/route.ts`:
    - Currently references `payments`, `leases`, `complaints` collections.
    - After implementing collections, update queries to use proper collection getters.
    - Ensure proper org scoping using `withOrganizationScope()`.
    - Add proper error handling and type safety.

---

### Step 12 – Index Initialization

- **12.1 Create index initialization script**
  - **12.1.1** Create `src/lib/db/ensure-indexes.ts`:
    - Import all `ensure*Indexes()` functions.
    - Create `ensureAllIndexes()` function that calls all index creation functions.
  - **12.1.2** Call `ensureAllIndexes()` on app startup or in a seed script.
  - **12.1.3** Alternatively, create API route `POST /api/admin/ensure-indexes` (SUPER_ADMIN only) for manual initialization.

---

### Step 13 – Phase 3 Exit Criteria

- **13.1 Collections and Models**
  - ✅ All core collections are defined with proper TypeScript interfaces.
  - ✅ All collections have proper indexes (unique, compound, sparse as needed).
  - ✅ All collections have collection getter functions following existing pattern.
  - ✅ All collections have CRUD functions (create, read, update, delete/soft delete).

- **13.2 APIs**
  - ✅ CRUD APIs work for buildings, units, tenants, leases, invoices, and payments.
  - ✅ All APIs enforce `organizationId` scoping using `withOrganizationScope()`.
  - ✅ All APIs enforce RBAC using `requirePermission()`.
  - ✅ Invoice generation service can create invoices from active leases.
  - ✅ Financial reporting endpoints return accurate data.
  - ✅ Dashboard stats and activity APIs work correctly with new collections.

- **13.3 UI**
  - ✅ Admin UI allows creating and managing buildings, units, tenants, and leases.
  - ✅ Admin UI allows viewing and managing invoices and payments.
  - ✅ All UI forms have proper validation and error handling.

- **13.4 Testing**
  - ✅ Can create a building, add units, create tenants, create leases, generate invoices, and record payments end-to-end.
  - ✅ Organization scoping prevents cross-org data access.
  - ✅ RBAC prevents unauthorized actions.

---

## Implementation Patterns to Follow

- **Collection Pattern**: Follow the pattern established in `src/lib/organizations/organizations.ts`:
  - Define TypeScript interface.
  - Create collection getter function.
  - Create `ensure*Indexes()` function.
  - Create CRUD functions with proper typing.
  - Export all functions and types.

- **API Route Pattern**: Follow the pattern in `app/api/tenants/route.ts`:
  - Get auth context using `getAuthContextFromCookies()`.
  - Check authentication (return 401 if not authenticated).
  - Use `requirePermission()` for RBAC checks.
  - Use `withOrganizationScope()` for all queries.
  - Proper error handling with try/catch.
  - Return proper HTTP status codes.

- **Organization Scoping**: Always use `withOrganizationScope()` for queries unless SUPER_ADMIN needs cross-org access (use `withOptionalOrganizationScope()` in that case).

- **Error Handling**: Always validate organization access using `validateOrganizationAccess()` when accessing resources by ID.
