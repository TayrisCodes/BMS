---
name: Maintenance Management Module
overview: Comprehensive Maintenance Management system with enhanced asset management, preventive maintenance scheduling, complaint-to-work-order conversion, technician portal enhancements, and asset reliability monitoring.
todos:
  - id: asset-model-enhancements
    content: Enhance Asset model with warranty tracking, improved depreciation, installation date, and supplier fields
    status: completed
  - id: maintenance-history-model
    content: Create MaintenanceHistory model and CRUD operations with API endpoints
    status: completed
  - id: asset-reliability-metrics
    content: Implement asset reliability calculation module (frequency, downtime, cost metrics)
    status: completed
    dependencies:
      - maintenance-history-model
  - id: enhanced-asset-ui
    content: Update asset UI pages to display warranty, maintenance history, and reliability metrics
    status: in_progress
    dependencies:
      - asset-model-enhancements
      - maintenance-history-model
      - asset-reliability-metrics
  - id: maintenance-task-model
    content: Create MaintenanceTask model with time-based and usage-based scheduling support
    status: completed
  - id: automatic-task-generation
    content: Implement automatic maintenance task generation and work order creation from tasks
    status: completed
    dependencies:
      - maintenance-task-model
  - id: preventive-maintenance-ui
    content: Create UI pages for maintenance task management (list, create, edit, view)
    status: pending
    dependencies:
      - maintenance-task-model
  - id: complaint-to-workorder-api
    content: Create API endpoint to convert complaints to work orders
    status: completed
  - id: complaint-to-workorder-ui
    content: Add complaint-to-work-order conversion UI in complaint detail page
    status: pending
    dependencies:
      - complaint-to-workorder-api
  - id: photo-upload-api
    content: Implement photo upload API endpoint for work orders
    status: completed
  - id: technician-portal-enhancements
    content: Enhance technician portal with photo upload, time tracking, asset details, and improved dashboard
    status: pending
    dependencies:
      - photo-upload-api
  - id: work-order-scheduling
    content: Add scheduling fields to work orders and implement calendar/scheduling views
    status: completed
  - id: reliability-dashboard
    content: Create asset reliability dashboard with metrics, trends, and filtering
    status: pending
    dependencies:
      - asset-reliability-metrics
  - id: work-order-completion-integration
    content: Integrate work order completion with maintenance history creation and asset updates
    status: completed
    dependencies:
      - maintenance-history-model
  - id: maintenance-cron-job
    content: Create cron job for automatic maintenance task generation and work order creation
    status: completed
    dependencies:
      - automatic-task-generation
---

# Maintenance Management Module Implementation Plan

## Overview

This plan implements a comprehensive Maintenance Management system building on existing work orders and assets infrastructure. The implementation includes enhanced asset management, preventive maintenance scheduling, complaint-to-work-order conversion, technician portal enhancements, and asset reliability monitoring.

## Current State Analysis

**Already Implemented:**

- Work order model with basic CRUD (`src/lib/work-orders/work-orders.ts`)
- Asset model with basic registry (`src/lib/assets/assets.ts`)
- Basic technician portal (`app/technician/work-orders/`)
- Work order status workflow (open, assigned, in_progress, completed, cancelled)
- Work order priority and category system
- Photo and notes support in work orders
- Asset linkage to units and buildings
- Basic maintenance schedule field in assets

**Gaps to Address:**

1. Asset warranty tracking
2. Maintenance history per asset (separate collection)
3. Preventive maintenance task system (separate model with automatic generation)
4. Complaint-to-work-order conversion API and UI
5. Photo upload functionality in technician portal
6. Work order scheduling/calendar
7. Asset reliability metrics (frequency, downtime, cost)
8. Usage-based maintenance schedules

## Implementation Tasks

### 1. Enhanced Asset Management

**1.1 Asset Model Enhancements**

- File: `src/lib/assets/assets.ts`
- Add warranty fields to Asset interface:
  ```typescript
  warranty?: {
    startDate?: Date | null;
    endDate?: Date | null;
    provider?: string | null;
    warrantyNumber?: string | null;
    terms?: string | null;
  } | null;
  ```

