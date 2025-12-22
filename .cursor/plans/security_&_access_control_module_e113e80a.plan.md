---
name: Security & Access Control Module
overview: Comprehensive Security & Access Control system with security staff management, shift scheduling, incident logging with analytics, enhanced visitor reporting, and access control management.
todos: []
---

# Security & Access Control Module Implementation Plan

## Overview

This plan implements a comprehensive Security & Access Control system building on existing visitor management infrastructure. The implementation includes security staff management with shift scheduling, incident logging with analytics, enhanced visitor reporting, and access control management.

## Current State Analysis

**Already Implemented:**

- Visitor logs model with full CRUD (`src/lib/security/visitor-logs.ts`)
- Visitor QR codes model (`src/lib/security/visitor-qr-codes.ts`)
- Visitor logs API endpoints (`app/api/visitor-logs/`)
- Visitor QR codes API endpoints (`app/api/visitor-qr-codes/`)
- Basic security UI pages (`app/security/visitors/`)
- Security mobile layout (`src/lib/components/layouts/SecurityMobileLayout.tsx`)
- User model with `shiftStatus` field (`src/lib/auth/users.ts`)
- Security role in RBAC system

**Gaps to Address:**

1. Security staff/guard registration and profile management
2. Shift management and scheduling system
3. Security incident logging model and API
4. Incident categorization, severity, and attachments
5. Incident history, analytics, and building-level reports
6. Enhanced visitor reporting and analytics
7. Access control management (tenant/visitor permissions)

## Implementation Tasks

### 1. Security Staff Management

**1.1 Security Staff Profile Model**

- File: `src/lib/security/security-staff.ts`
- Create SecurityStaff interface extending User profile:
  ```typescript
  interface SecurityStaff {
    _id: string;
    userId: string; // ObjectId ref to users
    organizationId: string;
    buildingId?: string | null; // Primary building assignment
    assignedBuildings?: string[]; // Multiple building assignments
    employeeId?: string | null;
    badgeNumber?: string | null;
    hireDate?: Date | null;
    emergencyContact?: {
      name: string;
      phone: string;
      relationship?: string;
    } | null;
    certifications?: Array<{
      name: string;
      issuedDate: Date;
      expiryDate?: Date | null;
      issuer?: string | null;
    }> | null;
    notes?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }
  ```

- Create CRUD functions: `createSecurityStaff`, `findSecurityStaffByUserId`, `findSecurityStaffByBuilding`, `updateSecurityStaff`
- API: `app/api/security/staff/route.ts` (GET, POST)
- API: `app/api/security/staff/[id]/route.ts` (GET, PUT, DELETE)

**1.2 Shift Management Model**

- File: `src/lib/security/shifts.ts`
- Create Shift interface:
  ```typescript
  interface Shift {
    _id: string;
    organizationId: string;
    buildingId: string;
    securityStaffId: string; // ObjectId ref to security staff
    shiftType: 'morning' | 'afternoon' | 'night' | 'custom';
    startTime: Date;
    endTime: Date;
    status: 'scheduled' | 'active' | 'completed' | 'cancelled';
    notes?: string | null;
    checkInTime?: Date | null;
    checkOutTime?: Date | null;
    createdBy: string; // ObjectId ref to users
    createdAt: Date;
    updatedAt: Date;
  }
  ```

- Create CRUD functions and collection
- API: `app/api/security/shifts/route.ts` (GET, POST)
- API: `app/api/security/shifts/[id]/route.ts` (GET, PUT, DELETE)
- API: `app/api/security/shifts/[id]/check-in/route.ts` (POST)
- API: `app/api/security/shifts/[id]/check-out/route.ts` (POST)

**1.3 Security Staff UI**

- New: `app/org/security/staff/page.tsx` - List security staff
- New: `app/org/security/staff/new/page.tsx` - Register security guard
- New: `app/org/security/staff/[id]/page.tsx` - View/edit security staff profile
- New: `app/org/security/shifts/page.tsx` - Shift schedule view
- New: `app/org/security/shifts/new/page.tsx` - Create shift
- New: `app/org/security/shifts/[id]/page.tsx` - View/edit shift
- Update: `app/security/` - Add shift check-in/check-out to security mobile portal

### 2. Incident Logging System

**2.1 Incident Model**

