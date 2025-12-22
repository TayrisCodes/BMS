---
name: ""
overview: ""
todos: []
---

# Parking & Vehicle Management Enhancement Plan

## Overview

This plan enhances the existing parking infrastructure with real-time tracking, violation management, vehicle history, and comprehensive reporting. The system already has core models for parking spaces, vehicles, assignments, and pricing. This plan adds the missing operational and analytical features.

## Current State

**Existing Infrastructure:**

- `src/lib/parking/parking-spaces.ts` - Parking space CRUD with types (tenant/visitor/reserved) and status
- `src/lib/parking/vehicles.ts` - Vehicle registration linked to tenants
- `src/lib/parking/parking-assignments.ts` - Assignment tracking with billing periods
- `src/lib/parking/parking-pricing.ts` - Pricing models for different space types
- Basic UI pages at `/org/parking/*` for space, vehicle, and assignment management
- API endpoints for CRUD operations

**Missing Features:**

- Real-time availability tracking and updates
- Violation logging system
- Vehicle history and movement tracking
- Visitor vehicle temporary registration
- Entry/exit logging with timestamps
- Parking duration tracking
- Utilization reports and analytics

## Implementation Plan

### 1. Parking Violations System

**1.1 Data Model** - `src/lib/parking/parking-violations.ts`

- Create `ParkingViolation` interface with:
- Violation types: `unauthorized_parking`, `expired_permit`, `wrong_space`, `overtime_parking`, `no_permit`
- Severity levels: `warning`, `fine`, `tow`
- Links to parking space, vehicle (if known), tenant (if applicable)
- Photo attachments, notes, fine amount
- Status: `reported`, `resolved`, `appealed`
- Reported by (security staff), resolved by, resolution notes

**1.2 API Endpoints**

- `POST /api/parking/violations` - Create violation report
- `GET /api/parking/violations` - List violations with filters (building, status, type, date range)
- `GET /api/parking/violations/[id]` - Get violation details
- `PUT /api/parking/violations/[id]` - Update violation (resolve, add notes)
- `POST /api/parking/violations/[id]/photos` - Upload violation photos

**1.3 UI Components**

- `/org/parking/violations/page.tsx` - Violations list with filters
- `/org/parking/violations/new/page.tsx` - Report new violation
- `/org/parking/violations/[id]/page.tsx` - Violation detail view
- Security mobile page: `/security/parking/violations/page.tsx` - Quick violation reporting

### 2. Vehicle History & Tracking

**2.1 Enhance Vehicle Model** - `src/lib/parking/vehicles.ts`

- Add `vehicleHistory` array to track:
- Assignment changes
- Parking space movements
- Status changes
- Entry/exit events

**2.2 Vehicle Movement Log** - `src/lib/parking/vehicle-movements.ts`

- Create `VehicleMovement` interface:
- Vehicle ID, parking space ID (from/to)
- Movement type: `entry`, `exit`, `reassignment`
- Timestamp, logged by (user ID)
- Assignment ID reference
- Notes

**2.3 API Endpoints**

- `GET /api/vehicles/[id]/history` - Get vehicle movement history
- `GET /api/vehicles/[id]/movements` - Get detailed movement log
- `POST /api/vehicles/[id]/log-movement` - Log entry/exit or reassignment

**2.4 UI Components**

- Enhance `/org/parking/vehicles/[id]/page.tsx` - Add history tab showing movements
- Add vehicle timeline visualization

### 3. Visitor Vehicle Temporary Registration

**3.1 Enhance Vehicle Model**

- Add `isTemporary` boolean flag
- Add `visitorLogId` optional reference for temporary vehicles
- Add `expiresAt` date for temporary registrations

**3.2 API Endpoints**

- `POST /api/vehicles/temporary` - Create temporary vehicle for visitor
- Auto-links to visitor log
- Sets expiration (default: end of day or visitor exit)
- `PUT /api/vehicles/[id]/extend` - Extend temporary vehicle registration

**3.3 UI Components**

- Enhance visitor parking assignment flow to include temporary vehicle registration
- Add temporary vehicle badge/indicator in vehicle lists

### 4. Entry/Exit Logging System

**4.1 Entry/Exit Log Model** - `src/lib/parking/parking-logs.ts`