- Enhance depreciation tracking:
  - Add `depreciationStartDate` field
  - Add `depreciationMethod` validation
  - Add `accumulatedDepreciation` field
  - Add depreciation calculation utilities
- Add `installationDate` field
- Add `supplier` and `supplierContact` fields
- Update `ensureAssetIndexes` to add warranty and depreciation indexes

**1.2 Maintenance History Model**

- File: `src/lib/assets/maintenance-history.ts`
- Create MaintenanceHistory interface:
  ```typescript
  interface MaintenanceHistory {
    _id: string;
    organizationId: string;
    assetId: string;
    workOrderId?: string | null;
    maintenanceType: 'preventive' | 'corrective' | 'emergency';
    performedBy?: string | null; // Technician/user ID
    performedDate: Date;
    description: string;
    cost?: number | null;
    partsUsed?: Array<{ name: string; quantity: number; cost: number }> | null;
    downtimeHours?: number | null;
    notes?: string | null;
    nextMaintenanceDue?: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }
  ```

- Create CRUD functions: `createMaintenanceHistory`, `findMaintenanceHistoryByAsset`, `listMaintenanceHistory`
- Create collection and indexes
- API: `app/api/assets/[id]/maintenance-history/route.ts` (GET, POST)

**1.3 Asset Reliability Metrics**

- File: `src/modules/assets/reliability-metrics.ts`
- Calculate metrics:
  - Maintenance frequency (count per time period)
  - Total downtime hours
  - Total maintenance cost
  - Average cost per maintenance
  - Last maintenance date
  - Days since last maintenance
- Function: `calculateAssetReliability(assetId, organizationId, periodMonths)`
- API: `app/api/assets/[id]/reliability/route.ts` (GET)

**1.4 Enhanced Asset UI**

- Update: `app/org/assets/page.tsx` - Add warranty status column
- Update: `app/org/assets/[id]/page.tsx` - Display warranty info, maintenance history, reliability metrics
- New: `app/org/assets/new/page.tsx` - Enhanced form with warranty fields
- New: `app/org/assets/[id]/edit/page.tsx` - Edit asset with warranty

### 2. Preventive Maintenance System

**2.1 Maintenance Task Model**

- File: `src/lib/maintenance/maintenance-tasks.ts`
- Create MaintenanceTask interface:
  ```typescript
  interface MaintenanceTask {
    _id: string;
    organizationId: string;
    assetId: string;
    buildingId: string;
    taskName: string;
    description: string;
    scheduleType: 'time-based' | 'usage-based';
    frequency?: {
      interval: number; // days, hours, etc.
      unit: 'days' | 'weeks' | 'months' | 'hours' | 'usage_cycles';
    } | null;
    usageThreshold?: number | null; // For usage-based
    estimatedDuration?: number | null; // minutes
    estimatedCost?: number | null;
    assignedTo?: string | null; // Default technician
    lastPerformed?: Date | null;
    nextDueDate: Date;
    status: 'pending' | 'due' | 'overdue' | 'completed' | 'cancelled';
    autoGenerateWorkOrder: boolean;
    createdAt: Date;
    updatedAt: Date;
  }
  ```

- Create CRUD functions and collection
- API: `app/api/maintenance/tasks/route.ts` (GET, POST)
- API: `app/api/maintenance/tasks/[id]/route.ts` (GET, PUT, DELETE)

**2.2 Automatic Task Generation**

- File: `src/modules/maintenance/task-generator.ts`
- Function: `generateMaintenanceTasks(organizationId)`
  - Find assets with maintenance schedules
  - Create/update maintenance tasks based on schedule
  - Calculate next due dates
  - Mark tasks as due/overdue
- Function: `createWorkOrderFromTask(taskId, organizationId)`
  - Auto-create work order when task is due
- Cron: `app/api/cron/maintenance-tasks/route.ts`
  - Run daily to check for due tasks
  - Auto-generate work orders if enabled

**2.3 Preventive Maintenance UI**

