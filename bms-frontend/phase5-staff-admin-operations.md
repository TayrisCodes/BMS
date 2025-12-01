## Phase 5 – Staff/Admin Portals and Operations (Detailed Plan)

### Goals

- Complete admin/staff dashboards with role-based views and metrics.
- Implement complaint triage system for converting complaints to work orders.
- Build work order management system with CRUD APIs and technician mobile UI.
- Create utilities module for meter registration and readings with consumption calculations.
- Implement parking and security basics: parking spaces, vehicles, and visitor logs.

### Current State Analysis

**✅ Already Implemented:**

- Admin dashboard: `app/admin/page.tsx` with stats cards and tables (SUPER_ADMIN view).
- Org dashboard: `app/org/page.tsx` with portfolio metrics, charts, and lists.
- Building manager dashboard: `app/admin/buildings/[id]/dashboard/page.tsx` with building-specific metrics.
- Complaints management UI: `app/org/complaints/page.tsx` with filtering and stats.
- Complaints API: `/api/complaints` (GET, POST).
- Work orders API skeleton: `/api/work-orders/route.ts` (references `workOrders` collection).
- Dashboard layout: `DashboardLayout` with sidebar, topbar, and modular cards.
- Admin routes: buildings, units, tenants, leases management pages exist.

**❌ Needs Implementation:**

- Work orders collection (TypeScript interface, CRUD functions, indexes).
- Work orders CRUD APIs (complete implementation).
- Complaint triage UI (convert complaint to work order).
- Work order assignment and status management.
- Technician mobile UI for work orders.
- Meters collection and CRUD APIs.
- Meter readings collection and CRUD APIs.
- Utilities UI (meter registration, reading entry, consumption calculations).
- Parking spaces collection and APIs.
- Vehicles collection and APIs.
- Visitor logs collection and APIs.
- Security/guard UI for visitor logging.

---

### Step 1 – Complete Admin/Staff Dashboards

- **1.1 Enhance admin dashboard (SUPER_ADMIN)**
  - **1.1.1** Review `app/admin/page.tsx`:
    - Verify all API endpoints exist (`/api/organizations`, `/api/users`, `/api/dashboard/charts/revenue`).
    - Add error handling for missing APIs.
    - Ensure proper RBAC (only SUPER_ADMIN can access).
  - **1.1.2** Add missing API endpoints if needed:
    - `GET /api/organizations`: List organizations (SUPER_ADMIN only).
    - `GET /api/users`: List users (SUPER_ADMIN only).
    - `GET /api/dashboard/charts/revenue`: Revenue trends chart data.

- **1.2 Enhance org dashboard (ORG_ADMIN and other org roles)**
  - **1.2.1** Review `app/org/page.tsx`:
    - Verify all API endpoints exist (`/api/leases`, `/api/tenants`, `/api/complaints`, `/api/payments`, `/api/dashboard/charts/occupancy`, `/api/dashboard/charts/revenue`).
    - Add error handling for missing APIs.
    - Ensure proper org scoping.
  - **1.2.2** Add missing API endpoints if needed:
    - `GET /api/dashboard/charts/occupancy`: Occupancy trends chart data.
    - `GET /api/dashboard/charts/revenue`: Revenue trends chart data.

- **1.3 Enhance building manager dashboard**
  - **1.3.1** Review `app/admin/buildings/[id]/dashboard/page.tsx`:
    - Verify building-specific metrics are accurate.
    - Add work orders list (currently references API that may need completion).
    - Add building-specific complaints, invoices, and payments.
    - Ensure proper building-level scoping.

- **1.4 Role-based dashboard filtering**
  - **1.4.1** Ensure dashboards show only data user has permission to see:
    - `BUILDING_MANAGER`: Only their assigned building(s).
    - `FACILITY_MANAGER`: Buildings they manage, work orders, assets.
    - `ACCOUNTANT`: Financial data, invoices, payments.
    - `TECHNICIAN`: Only assigned work orders.
    - Use `requirePermission()` and `withOrganizationScope()` in APIs.

---

### Step 2 – Work Orders Collection and CRUD