- File: `src/lib/security/incidents.ts`
- Create SecurityIncident interface:
  ```typescript
  interface SecurityIncident {
    _id: string;
    organizationId: string;
    buildingId: string;
    unitId?: string | null;
    incidentType: 'theft' | 'vandalism' | 'trespassing' | 'violence' | 'suspicious_activity' | 'fire' | 'medical' | 'other';
    severity: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    description: string;
    location?: string | null; // Specific location within building
    reportedBy: string; // ObjectId ref to users (security staff)
    reportedAt: Date;
    involvedParties?: Array<{
      name: string;
      role: 'tenant' | 'visitor' | 'staff' | 'unknown';
      contactInfo?: string | null;
    }> | null;
    status: 'reported' | 'under_investigation' | 'resolved' | 'closed';
    resolvedAt?: Date | null;
    resolutionNotes?: string | null;
    resolvedBy?: string | null; // ObjectId ref to users
    photos?: string[] | null; // URLs
    documents?: string[] | null; // URLs or GridFS IDs
    linkedVisitorLogId?: string | null; // If incident involves a visitor
    linkedComplaintId?: string | null; // If incident relates to a complaint
    createdAt: Date;
    updatedAt: Date;
  }
  ```

- Create CRUD functions and collection
- API: `app/api/security/incidents/route.ts` (GET, POST)
- API: `app/api/security/incidents/[id]/route.ts` (GET, PUT, DELETE)
- API: `app/api/security/incidents/[id]/photos/route.ts` (POST)
- API: `app/api/security/incidents/[id]/documents/route.ts` (POST)

**2.2 Incident Analytics Module**

- File: `src/modules/security/incident-analytics.ts`
- Functions:
  - `getIncidentStatistics(buildingId, organizationId, dateRange)` - Count by type, severity, status
  - `getIncidentTrends(buildingId, organizationId, periodMonths)` - Trends over time
  - `getIncidentByType(buildingId, organizationId, dateRange)` - Breakdown by incident type
  - `getIncidentBySeverity(buildingId, organizationId, dateRange)` - Breakdown by severity
- API: `app/api/security/incidents/analytics/route.ts` (GET)

**2.3 Incident UI**

- New: `app/org/security/incidents/page.tsx` - List incidents with filters
- New: `app/org/security/incidents/new/page.tsx` - Report incident
- New: `app/org/security/incidents/[id]/page.tsx` - View/edit incident details
- New: `app/org/security/incidents/reports/page.tsx` - Incident reports and analytics
- Update: `app/security/` - Add incident reporting to security mobile portal

### 3. Enhanced Visitor Management

**3.1 Visitor Reporting Module**

- File: `src/modules/security/visitor-analytics.ts`
- Functions:
  - `getVisitorStatistics(buildingId, organizationId, dateRange)` - Total visitors, active visitors, average visit duration
  - `getVisitorTrends(buildingId, organizationId, periodMonths)` - Visitor trends over time
  - `getTopHosts(buildingId, organizationId, dateRange, limit)` - Tenants with most visitors
  - `getVisitorByPurpose(buildingId, organizationId, dateRange)` - Breakdown by visit purpose
  - `getVisitorByTimeOfDay(buildingId, organizationId, dateRange)` - Peak visiting hours
- API: `app/api/visitor-logs/analytics/route.ts` (GET)

**3.2 Enhanced Visitor UI**

- Update: `app/org/security/visitors/page.tsx` - Enhanced list with filters and search
- New: `app/org/security/visitors/reports/page.tsx` - Visitor analytics and reports
- Update: `app/security/visitors/page.tsx` - Enhanced mobile view

### 4. Access Control Management

**4.1 Access Control Model**

- File: `src/lib/security/access-control.ts`
- Create AccessPermission interface:
  ```typescript
  interface AccessPermission {
    _id: string;
    organizationId: string;
    buildingId: string;
    entityType: 'tenant' | 'visitor' | 'staff';
    entityId: string; // ObjectId ref to tenant, visitor log, or user
    accessLevel: 'full' | 'restricted' | 'denied';
    restrictions?: {
      timeWindows?: Array<{
        dayOfWeek: number; // 0-6 (Sunday-Saturday)
        startTime: string; // HH:mm format
        endTime: string;
      }> | null;
      areas?: string[] | null; // Specific areas/units allowed
      requiresEscort?: boolean | null;
    } | null;
    validFrom?: Date | null;
    validUntil?: Date | null;
    notes?: string | null;
    createdBy: string; // ObjectId ref to users
    createdAt: Date;
    updatedAt: Date;
  }
  ```

- Create CRUD functions and collection
- API: `app/api/security/access-control/route.ts` (GET, POST)
- API: `app/api/security/access-control/[id]/route.ts` (GET, PUT, DELETE)

**4.2 Access Control UI**

- New: `app/org/security/access-control/page.tsx` - List access permissions
- New: `app/org/security/access-control/tenants/page.tsx` - Manage tenant access
- New: `app/org/security/access-control/visitors/page.tsx` - Manage visitor access permissions

### 5. Integration Points

**5.1 Visitor-Incident Linking**

- When creating incident, allow linking to visitor log
- When visitor log is linked, show incident badge in visitor detail view
- File: Update incident creation API to handle `linkedVisitorLogId`