- Create `ParkingLog` interface:
- Vehicle ID, parking space ID
- Log type: `entry`, `exit`
- Timestamp (manual or automatic)
- Logged by (user ID for manual, system for automatic)
- Assignment ID reference
- Duration (calculated on exit)
- Notes, photos

**4.2 Automatic Logging**

- Enhance `createParkingAssignment` to auto-create entry log
- Enhance `endParkingAssignment` to auto-create exit log with duration
- Add cron job or event handler to detect overdue assignments and log violations

**4.3 Manual Logging API**

- `POST /api/parking/logs/entry` - Manual entry log
- `POST /api/parking/logs/exit` - Manual exit log
- `GET /api/parking/logs` - List logs with filters

**4.4 UI Components**

- `/org/parking/logs/page.tsx` - Entry/exit log viewer
- Security mobile: `/security/parking/log-entry/page.tsx` - Quick entry/exit logging
- Add entry/exit buttons to parking space detail view

### 5. Real-Time Availability Tracking

**5.1 Availability Service** - `src/modules/parking/availability.ts`

- Function to calculate real-time availability:
- Total spaces by type
- Available spaces (status = available AND no active assignment)
- Occupied spaces (active assignment or status = occupied)
- Reserved spaces
- Cache availability counts (update on assignment changes)

**5.2 API Endpoint**

- `GET /api/parking/availability?buildingId=...` - Get real-time availability
- Returns counts by space type and status
- Returns list of available spaces for assignment

**5.3 UI Enhancements**

- Add real-time availability dashboard card to `/org/parking/spaces/page.tsx`
- Add availability indicator to parking space cards
- Add "Quick Assign" button that shows only available spaces

### 6. Parking Duration Tracking

**6.1 Duration Calculation**

- Enhance `ParkingAssignment` model to track:
- `actualStartTime` (when vehicle actually entered)
- `actualEndTime` (when vehicle actually exited)
- `calculatedDuration` (in hours/minutes)
- `billedDuration` (for visitor parking)

**6.2 Duration Analytics** - `src/modules/parking/duration-analytics.ts`

- Functions to calculate:
- Average parking duration by space type
- Peak parking hours
- Longest/shortest stays
- Duration trends over time

**6.3 API Endpoints**

- `GET /api/parking/analytics/duration` - Duration statistics and trends
- Enhance assignment endpoints to return duration data

### 7. Parking Utilization Reports

**7.1 Utilization Analytics** - `src/modules/parking/utilization-analytics.ts`

- Functions to calculate:
- Utilization rate (occupied/total) by space type, building, time period
- Peak utilization times
- Space type distribution
- Revenue by space type (from assignments)
- Violation frequency by space/type

**7.2 Report Generation**

- `GET /api/parking/reports/utilization` - Generate utilization report
- Parameters: buildingId, startDate, endDate, spaceType
- Returns: utilization percentages, peak times, revenue summary

**7.3 UI Components**

- `/org/parking/reports/utilization/page.tsx` - Utilization report viewer
- Charts: utilization over time, peak hours, space type distribution
- Export to CSV/PDF
- Add utilization summary cards to main parking dashboard

### 8. Enhanced Parking Operations UI

**8.1 Parking Dashboard** - `/org/parking/dashboard/page.tsx`

- Real-time stats: total spaces, available, occupied, violations today
- Recent activity feed: entries, exits, violations
- Quick actions: assign space, log entry/exit, report violation
- Utilization charts (daily/weekly/monthly)

**8.2 Security Mobile Enhancements**

- Add parking section to security mobile layout
- `/security/parking/quick-assign/page.tsx` - Quick visitor parking assignment
- `/security/parking/log-entry/page.tsx` - Manual entry/exit logging
- `/security/parking/report-violation/page.tsx` - Quick violation reporting

**8.3 Tenant Portal Enhancements**

- `/tenant/parking/page.tsx` - View assigned parking space and vehicle
- Show parking history and any violations
- Request parking space change (if allowed)

### 9. Integration Points

**9.1 Visitor Log Integration**

- When visitor logs entry, auto-create temporary vehicle if vehicle info provided
- Link visitor exit to parking exit log
- Auto-end visitor parking assignment on exit

**9.2 Assignment Integration**

- Auto-update parking space status when assignment created/ended
- Auto-create entry log on assignment start
- Auto-create exit log on assignment end
- Calculate and store duration

**9.3 Notification Integration**

- Notify tenant when parking assignment created/ended
- Notify security when violation reported
- Noti