- **2.1 Create work orders collection**
  - **2.1.1** Create `src/lib/work-orders/work-orders.ts`:
    - Define `WorkOrder` interface:
      ```typescript
      interface WorkOrder {
        _id: string;
        organizationId: string;
        buildingId: string; // ObjectId ref to buildings
        complaintId?: string | null; // ObjectId ref to complaints (optional)
        unitId?: string | null; // ObjectId ref to units (optional)
        assetId?: string | null; // ObjectId ref to assets (optional)
        title: string;
        description: string;
        category: 'plumbing' | 'electrical' | 'hvac' | 'cleaning' | 'security' | 'other';
        priority: 'low' | 'medium' | 'high' | 'urgent';
        status: 'open' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
        assignedTo?: string | null; // ObjectId ref to users (technician)
        estimatedCost?: number | null; // ETB
        actualCost?: number | null; // ETB
        completedAt?: Date | null;
        notes?: string | null;
        photos?: string[] | null; // URLs
        createdBy: string; // ObjectId ref to users
        createdAt: Date;
        updatedAt: Date;
      }
      ```
  - **2.1.2** Create collection getter: `getWorkOrdersCollection()`.
  - **2.1.3** Create indexes:
    - Compound index on `{ organizationId, buildingId, status }`.
    - Compound index on `{ organizationId, assignedTo, status }`.
    - Index on `complaintId` (sparse).
    - Index on `status`, `priority`.

- **2.2 CRUD functions**
  - **2.2.1** `createWorkOrder(input: CreateWorkOrderInput)`: Create new work order.
  - **2.2.2** `findWorkOrderById(workOrderId: string, organizationId?: string)`: Find by ID.
  - **2.2.3** `findWorkOrdersByBuilding(buildingId: string, organizationId?: string, filters?: Record<string, unknown>)`: List work orders for building.
  - **2.2.4** `findWorkOrdersByTechnician(technicianId: string, organizationId?: string, filters?: Record<string, unknown>)`: List work orders assigned to technician.
  - **2.2.5** `updateWorkOrderStatus(workOrderId: string, status: WorkOrder["status"], assignedTo?: string)`: Update status and assignment.
  - **2.2.6** `completeWorkOrder(workOrderId: string, actualCost?: number, notes?: string, photos?: string[])`: Mark as completed.

- **2.3 Complete work orders API**
  - **2.3.1** Update `app/api/work-orders/route.ts`:
    - `GET`: List work orders (query params: `buildingId`, `assignedTo`, `status`, `priority`, `category`).
      - If `assignedTo=me`, return work orders for current user (technician).
      - Use `withOrganizationScope()` for org filtering.
      - Use `requirePermission(context, "workOrders", "read")`.
    - `POST`: Create work order (requires `FACILITY_MANAGER`, `BUILDING_MANAGER`, or `ORG_ADMIN`).
  - **2.3.2** Create `app/api/work-orders/[id]/route.ts`:
    - `GET`: Get single work order.
    - `PATCH`: Update work order (status, assignment, notes, costs).
    - `DELETE`: Cancel work order (set status to cancelled).

---

### Step 3 – Complaint Triage UI

- **3.1 Create complaint detail page with triage**
  - **3.1.1** Review/update `app/org/complaints/[id]/page.tsx`:
    - Display complaint details: category, title, description, photos, status, tenant info, unit info.
    - Add "Create Work Order" button (for `FACILITY_MANAGER` or `BUILDING_MANAGER`).
    - Show linked work order if complaint was converted to work order.
  - **3.1.2** Create work order from complaint:
    - Pre-fill work order form with complaint data.
    - Link work order to complaint via `complaintId`.
    - Update complaint status to "assigned" when work order is created.

- **3.2 Create work order form**
  - **3.2.1** Create `app/org/work-orders/new/page.tsx`:
    - Form fields: title, description, category, priority, building, unit (optional), asset (optional), assignedTo (technician selection).
    - If created from complaint, pre-fill and link complaint.
    - Validation and error handling.

- **3.3 Work orders list page**
  - **3.3.1** Create `app/org/work-orders/page.tsx`:
    - List work orders with filters: status, priority, category, building, assignedTo.
    - Stats cards: total, open, in progress, completed.
    - Table with columns: title, category, priority, status, assignedTo, building, created date.
    - Click row to view detail.
    - "Create Work Order" button.

- **3.4 Work order detail page**
  - **3.4.1** Create `app/org/work-orders/[id]/page.tsx`:
    - Display work order details.
    - Show linked complaint (if any).
    - Show assignment info (technician).
    - Status timeline/updates.
    - Cost tracking (estimated vs actual).
    - Photos (if any).
    - Actions: Assign, Update Status, Complete, Cancel.
    - Notes section.

---

### Step 4 – Technician Mobile UI for Work Orders