- New: `app/org/maintenance/tasks/page.tsx` - List all maintenance tasks
- New: `app/org/maintenance/tasks/new/page.tsx` - Create maintenance task
- New: `app/org/maintenance/tasks/[id]/page.tsx` - View/edit task, generate work order
- Update: `app/org/assets/[id]/page.tsx` - Show linked maintenance tasks

### 3. Complaint-to-Work-Order Conversion

**3.1 Conversion API**

- File: `app/api/complaints/[id]/convert-to-work-order/route.ts` (POST)
- Function:
  - Validate complaint exists and is in valid state
  - Extract complaint details (category, urgency, description, photos)
  - Map complaint category to work order category
  - Create work order with complaint linked
  - Update complaint with `linkedWorkOrderId`
  - Update complaint status to 'assigned' or 'in_progress'
- Return created work order

**3.2 Conversion UI**

- Update: `app/org/complaints/[id]/page.tsx`
  - Add "Create Work Order" button for open/assigned complaints
  - Show linked work order if exists
  - Allow selecting building, priority, category, technician
- New: Dialog/modal for work order creation from complaint

### 4. Technician Portal Enhancements

**4.1 Photo Upload**

- File: `app/api/work-orders/[id]/photos/route.ts` (POST)
  - Accept multipart/form-data
  - Upload photos to storage (GridFS or cloud storage)
  - Update work order with photo URLs
  - Return updated work order
- Update: `app/technician/work-orders/[id]/page.tsx`
  - Add photo upload button/input
  - Display uploaded photos
  - Allow removing photos

**4.2 Enhanced Work Order Updates**

- Update: `app/technician/work-orders/[id]/page.tsx`
  - Add time tracking (start time, completion time)
  - Display asset details if linked
  - Show asset maintenance history
  - Add "View Asset" link
  - Enhanced notes with timestamps

**4.3 Technician Dashboard**

- Update: `app/technician/page.tsx` or create new dashboard
  - Show assigned work orders summary
  - Show overdue tasks
  - Show today's schedule
  - Quick actions (start work, complete, add notes)

**4.4 Work Order Scheduling**

- Add `scheduledDate` and `scheduledTimeWindow` to WorkOrder model
- Update: `app/technician/work-orders/page.tsx`
  - Calendar view option
  - Filter by scheduled date
  - Show scheduled vs unscheduled work orders

### 5. Asset Reliability Monitoring

**5.1 Reliability Calculation**

- File: `src/modules/assets/reliability-metrics.ts`
- Functions:
  - `calculateMaintenanceFrequency(assetId, periodMonths)`
  - `calculateTotalDowntime(assetId, periodMonths)`
  - `calculateTotalMaintenanceCost(assetId, periodMonths)`
  - `getAssetReliabilityScore(assetId)` - Composite score
- Use maintenance history data

**5.2 Reliability Dashboard**

- New: `app/org/assets/reliability/page.tsx`
  - List assets with reliability metrics
  - Filter by asset type, building
  - Sort by reliability score
  - Show trends over time
  - Export reliability report

**5.3 Asset Detail Reliability View**

- Update: `app/org/assets/[id]/page.tsx`
  - Add reliability metrics section
  - Show maintenance frequency chart
  - Show cost trends
  - Show downtime history

### 6. Data Model Updates

**6.1 Asset Model Updates**

- File: `src/lib/assets/assets.ts`
- Add fields:
  - `warranty` object (startDate, endDate, provider, warrantyNumber, terms)
  - `installationDate?: Date | null`
  - `supplier?: string | null`
  - `supplierContact?: string | null`
  - `depreciationStartDate?: Date | null`
  - `accumulatedDepreciation?: number | null`
- Update `createAsset` and `updateAsset` to handle new fields

**6.2 Work Order Model Updates**

- File: `src/lib/work-orders/work-orders.ts`
- Add fields:
  - `scheduledDate?: Date | null`
  - `scheduledTimeWindow?: { start: Date; end: Date } | null`
  - `startedAt?: Date | null` // When technician started work
  - `completedAt` already exists