**5.2 Shift-Visitor Logging Integration**

- Track which security staff member logged each visitor entry/exit
- Display active shift information in security portal
- File: Visitor log already has `loggedBy` field, enhance UI to show shift context

**5.3 Notification Integration**

- Send notifications for critical security incidents (high/critical severity) to Building Manager and Org Admin
- Notify security staff of shift assignments and reminders
- Alert Building Manager when incidents are reported or resolved
- File: `src/modules/notifications/security-events.ts` - Create notification handlers for security events
- Integrate with existing notification service (`src/modules/notifications/notification-service.ts`)

**5.4 RBAC Integration**

- Ensure proper permissions for security staff management (ORG_ADMIN, BUILDING_MANAGER)
- Ensure proper permissions for incident logging (SECURITY, BUILDING_MANAGER, ORG_ADMIN)
- Ensure proper permissions for access control management (ORG_ADMIN, BUILDING_MANAGER)
- File: Update `src/lib/auth/permissions.ts` if needed for new security endpoints

### 6. Testing and Validation

**6.1 Data Validation**

- Validate security staff profile data (badge numbers, employee IDs)
- Validate shift scheduling (no overlapping shifts for same staff, valid time ranges)
- Validate incident data (required fields, severity levels, incident types)
- Validate access control permissions (valid entity types, time windows)

**6.2 Integration Testing**

- Test security staff registration and profile updates
- Test shift creation, check-in, and check-out flows
- Test incident creation with photos and documents
- Test visitor-incident linking
- Test access control permission creation and validation
- Test analytics and reporting endpoints

**6.3 UI/UX Validation**

- Ensure mobile-friendly security portal for guards
- Verify responsive design for admin security management pages
- Test incident reporting flow from security mobile portal
- Validate shift check-in/check-out UI
- Test visitor analytics dashboard

### 7. File Structure Summary

**New Files to Create:**

- `src/lib/security/security-staff.ts` - Security staff model and CRUD
- `src/lib/security/shifts.ts` - Shift management model and CRUD
- `src/lib/security/incidents.ts` - Incident logging model and CRUD
- `src/lib/security/access-control.ts` - Access control model and CRUD
- `src/modules/security/incident-analytics.ts` - Incident analytics functions
- `src/modules/security/visitor-analytics.ts` - Visitor analytics functions
- `src/modules/notifications/security-events.ts` - Security event notifications
- `app/api/security/staff/route.ts` - Security staff API
- `app/api/security/staff/[id]/route.ts` - Security staff detail API
- `app/api/security/shifts/route.ts` - Shifts API
- `app/api/security/shifts/[id]/route.ts` - Shift detail API
- `app/api/security/shifts/[id]/check-in/route.ts` - Shift check-in API
- `app/api/security/shifts/[id]/check-out/route.ts` - Shift check-out API
- `app/api/security/incidents/route.ts` - Incidents API
- `app/api/security/incidents/[id]/route.ts` - Incident detail API
- `app/api/security/incidents/[id]/photos/route.ts` - Incident photo upload API
- `app/api/security/incidents/[id]/documents/route.ts` - Incident document upload API
- `app/api/security/incidents/analytics/route.ts` - Incident analytics API
- `app/api/visitor-logs/analytics/route.ts` - Visitor analytics API
- `app/api/security/access-control/route.ts` - Access control API
- `app/api/security/access-control/[id]/route.ts` - Access control detail API
- `app/org/security/staff/page.tsx` - Security staff list
- `app/org/security/staff/new/page.tsx` - Register security guard
- `app/org/security/staff/[id]/page.tsx` - Security staff profile
- `app/org/security/shifts/page.tsx` - Shift schedule
- `app/org/security/shifts/new/page.tsx` - Create shift
- `app/org/security/shifts/[id]/page.tsx` - Shift detail
- `app/org/security/incidents/page.tsx` - Incidents list
- `app/org/security/incidents/new/page.tsx` - Report incident
- `app/org/security/incidents/[id]/page.tsx` - Incident detail
- `app/org/security/incidents/reports/page.tsx` - Incident reports
- `app/org/security/visitors/reports/page.tsx` - Visitor reports
- `app/org/security/access-control/page.tsx` - Access control list
- `app/org/security/access-control/tenants/page.tsx` - Tenant access management
- `app/org/security/access-control/visitors/page.tsx` - Visitor access management

**Files to Update:**

- `app/org/security/visitors/page.tsx` - Enhance with filters and search
- `app/security/visitors/page.tsx` - Enhance mobile view
- `app/security/layout.tsx` - Add navigation for incidents and shifts
- `app/security/visitors/[id]/page.tsx` - Show linked incidents if any
- `src/lib/components/layouts/SecurityMobileLayout.tsx` - Add shift check-in/check-out and incident reporting