- **4.1 Create technician work orders page**
  - **4.1.1** Create `app/technician/work-orders/page.tsx`:
    - Mobile-first design (similar to tenant portal).
    - List work orders assigned to current technician.
    - Filter by status: open, in progress, completed.
    - Simple card-based layout.
    - Tap to view details.

- **4.2 Work order detail for technician**
  - **4.2.1** Create `app/technician/work-orders/[id]/page.tsx`:
    - Mobile-friendly work order details.
    - Actions: Start Work, Update Status, Add Notes, Add Photos, Complete.
    - Status updates: open → in_progress → completed.
    - Photo upload capability.
    - Cost entry (actual cost).

- **4.3 Technician layout**
  - **4.3.1** Create `app/technician/layout.tsx`:
    - Use `TenantMobileLayout` or similar mobile layout.
    - Bottom navigation: Work Orders, Profile.
    - Guard: require `TECHNICIAN` role.

- **4.4 Work order status update API**
  - **4.4.1** Create `app/api/work-orders/[id]/status/route.ts`:
    - `PATCH`: Update work order status.
    - Validate status transitions (e.g., can't go from completed back to open).
    - If status is "completed", require `completedAt` timestamp.
    - If technician updates, verify they are assigned to the work order.

---

### Step 5 – Meters Collection and CRUD

- **5.1 Create meters collection**
  - **5.1.1** Create `src/lib/meters/meters.ts`:
    - Define `Meter` interface:
      ```typescript
      interface Meter {
        _id: string;
        organizationId: string;
        buildingId: string; // ObjectId ref to buildings
        unitId?: string | null; // ObjectId ref to units (optional, null for building-level meters)
        assetId?: string | null; // ObjectId ref to assets (optional)
        meterType: 'electricity' | 'water' | 'gas';
        meterNumber: string; // Unique per org
        unit: 'kwh' | 'cubic_meter' | 'liter';
        installationDate: Date;
        status: 'active' | 'inactive' | 'faulty';
        lastReading?: number | null;
        lastReadingDate?: Date | null;
        createdAt: Date;
        updatedAt: Date;
      }
      ```
  - **5.1.2** Create collection getter: `getMetersCollection()`.
  - **5.1.3** Create indexes:
    - Compound unique index on `{ organizationId, meterNumber }`.
    - Compound index on `{ organizationId, buildingId, meterType }`.
    - Index on `unitId` (sparse).

- **5.2 CRUD functions**
  - **5.2.1** `createMeter(input: CreateMeterInput)`: Create new meter.
  - **5.2.2** `findMeterById(meterId: string, organizationId?: string)`: Find by ID.
  - **5.2.3** `findMetersByBuilding(buildingId: string, organizationId?: string)`: List meters for building.
  - **5.2.4** `findMetersByUnit(unitId: string, organizationId?: string)`: List meters for unit.
  - **5.2.5** `updateMeter(meterId: string, updates: Partial<Meter>)`: Update meter.
  - **5.2.6** `deleteMeter(meterId: string)`: Soft delete (set status to inactive).

- **5.3 Meters API**
  - **5.3.1** Create `app/api/meters/route.ts`:
    - `GET`: List meters (query params: `buildingId`, `unitId`, `meterType`, `status`).
    - `POST`: Create meter (requires `FACILITY_MANAGER` or `ORG_ADMIN`).
  - **5.3.2** Create `app/api/meters/[id]/route.ts`:
    - `GET`: Get single meter.
    - `PATCH`: Update meter.
    - `DELETE`: Soft delete meter.

---

### Step 6 – Meter Readings Collection and CRUD

- **6.1 Create meter readings collection**
  - **6.1.1** Create `src/lib/meter-readings/meter-readings.ts`:
    - Define `MeterReading` interface:
      ```typescript
      interface MeterReading {
        _id: string;
        organizationId: string;
        meterId: string; // ObjectId ref to meters
        reading: number; // Reading value
        readingDate: Date; // Date of reading
        readBy?: string | null; // ObjectId ref to users
        source: 'manual' | 'iot' | 'import'; // How reading was entered
        notes?: string | null;
        createdAt: Date;
        updatedAt: Date;
      }
      ```
  - **6.1.2** Create collection getter: `getMeterReadingsCollection()`.
  - **6.1.3** Create indexes:
    - Compound index on `{ organizationId, meterId, readingDate }` (descending for latest).
    - Index on `readingDate`.

- **6.2 CRUD functions**
  - **6.2.1** `createMeterReading(input: CreateMeterReadingInput)`: Create new reading.
    - Validate reading is greater than last reading (or allow override for corrections).
    - Update meter's `lastReading` and `lastReadingDate`.
  - **6.2.2** `findMeterReadingsByMeter(meterId: string, organizationId?: string, limit?: number)`: List readings for meter (latest first).
  - **6.2.3** `calculateConsumption(meterId: string, startDate: Date, endDate: Date)`: Calculate consumption between two readings.
  - **6.2.4** `getLatestReading(meterId: string, organizationId?: string)`: Get most recent reading.

- **6.3 Meter readings API**
  - **6.3.1** Create `app/api/meter-readings/route.ts`:
    - `GET`: List meter readings (query params: `meterId`, `startDate`, `endDate`, `limit`).
    - `POST`: Create meter reading (requires `FACILITY_MANAGER`, `BUILDING_MANAGER`, or staff with permission).
  - **6.3.2** Create `app/api/meter-readings/[id]/route.ts`:
    - `GET`: Get single reading.
    - `PATCH`: Update reading (for corrections).
    - `DELETE`: Delete reading (with caution, may affect consumption calculations).

---

### Step 7 – Utilities UI (Meters and Readings)

- **7.1 Meters management UI**
  - **7.1.1** Create `app/org/meters/page.tsx`:
    - List meters with filters: building, unit, meter type, status.
    - Stats: total meters, active, inactive, faulty.
    - Table: meter number, type, building, unit, last reading, last reading date, status.
    - "Register Meter" button.
  - **7.1.2** Create `app/org/meters/new/page.tsx`:
    - Form: meter number, type, building, unit (optional), asset (optional), installation date.
    - Validation: unique meter number per org.
  - **7.1.3** Create `app/org/meters/[id]/page.tsx`:
    - Meter details.
    - Reading history (chart and table).
    - Consumption calculations (monthly, yearly).
    - "Add Reading" button.
    - Edit/delete actions.

- **7.2 Meter readings entry UI**
  - **7.2.1** Create `app/org/meters/[id]/readings/new/page.tsx`:
    - Form: reading value, reading date, notes.
    - Show last reading for reference.
    - Validation: reading should be >= last reading (or allow override).
  - **7.2.2** Bulk reading entry:
    - Create `app/org/meters/readings/bulk/page.tsx`:
      - Upload CSV or manual entry for multiple meters.
      - Validate all readings before submission.

- **7.3 Consumption calculations and alerts**
  - **7.3.1** Create consumption calculation service:
    - `src/modules/utilities/consumption.ts`:
      - `calculateMonthlyConsumption(meterId: string, year: number, month: number)`: Calculate consumption for a month.
      - `calculatePeriodConsumption(meterId: string, startDate: Date, endDate: Date)`: Calculate for a period.
      - `detectAnomalies(meterId: string, thresholdPercent: number)`: Detect unusual consumption spikes.
  - **7.3.2** Create consumption display:
    - In meter detail page, show consumption charts (monthly trends).
    - Show consumption vs previous period comparison.
  - **7.3.3** Threshold alerts (basic, notifications later):
    - Allow setting consumption thresholds per meter.
    - Display alerts when threshold exceeded (list view first).

---

### Step 8 – Parking Spaces Collection and APIs

- **8.1 Create parking spaces collection**
  - **8.1.1** Create `src/lib/parking/parking-spaces.ts`:
    - Define `ParkingSpace` interface:
      ```typescript
      interface ParkingSpace {
        _id: string;
        organizationId: string;
        buildingId: string; // ObjectId ref to buildings
        spaceNumber: string; // e.g., "P-001"
        spaceType: 'tenant' | 'visitor' | 'reserved';
        status: 'available' | 'occupied' | 'reserved' | 'maintenance';
        assignedTo?: string | null; // ObjectId ref to tenants (for tenant spaces)
        vehicleId?: string | null; // ObjectId ref to vehicles (if occupied)
        notes?: string | null;
        createdAt: Date;
        updatedAt: Date;
      }
      ```
  - **8.1.2** Create collection getter and indexes:
    - Compound unique index on `{ buildingId, spaceNumber }`.
    - Compound index on `{ organizationId, buildingId, status }`.
    - Index on `assignedTo` (sparse).

- **8.2 CRUD functions and API**
  - **8.2.1** Create CRUD functions: `createParkingSpace()`, `findParkingSpacesByBuilding()`, `updateParkingSpace()`, etc.
  - **8.2.2** Create `app/api/parking-spaces/route.ts`:
    - `GET`: List parking spaces (query params: `buildingId`, `spaceType`, `status`).
    - `POST`: Create parking space (requires `BUILDING_MANAGER` or `ORG_ADMIN`).
  - **8.2.3** Create `app/api/parking-spaces/[id]/route.ts`:
    - `GET`, `PATCH`, `DELETE` handlers.

---

### Step 9 – Vehicles Collection and APIs

- **9.1 Create vehicles collection**
  - **9.1.1** Create `src/lib/parking/vehicles.ts`:
    - Define `Vehicle` interface:
      ```typescript
      interface Vehicle {
        _id: string;
        organizationId: string;
        tenantId: string; // ObjectId ref to tenants
        plateNumber: string; // License plate
        make?: string | null; // e.g., "Toyota"
        model?: string | null; // e.g., "Corolla"
        color?: string | null;
        parkingSpaceId?: string | null; // ObjectId ref to parking spaces (current assignment)
        status: 'active' | 'inactive';
        notes?: string | null;
        createdAt: Date;
        updatedAt: Date;
      }
      ```
  - **9.1.2** Create collection getter and indexes:
    - Compound unique index on `{ organizationId, plateNumber }` (plate unique per org).
    - Compound index on `{ organizationId, tenantId }`.
    - Index on `parkingSpaceId` (sparse).

- **9.2 CRUD functions and API**
  - **9.2.1** Create CRUD functions: `createVehicle()`, `findVehiclesByTenant()`, `updateVehicle()`, etc.
  - **9.2.2** Create `app/api/vehicles/route.ts`:
    - `GET`: List vehicles (query params: `tenantId`, `parkingSpaceId`, `status`).
    - `POST`: Create vehicle (tenants can create their own, staff can create for tenants).
  - **9.2.3** Create `app/api/vehicles/[id]/route.ts`:
    - `GET`, `PATCH`, `DELETE` handlers.

---

### Step 10 – Visitor Logs Collection and APIs

- **10.1 Create visitor logs collection**
  - **10.1.1** Create `src/lib/security/visitor-logs.ts`:
    - Define `VisitorLog` interface:
      ```typescript
      interface VisitorLog {
        _id: string;
        organizationId: string;
        buildingId: string; // ObjectId ref to buildings
        visitorName: string;
        visitorPhone?: string | null;
        visitorIdNumber?: string | null; // Ethiopian ID
        hostTenantId: string; // ObjectId ref to tenants
        hostUnitId?: string | null; // ObjectId ref to units
        purpose: string; // Visit purpose
        vehiclePlateNumber?: string | null;
        parkingSpaceId?: string | null; // ObjectId ref to parking spaces
        entryTime: Date;
        exitTime?: Date | null;
        loggedBy: string; // ObjectId ref to users (guard/security)
        notes?: string | null;
        createdAt: Date;
        updatedAt: Date;
      }
      ```
  - **10.1.2** Create collection getter and indexes:
    - Compound index on `{ organizationId, buildingId, entryTime }` (descending for latest).
    - Index on `hostTenantId`.
    - Index on `entryTime`, `exitTime`.

- **10.2 CRUD functions and API**
  - **10.2.1** Create CRUD functions: `createVisitorLog()`, `findVisitorLogsByBuilding()`, `updateVisitorLogExit()`, etc.
  - **10.2.2** Create `app/api/visitor-logs/route.ts`:
    - `GET`: List visitor logs (query params: `buildingId`, `hostTenantId`, `startDate`, `endDate`, `status` (active/completed)).
    - `POST`: Create visitor log entry (requires `SECURITY` or `BUILDING_MANAGER`).
  - **10.2.3** Create `app/api/visitor-logs/[id]/route.ts`:
    - `GET`: Get single visitor log.
    - `PATCH`: Update exit time (log visitor departure).

---

### Step 11 – Parking & Security UI

- **11.1 Parking spaces management UI**
  - **11.1.1** Create `app/org/parking/spaces/page.tsx`:
    - List parking spaces with filters: building, type, status.
    - Stats: total spaces, available, occupied, reserved.
    - Table: space number, type, status, assigned to, vehicle.
    - "Add Parking Space" button.
  - **11.1.2** Create `app/org/parking/spaces/new/page.tsx`:
    - Form: space number, type, building.
    - Validation: unique space number per building.

- **11.2 Vehicles management UI**
  - **11.2.1** Create `app/org/parking/vehicles/page.tsx`:
    - List vehicles with filters: tenant, parking space, status.
    - Table: plate number, make/model, tenant, parking space, status.
    - "Register Vehicle" button.
  - **11.2.2** Create `app/org/parking/vehicles/new/page.tsx`:
    - Form: plate number, make, model, color, tenant selection, parking space assignment.
    - Validation: unique plate number per org.

- **11.3 Visitor logs UI (for guards)**
  - **11.3.1** Create `app/security/visitors/page.tsx`:
    - Mobile-friendly UI for guards.
    - List active visitors (not yet exited).
    - "Log Entry" button (prominent).
    - "Log Exit" action for each active visitor.
  - **11.3.2** Create `app/security/visitors/new/page.tsx`:
    - Mobile form for logging visitor entry:
      - Visitor name, phone, ID number (optional).
      - Host tenant selection (search/autocomplete).
      - Purpose.
      - Vehicle plate number (optional).
      - Parking space assignment (if vehicle).
    - Submit creates visitor log with current time as entry time.
  - **11.3.3** Create `app/security/visitors/[id]/exit/page.tsx`:
    - Simple page to log visitor exit.
    - Update visitor log with exit time.

- **11.4 Security layout**
  - **11.4.1** Create `app/security/layout.tsx`:
    - Use mobile layout (similar to technician).
    - Guard: require `SECURITY` role.
    - Bottom navigation: Visitors, Profile.

---

### Step 12 – Phase 5 Exit Criteria

- **12.1 Admin/Staff Dashboards**
  - ✅ Admin dashboard shows cross-org metrics (SUPER_ADMIN).
  - ✅ Org dashboard shows portfolio metrics with charts and lists.
  - ✅ Building manager dashboard shows building-specific metrics.
  - ✅ All dashboards respect RBAC and show only permitted data.

- **12.2 Work Orders**
  - ✅ Work orders collection with proper indexes and CRUD functions.
  - ✅ Work orders CRUD APIs with proper org scoping and RBAC.
  - ✅ Complaint triage UI allows converting complaints to work orders.
  - ✅ Work orders can be assigned to technicians.
  - ✅ Technicians can view and update assigned work orders via mobile UI.
  - ✅ Work order status transitions work correctly.

- **12.3 Utilities (Meters)**
  - ✅ Meters collection with proper indexes and CRUD functions.
  - ✅ Meter readings collection with proper indexes and CRUD functions.
  - ✅ Meters CRUD APIs and UI.
  - ✅ Meter readings entry UI.
  - ✅ Consumption calculations work correctly.
  - ✅ Basic threshold alerts (list view).

- **12.4 Parking & Security**
  - ✅ Parking spaces collection with CRUD APIs and UI.
  - ✅ Vehicles collection with CRUD APIs and UI.
  - ✅ Visitor logs collection with CRUD APIs.
  - ✅ Security/guard UI for logging visitor entries and exits.
  - ✅ All collections properly scoped by organization.

---

## Implementation Notes

- **Work Order Status Flow:**
  - `open` → `assigned` (when technician assigned).
  - `assigned` → `in_progress` (when technician starts work).
  - `in_progress` → `completed` (when work finished).
  - Any status → `cancelled` (if work order cancelled).

- **Meter Reading Validation:**
  - For most meters, new reading should be >= last reading.
  - Allow override for corrections (with notes).
  - Calculate consumption: `currentReading - previousReading`.

- **Parking Space Assignment:**
  - Tenant spaces: assigned to tenant, can be linked to vehicle.
  - Visitor spaces: assigned temporarily when visitor arrives.
  - Track occupancy status separately from assignment.

- **Visitor Log Workflow:**
  1. Guard logs entry: creates log with `entryTime`, no `exitTime`.
  2. Visitor is "active" until exit is logged.
  3. Guard logs exit: updates log with `exitTime`.
  4. Visitor is "completed".

- **Mobile UI Patterns:**
  - Use `TenantMobileLayout` or similar for technician and security UIs.
  - Large touch targets, simple navigation.
  - Optimize for quick data entry (work order updates, visitor logging).

- **RBAC Enforcement:**
  - `FACILITY_MANAGER`: Full access to work orders, meters, assets.
  - `BUILDING_MANAGER`: Building-level access, can create work orders from complaints.
  - `TECHNICIAN`: Only assigned work orders, can update status.
  - `SECURITY`: Visitor logs, parking operations.
  - Always use `requirePermission()` in APIs.

---

## Dependencies

- No new major dependencies required.
- Use existing UI components and patterns.
- Follow existing collection/API patterns from Phase 3.