- Update indexes for scheduling queries

### 7. Integration Points

**7.1 Work Order Completion Integration**

- When work order is completed, automatically create maintenance history entry
- Update asset's last maintenance date
- Calculate next maintenance due date if preventive
- Update maintenance task status if linked
- File: Update `completeWorkOrder` function in `src/lib/work-orders/work-orders.ts`
- File: Create integration function in `src/modules/maintenance/work-order-integration.ts`

**7.2 Asset Maintenance Schedule Sync**

- When asset maintenance schedule is updated, regenerate related maintenance tasks
- When maintenance task is completed, update asset's maintenance schedule dates
- File: Update `updateAsset` function in `src/lib/assets/assets.ts` to trigger task regeneration
- File: Update maintenance task completion to sync with asset schedule

**7.3 Notification Integration**

- Notify technicians when work orders are assigned
- Notify facility managers when maintenance tasks are due/overdue
- Notify tenants when work orders are completed (if linked to complaint)
- File: Update notification service in `src/modules/notifications/events.ts`
- Add notification triggers in work order assignment and task due date checks

### 8. Testing Considerations

- Test maintenance task generation with various schedule types (daily, weekly, monthly, usage-based)
- Test complaint-to-work-order conversion with different complaint types and categories
- Test photo upload and storage (GridFS or cloud storage)
- Test reliability calculations with various maintenance history scenarios
- Test automatic work order generation from maintenance tasks
- Test warranty expiration alerts and notifications
- Test depreciation calculations with different methods
- Test scheduling conflicts and technician assignment

### 9. File Structure Summary

**New Files to Create:**

- `src/lib/assets/maintenance-history.ts` - Maintenance history model
- `src/lib/maintenance/maintenance-tasks.ts` - Maintenance task model
- `src/modules/assets/reliability-metrics.ts` - Reliability calculations
- `src/modules/maintenance/task-generator.ts` - Automatic task generation
- `src/modules/maintenance/work-order-integration.ts` - Work order integration logic
- `app/api/assets/[id]/maintenance-history/route.ts` - Maintenance history API
- `app/api/assets/[id]/reliability/route.ts` - Reliability metrics API
- `app/api/maintenance/tasks/route.ts` - Maintenance tasks list/create API
- `app/api/maintenance/tasks/[id]/route.ts` - Maintenance task detail/update API
- `app/api/complaints/[id]/convert-to-work-order/route.ts` - Complaint conversion API
- `app/api/work-orders/[id]/photos/route.ts` - Photo upload API
- `app/api/cron/maintenance-tasks/route.ts` - Maintenance task cron job
- `app/org/assets/new/page.tsx` - Enhanced asset creation form
- `app/org/assets/[id]/edit/page.tsx` - Asset edit form
- `app/org/maintenance/tasks/page.tsx` - Maintenance tasks list
- `app/org/maintenance/tasks/new/page.tsx` - Create maintenance task
- `app/org/maintenance/tasks/[id]/page.tsx` - Maintenance task detail/edit
- `app/org/assets/reliability/page.tsx` - Asset reliability dashboard

**Files to Update:**

- `src/lib/assets/assets.ts` - Add warranty, depreciation, supplier fields
- `src/lib/work-orders/work-orders.ts` - Add scheduling fields
- `app/org/assets/page.tsx` - Add warranty status column
- `app/org/assets/[id]/page.tsx` - Display warranty, history, reliability
- `app/org/complaints/[id]/page.tsx` - Add work order conversion UI
- `app/technician/work-orders/[id]/page.tsx` - Add photo upload, asset details
- `app/technician/work-orders/page.tsx` - Add calendar view, scheduling
- `app/technician/page.tsx` - Enhanced dashboard

### 10. Future Enhancements (Out of Scope)

- Predictive maintenance using IoT data
- Spare parts inventory management
- Advanced scheduling with technician availability and skill matching
- Mobile app for technicians with offline support
- QR code scanning for asset identification
- Maintenance cost forecasting
- Asset lifecycle management (procurement to disposal)
- Integration with external maintenance service providers