## Role-Based Authentication & User Management (Detailed Plan)

### Goals

- Complete user management system with full CRUD operations.
- Implement user invitation and activation workflow.
- Build password management (reset, change, enforce policies).
- Create role assignment and management UI.
- Implement user profile management for self-service.
- Add user status management (active, inactive, suspended).
- Build comprehensive user management UI for admins.
- Add user activity audit logging.

### Current State Analysis

**✅ Already Implemented:**

- Users collection: `src/lib/auth/users.ts` with basic CRUD functions (`createUser`, `findUserById`, `findUserByEmailOrPhone`).
- User model: TypeScript interface with `_id`, `organizationId`, `phone`, `email`, `passwordHash`, `roles`, `status`, `createdAt`, `updatedAt`.
- RBAC system: Permission matrix, authorization helpers (`requirePermission`, `requireRole`, `hasPermission`).
- Authentication: Login, OTP flow, session management.
- Basic users API: `GET /api/users` (list users, org-scoped).
- Seed endpoints: For creating initial users (SUPER_ADMIN, ORG_ADMIN, BUILDING_MANAGER).

**❌ Needs Implementation:**

- Complete user CRUD APIs (POST, PATCH, DELETE for `/api/users` and `/api/users/[id]`).
- User invitation system (invite by email/phone, activation tokens).
- Password reset flow (forgot password, reset token, new password).
- Password change (for authenticated users).
- Role assignment UI and APIs.
- User status management (activate, deactivate, suspend).
- User profile management (self-service).
- User management UI pages.
- User activity audit logging.
- Building-level role assignments (optional, for future).

---

### Step 1 – Complete User CRUD Functions

- **1.1 Enhance user model**
  - **1.1.1** Update `src/lib/auth/users.ts`:
    - Add missing fields to `User` interface (if needed):
      - `name?: string | null` (user's full name).
      - `invitedBy?: string | null` (ObjectId ref to users, who invited this user).
      - `invitedAt?: Date | null` (when invitation was sent).
      - `activatedAt?: Date | null` (when user activated account).
      - `lastLoginAt?: Date | null` (track last login time).
      - `passwordChangedAt?: Date | null` (track password change for security).
      - `invitationToken?: string | null` (for invitation activation).
      - `invitationTokenExpiresAt?: Date | null` (invitation expiry).
      - `resetPasswordToken?: string | null` (for password reset).
      - `resetPasswordTokenExpiresAt?: Date | null` (reset token expiry).

- **1.2 Add CRUD functions**
  - **1.2.1** `updateUser(userId: string, updates: Partial<User>)`: Update user fields.
    - Validate updates (e.g., can't change `organizationId` unless SUPER_ADMIN).
    - Update `updatedAt` timestamp.
  - **1.2.2** `deleteUser(userId: string)`: Soft delete user (set status to "inactive").
    - Prevent deletion of last ORG_ADMIN in organization.
    - Prevent deletion of SUPER_ADMIN.
  - **1.2.3** `findUsersByOrganization(organizationId: string, filters?: Record<string, unknown>)`: List users in organization.
  - **1.2.4** `findUsersByRole(role: UserRole, organizationId?: string)`: Find users with specific role.
  - **1.2.5** `updateUserRoles(userId: string, roles: UserRole[])`: Update user roles.
    - Validate role assignments (e.g., can't remove last ORG_ADMIN).
  - **1.2.6** `updateUserStatus(userId: string, status: User["status"])`: Update user status.
    - Prevent deactivating last ORG_ADMIN.

- **1.3 Add indexes**
  - **1.3.1** Update `ensureUserIndexes()`:
    - Add index on `organizationId` (for org-scoped queries).
    - Add index on `roles` (for role-based queries).
    - Add index on `status` (for filtering by status).
    - Add index on `invitationToken` (sparse, for invitation lookups).
    - Add index on `resetPasswordToken` (sparse, for password reset lookups).

---

### Step 2 – User Invitation System

- **2.1 Create invitation tokens collection (optional)**
  - **2.1.1** Option 1: Store invitation tokens in user document (simpler).
    - Use `invitationToken` and `invitationTokenExpiresAt` fields in user document.
  - **2.1.2** Option 2: Create separate `invitations` collection (more flexible):
    - `_id`, `organizationId`, `email`, `phone`, `roles`, `invitedBy`, `token`, `expiresAt`, `used`, `createdAt`.

- **2.2 Invitation service**
  - **2.2.1** Create `src/modules/users/invitation-service.ts`:
    - `createInvitation(input: CreateInvitationInput)`: Create invitation.
      - Generate secure token (crypto.randomBytes or similar).
      - Set expiration (e.g., 7 days).
      - Create user with status "invited" (or store in invitations collection).
      - Send invitation email/SMS with activation link.
    - `validateInvitationToken(token: string)`: Validate token and return user.
    - `activateUser(token: string, password: string)`: Activate user account.
      - Verify token is valid and not expired.
      - Set password, update status to "active", clear invitation token.
      - Set `activatedAt` timestamp.

- **2.3 Invitation API endpoints**
  - **2.3.1** Create `app/api/users/invite/route.ts`:
    - `POST`: Invite user.
      - Request body: `{ email?, phone, roles, organizationId }`.
      - Requires `ORG_ADMIN` or `SUPER_ADMIN` permission.
      - Creates user with "invited" status.
      - Generates invitation token.
      - Sends invitation email/SMS.
      - Returns invitation details (token for dev, or success message).
  - **2.3.2** Create `app/api/users/activate/route.ts`:
    - `POST`: Activate user account.
      - Request body: `{ token, password }`.
      - Validates token.
      - Sets password and activates account.
      - Returns success or error.

- **2.4 Invitation email/SMS templates**
  - **2.4.1** Create invitation email template:
    - Subject: "You've been invited to join [Organization Name] BMS".
    - Body: Welcome message, activation link, instructions.
    - Include organization name, inviter name, assigned roles.
  - **2.4.2** Create invitation SMS template (if phone-based):
    - Short message with activation link or code.
    - Support for Amharic, English, Afaan Oromo, Tigrigna.

---

### Step 3 – Password Management

- **3.1 Password reset flow**
  - **3.1.1** Create `src/modules/users/password-reset-service.ts`:
    - `requestPasswordReset(emailOrPhone: string)`: Initiate password reset.
      - Find user by email or phone.
      - Generate secure reset token.
      - Set expiration (e.g., 1 hour).
      - Store token in user document (`resetPasswordToken`, `resetPasswordTokenExpiresAt`).
      - Send reset email/SMS with reset link.
    - `validateResetToken(token: string)`: Validate reset token.
    - `resetPassword(token: string, newPassword: string)`: Reset password.
      - Validate token and expiration.
      - Hash new password.
      - Update password, clear reset token, update `passwordChangedAt`.

- **3.2 Password reset API endpoints**
  - **3.2.1** Create `app/api/auth/forgot-password/route.ts`:
    - `POST`: Request password reset.
      - Request body: `{ emailOrPhone }`.
      - Returns success (don't reveal if user exists for security).
  - **3.2.2** Create `app/api/auth/reset-password/route.ts`:
    - `POST`: Reset password with token.
      - Request body: `{ token, newPassword }`.
      - Validates token and sets new password.

- **3.3 Password change (authenticated users)**
  - **3.3.1** Create `app/api/auth/change-password/route.ts`:
    - `POST`: Change password for authenticated user.
      - Request body: `{ currentPassword, newPassword }`.
      - Requires authentication.
      - Verifies current password.
      - Updates password and `passwordChangedAt`.
      - Optionally invalidate all other sessions (force re-login).

- **3.4 Password policy**
  - **3.4.1** Create `src/lib/auth/password-policy.ts`:
    - `validatePassword(password: string)`: Validate password meets requirements.
      - Minimum length (e.g., 8 characters).
      - Complexity requirements (uppercase, lowercase, number, special character).
      - Common password blacklist.
    - Return validation errors if password doesn't meet requirements.

- **3.5 Password reset UI**
  - **3.5.1** Create `app/auth/forgot-password/page.tsx`:
    - Form: email or phone input.
    - Submit sends reset request.
    - Success message: "If an account exists, a reset link has been sent."
  - **3.5.2** Create `app/auth/reset-password/[token]/page.tsx`:
    - Form: new password, confirm password.
    - Validates token on page load.
    - Shows error if token invalid/expired.
    - On success, redirects to login.

---

### Step 4 – User CRUD APIs

- **4.1 Complete users list API**
  - **4.1.1** Update `app/api/users/route.ts`:
    - Enhance `GET` handler:
      - Add query params: `role`, `status`, `buildingId` (optional, for building-level roles).
      - Add pagination: `page`, `limit`.
      - Add search: `search` (by name, email, phone).
      - Return user count for pagination.
    - Add `POST` handler:
      - Create new user (requires `users.create` permission).
      - Request body: `{ email?, phone, password, roles, organizationId, name? }`.
      - Validate input (phone uniqueness, email format, password strength).
      - Hash password before storing.
      - Return created user (without password hash).

- **4.2 User detail API**
  - **4.2.1** Create `app/api/users/[id]/route.ts`:
    - `GET`: Get single user.
      - Verify user belongs to same org (unless SUPER_ADMIN).
      - Return user details (without password hash).
    - `PATCH`: Update user.
      - Request body: `{ name?, email?, phone?, roles?, status? }`.
      - Validate permissions:
        - User can update own profile (name, email).
        - Only ORG_ADMIN/SUPER_ADMIN can update roles.
        - Only ORG_ADMIN/SUPER_ADMIN can update status.
      - Validate phone/email uniqueness.
    - `DELETE`: Soft delete user.
      - Requires `users.delete` permission.
      - Prevents deleting last ORG_ADMIN.
      - Sets status to "inactive".

- **4.3 User roles API**
  - **4.3.1** Create `app/api/users/[id]/roles/route.ts`:
    - `PATCH`: Update user roles.
      - Request body: `{ roles: UserRole[] }`.
      - Requires `users.assign_roles` permission.
      - Validates role assignments (e.g., can't remove last ORG_ADMIN).
      - Updates user roles and `updatedAt`.

- **4.4 User status API**
  - **4.4.1** Create `app/api/users/[id]/status/route.ts`:
    - `PATCH`: Update user status.
      - Request body: `{ status: "active" | "inactive" | "suspended" }`.
      - Requires `users.update` permission.
      - Prevents deactivating last ORG_ADMIN.
      - If suspending, optionally invalidate user sessions.

---

### Step 5 – User Profile Management

- **5.1 User profile API**
  - **5.1.1** Create `app/api/users/me/route.ts`:
    - `GET`: Get current user's profile.
      - Returns user details from session.
    - `PATCH`: Update own profile.
      - Request body: `{ name?, email?, phone? }`.
      - Validates email/phone uniqueness.
      - Updates user document.

- **5.2 User profile UI**
  - **5.2.1** Create `app/admin/profile/page.tsx` (for staff):
    - Display user info: name, email, phone, roles, organization.
    - Editable fields: name, email, phone.
    - "Change Password" section.
    - "Notification Preferences" section (if implemented).
  - **5.2.2** Create `app/tenant/profile/page.tsx` (already exists, may need enhancement):
    - Similar to staff profile but tenant-specific.
    - Language preference selector.

- **5.3 Change password UI**
  - **5.3.1** Add to profile pages:
    - Form: current password, new password, confirm password.
    - Password strength indicator.
    - Validation and error handling.

---

### Step 6 – User Management UI

- **6.1 Users list page**
  - **6.1.1** Create `app/admin/users/page.tsx`:
    - List view with table:
      - Columns: name, email, phone, roles, status, organization, last login, actions.
      - Filters: role, status, organization (for SUPER_ADMIN), search.
      - Pagination.
      - "Invite User" button (for ORG_ADMIN/SUPER_ADMIN).
    - Stats cards: total users, active users, invited users, suspended users.

- **6.2 Invite user page**
  - **6.2.1** Create `app/admin/users/invite/page.tsx`:
    - Form: email or phone, name (optional), roles (multi-select), organization (for SUPER_ADMIN).
    - Role selection with descriptions.
    - "Send Invitation" button.
    - Success message with invitation details.

- **6.3 User detail/edit page**
  - **6.3.1** Create `app/admin/users/[id]/page.tsx`:
    - Display user details.
    - Tabs or sections:
      - Profile: name, email, phone, organization.
      - Roles: current roles, ability to add/remove roles.
      - Status: current status, ability to change status.
      - Activity: last login, account created, etc.
    - Edit button (if user has permission).
    - Delete/Deactivate button (if user has permission).

- **6.4 User edit page**
  - **6.4.1** Create `app/admin/users/[id]/edit/page.tsx`:
    - Form: name, email, phone, roles, status.
    - Validation and error handling.
    - Save and cancel buttons.

- **6.5 Activate account page (public)**
  - **6.5.1** Create `app/auth/activate/[token]/page.tsx`:
    - Public page (no authentication required).
    - Validates invitation token on load.
    - Form: password, confirm password.
    - Password strength indicator.
    - On success, activates account and redirects to login.

---

### Step 7 – Role Assignment and Management

- **7.1 Role assignment UI component**
  - **7.1.1** Create `src/components/users/RoleSelector.tsx`:
    - Multi-select component for roles.
    - Shows role descriptions.
    - Disables roles user doesn't have permission to assign.
    - Validates role combinations (e.g., can't assign TENANT to staff user).

- **7.2 Role management page (optional, advanced)**
  - **7.2.1** Create `app/admin/roles/page.tsx`:
    - Display all roles with descriptions.
    - Show permission matrix (read-only view).
    - For SUPER_ADMIN: ability to view and understand role hierarchy.

- **7.3 Building-level role assignments (optional, future)**
  - **7.3.1** Document future enhancement:
    - Allow assigning roles at building level (e.g., BUILDING_MANAGER for specific building only).
    - Would require `userRoles` collection with `buildingId` field.
    - For MVP, roles are organization-level only.

---

### Step 8 – User Status Management

- **8.1 Status management functions**
  - **8.1.1** Create `src/modules/users/status-service.ts`:
    - `activateUser(userId: string)`: Set status to "active".
    - `deactivateUser(userId: string)`: Set status to "inactive".
    - `suspendUser(userId: string, reason?: string)`: Set status to "suspended".
    - `unsuspendUser(userId: string)`: Reactivate suspended user.
    - All functions validate permissions and business rules.

- **8.2 Status change UI**
  - **8.2.1** Add to user detail page:
    - Status badge with current status.
    - Dropdown or buttons to change status.
    - Confirmation dialog for status changes.
    - Reason field for suspension (optional).

---

### Step 9 – User Activity Audit Logging

- **9.1 Create user activity logs collection**
  - **9.1.1** Create `src/lib/users/user-activity-logs.ts`:
    - Define `UserActivityLog` interface:
      ```typescript
      interface UserActivityLog {
        _id: string;
        organizationId?: string | null;
        userId: string; // ObjectId ref to users
        action:
          | 'login'
          | 'logout'
          | 'password_change'
          | 'profile_update'
          | 'role_assigned'
          | 'status_changed'
          | 'user_created'
          | 'user_deleted'
          | 'permission_denied'
          | 'other';
        details?: Record<string, unknown> | null; // Additional context
        ipAddress?: string | null;
        userAgent?: string | null;
        createdAt: Date;
      }
      ```
  - **9.1.2** Create collection getter and indexes:
    - Compound index on `{ userId, createdAt }` (descending).
    - Index on `organizationId`, `action`, `createdAt`.

- **9.2 Activity logging service**
  - **9.2.1** Create `src/modules/users/activity-logger.ts`:
    - `logActivity(input: LogActivityInput)`: Log user activity.
    - Automatically extract IP address and user agent from request.
    - Store in `userActivityLogs` collection.

- **9.3 Integrate activity logging**
  - **9.3.1** Add logging to key actions:
    - Login, logout.
    - Password change, password reset.
    - Profile updates.
    - Role assignments.
    - Status changes.
    - User creation, deletion.
    - Permission denied attempts.

- **9.4 Activity logs API**
  - **9.4.1** Create `app/api/users/[id]/activity/route.ts`:
    - `GET`: Get user activity logs.
      - Query params: `action`, `startDate`, `endDate`, `limit`.
      - Requires permission to view user activity (ORG_ADMIN or user viewing own activity).

- **9.5 Activity logs UI**
  - **9.5.1** Add to user detail page:
    - "Activity" tab showing recent activity logs.
    - Table: action, timestamp, IP address, details.
    - Filter by action type, date range.

---

### Step 10 – User Search and Filtering

- **10.1 Enhanced user search**
  - **10.1.1** Update user list API:
    - Add full-text search across name, email, phone.
    - Add filters: role, status, organization, building (if building-level roles).
    - Add sorting: name, email, created date, last login.

- **10.2 User search UI**
  - **10.2.1** Enhance users list page:
    - Search bar (real-time search).
    - Filter dropdowns (role, status).
    - Sort dropdown.
    - Clear filters button.

---

### Step 11 – User Bulk Operations

- **11.1 Bulk user operations API**
  - **11.1.1** Create `app/api/users/bulk/route.ts`:
    - `POST /api/users/bulk/invite`: Bulk invite users.
      - Request body: `{ users: Array<{ email?, phone, roles, name? }> }`.
      - Creates multiple invitations.
    - `POST /api/users/bulk/update-status`: Bulk update status.
      - Request body: `{ userIds: string[], status: UserStatus }`.
      - Updates multiple users' status.
    - `POST /api/users/bulk/assign-roles`: Bulk assign roles.
      - Request body: `{ userIds: string[], roles: UserRole[] }`.
      - Assigns roles to multiple users.

- **11.2 Bulk operations UI**
  - **11.2.1** Add to users list page:
    - Checkbox selection for users.
    - Bulk actions dropdown:
      - "Bulk Invite" (if CSV upload supported).
      - "Bulk Activate".
      - "Bulk Deactivate".
      - "Bulk Assign Roles".
    - Confirmation dialog for bulk operations.

---

### Step 12 – User Import/Export

- **12.1 User export**
  - **12.1.1** Create `app/api/users/export/csv/route.ts`:
    - `GET`: Export users to CSV.
      - Query params: filters (role, status, organization).
      - Returns CSV with: name, email, phone, roles, status, organization, created date.

- **12.2 User import (optional)**
  - **12.2.1** Create `app/api/users/import/route.ts`:
    - `POST`: Import users from CSV.
      - Validates CSV format.
      - Creates users or invitations.
      - Returns import results (success, errors).

- **12.3 Import/Export UI**
  - **12.3.1** Add to users list page:
    - "Export Users" button.
    - "Import Users" button (with CSV template download).

---

### Step 13 – Security Enhancements

- **13.1 Session management**
  - **13.1.1** Create `app/api/auth/sessions/route.ts`:
    - `GET`: List active sessions for current user.
    - `DELETE /api/auth/sessions/[sessionId]`: Revoke specific session.
    - `DELETE /api/auth/sessions/all`: Revoke all other sessions (keep current).

- **13.2 Two-factor authentication (optional, future)**
  - **13.2.1** Document future enhancement:
    - TOTP-based 2FA for staff users.
    - SMS-based 2FA as alternative.
    - Backup codes for account recovery.

- **13.3 Account lockout**
  - **13.3.1** Implement account lockout after failed login attempts:
    - Track failed login attempts per user.
    - Lock account after N failed attempts (e.g., 5).
    - Lock duration (e.g., 15 minutes) or require admin unlock.
    - Reset attempt counter on successful login.

---

### Step 14 – User Management Exit Criteria

- **14.1 User CRUD**
  - ✅ Users can be created, read, updated, and soft-deleted via APIs.
  - ✅ All operations enforce RBAC and organization scoping.
  - ✅ Phone and email uniqueness is enforced.

- **14.2 User Invitations**
  - ✅ Users can be invited via email or phone.
  - ✅ Invitation tokens are secure and expire after set time.
  - ✅ Invited users can activate their accounts with password.
  - ✅ Invitation emails/SMS are sent successfully.

- **14.3 Password Management**
  - ✅ Users can request password reset via email/phone.
  - ✅ Password reset tokens are secure and expire.
  - ✅ Authenticated users can change their passwords.
  - ✅ Password policy is enforced (strength requirements).

- **14.4 Role Management**
  - ✅ Roles can be assigned and removed via UI.
  - ✅ Role assignments respect permission requirements.
  - ✅ Last ORG_ADMIN cannot be removed.
  - ✅ Role changes are logged.

- **14.5 User Status**
  - ✅ Users can be activated, deactivated, or suspended.
  - ✅ Status changes respect business rules.
  - ✅ Suspended users cannot log in.

- **14.6 User Management UI**
  - ✅ Admin can view, search, and filter users.
  - ✅ Admin can invite, edit, and manage users.
  - ✅ Users can view and edit their own profiles.
  - ✅ Users can change their passwords.

- **14.7 Audit Logging**
  - ✅ User activities are logged (login, password change, role changes, etc.).
  - ✅ Activity logs are viewable by authorized users.
  - ✅ Logs include IP address and timestamp.

---

## Implementation Notes

- **User Invitations:**
  - For MVP, email invitations are sufficient.
  - SMS invitations can be added later.
  - Invitation links should be absolute URLs (include domain).

- **Password Security:**
  - Use bcrypt with sufficient rounds (10-12).
  - Never log passwords or password hashes.
  - Enforce password complexity requirements.
  - Consider password expiration policy (optional, for future).

- **Role Assignment:**
  - Validate role assignments (e.g., can't assign TENANT role to staff user).
  - Prevent removing critical roles (last ORG_ADMIN).
  - Log all role changes for audit.

- **User Status:**
  - "active": User can log in and use system.
  - "inactive": User cannot log in (soft delete).
  - "suspended": User temporarily blocked (can be reactivated).
  - "invited": User invited but not yet activated.

- **Organization Scoping:**
  - All user operations must respect organization boundaries.
  - SUPER_ADMIN can manage users across organizations.
  - ORG_ADMIN can only manage users in their organization.
  - Users cannot see or access users from other organizations.

- **Performance:**
  - Index user queries properly (organizationId, roles, status).
  - Paginate user lists for large organizations.
  - Cache user permissions if needed (with invalidation on role change).

---

## API Endpoints Summary

- `GET /api/users` - List users (with filters, pagination, search).
- `POST /api/users` - Create user.
- `GET /api/users/[id]` - Get user details.
- `PATCH /api/users/[id]` - Update user.
- `DELETE /api/users/[id]` - Soft delete user.
- `PATCH /api/users/[id]/roles` - Update user roles.
- `PATCH /api/users/[id]/status` - Update user status.
- `GET /api/users/[id]/activity` - Get user activity logs.
- `GET /api/users/me` - Get current user profile.
- `PATCH /api/users/me` - Update own profile.
- `POST /api/users/invite` - Invite user.
- `POST /api/users/activate` - Activate user account.
- `POST /api/auth/forgot-password` - Request password reset.
- `POST /api/auth/reset-password` - Reset password with token.
- `POST /api/auth/change-password` - Change password (authenticated).
- `GET /api/auth/sessions` - List active sessions.
- `DELETE /api/auth/sessions/[sessionId]` - Revoke session.
- `POST /api/users/bulk/invite` - Bulk invite users.
- `POST /api/users/bulk/update-status` - Bulk update status.
- `GET /api/users/export/csv` - Export users to CSV.

---

## UI Pages Summary

- `app/admin/users/page.tsx` - Users list with filters and search.
- `app/admin/users/invite/page.tsx` - Invite user form.
- `app/admin/users/[id]/page.tsx` - User detail view.
- `app/admin/users/[id]/edit/page.tsx` - Edit user form.
- `app/admin/profile/page.tsx` - Own profile management.
- `app/auth/forgot-password/page.tsx` - Forgot password form.
- `app/auth/reset-password/[token]/page.tsx` - Reset password form.
- `app/auth/activate/[token]/page.tsx` - Activate account form.

---

## Dependencies

- No new major dependencies required (use existing bcryptjs, jose).
- Email/SMS providers (from Phase 6 notification system).
- CSV parsing (if import needed): `npm install papaparse` or `csv-parse`.

Reviewing the RBAC documentation and permissions to summarize the roles and their user flows.

[6 tools called]

## Roles overview

There are 9 roles:

1. SUPER_ADMIN — Platform owner (global SaaS)
2. ORG_ADMIN — Organization administrator
3. BUILDING_MANAGER — Building manager
4. FACILITY_MANAGER — Facility/maintenance manager
5. ACCOUNTANT — Financial operations
6. SECURITY — Security and access control
7. TECHNICIAN — Maintenance technician
8. TENANT — Tenant portal (own data only)
9. AUDITOR — Read-only auditor

---

## User flows by role

### 1. SUPER_ADMIN flow

- Login → Platform dashboard
- Manage organizations (create, update, deactivate)
- Create/seed ORG_ADMIN users per organization
- View cross-organization metrics and system health
- Bypass org scoping (can act on any `organizationId`)
- Access: All permissions across all modules

### 2. ORG_ADMIN flow

- Login → Organization dashboard
- Manage buildings (create, update, delete)
- Manage units (create, update, delete)
- Manage tenants (create, update, delete)
- Manage leases (create, update, delete, terminate)
- Manage invoices (create, update, delete, send)
- View payments (record, reconcile)
- Manage complaints (read, update, assign, resolve)
- Manage maintenance (read, create, update, assign)
- Manage assets (create, update, delete)
- Manage utilities (read, update)
- Manage security (read, update)
- Manage parking (create, update, delete, assign)
- Generate reports (view org, export)
- Manage users (create, read, update, delete, assign roles)

### 3. BUILDING_MANAGER flow

- Login → Building dashboard
- View organization info
- View/update assigned building
- View/update units in building
- View/update tenants in building
- View/update leases in building
- Create/update invoices for building
- View/record payments
- Manage complaints (read, update, assign, resolve)
- Create/assign maintenance work orders
- View/update assets
- View/update utilities
- View/update security
- Manage parking (view, update, assign)
- View building reports

### 4. FACILITY_MANAGER flow

- Login → Facility dashboard
- View organization and buildings
- View units and tenants
- View leases and invoices
- Manage complaints (read, update, resolve)
- Manage maintenance (create, update, assign, schedule)
- View/update assets
- View/update utilities
- View facility reports

### 5. ACCOUNTANT flow

- Login → Financial dashboard
- View organization and buildings
- Manage invoices (create, update, delete, send)
- Manage payments (create, update, reconcile, export)
- View complaints and maintenance (read-only)
- View assets and utilities (read-only)
- Generate financial reports (view, export)

### 6. SECURITY flow

- Login → Security dashboard
- View organization and buildings
- View units, tenants, leases (read-only)
- Create complaints
- View maintenance (read-only)
- Manage security (read, create, update, log entry/exit)
- Manage parking (read, update)
- View security reports

### 7. TECHNICIAN flow

- Login → Work orders dashboard
- View organization and buildings
- View assigned work orders
- Update work order status
- Complete work orders
- Log work performed
- View complaints (read, update)
- View assets (read, update)
- View utilities (read, update)
- View work reports

### 8. TENANT flow (mobile-first)

- OTP login → Tenant dashboard
- View own profile (read, update)
- View own lease details
- View own invoices
- Make payments (create payment intents)
- View payment history
- Submit complaints (create, update own)
- Create maintenance requests
- View own utilities
- View own parking spaces
- View own reports

### 9. AUDITOR flow

- Login → Audit dashboard
- View organization, buildings, units (read-only)
- View tenants, leases, invoices (read-only)
- View payments, complaints, maintenance (read-only)
- View assets, utilities, security, parking (read-only)
- View all reports (view, export)
- View users (read-only)

---

## Staff management and workflows

### How staff manage operations

#### ORG_ADMIN management

1. User management:
   - Invite users (email/phone)
   - Assign roles (ORG_ADMIN, BUILDING_MANAGER, ACCOUNTANT, etc.)
   - Activate/deactivate users
   - Manage user permissions
2. Building setup:
   - Create buildings
   - Configure building attributes
   - Assign BUILDING_MANAGER per building
3. Tenant onboarding:
   - Create tenant records
   - Create leases
   - Link tenants to units
   - Generate initial invoices

#### BUILDING_MANAGER management

1. Building operations:
   - Manage units in assigned building
   - Manage tenants in building
   - Handle complaints (assign, resolve)
   - Create invoices for building
2. Staff coordination:
   - Assign complaints to FACILITY_MANAGER or TECHNICIAN
   - Monitor maintenance work orders
   - Coordinate with SECURITY for parking/visitors

#### FACILITY_MANAGER management

1. Maintenance operations:
   - Create work orders
   - Assign work to TECHNICIAN
   - Schedule preventive maintenance
   - Track asset maintenance
2. Complaint resolution:
   - Receive complaints from BUILDING_MANAGER
   - Create work orders from complaints
   - Update complaint status when resolved

#### ACCOUNTANT management

1. Financial operations:
   - Create invoices
   - Send invoice notifications
   - Record payments
   - Reconcile payments with invoices
   - Generate financial reports
   - Export data for accounting systems

#### SECURITY management

1. Security operations:
   - Log visitor entries/exits
   - Manage parking spaces
   - Create security incidents
   - Monitor access control

#### TECHNICIAN management

1. Work execution:
   - View assigned work orders
   - Update work order status
   - Log work performed
   - Complete work orders
   - Update complaint status when work is done

---

## Staff user flow summary

### Typical staff workflow

1. Login → Role-based dashboard
2. View assigned tasks (complaints, work orders, invoices, etc.)
3. Take action:
   - ORG_ADMIN: Manage users, buildings, tenants
   - BUILDING_MANAGER: Handle building operations, complaints
   - FACILITY_MANAGER: Create/assign maintenance work
   - ACCOUNTANT: Process invoices and payments
   - SECURITY: Log visitors, manage parking
   - TECHNICIAN: Complete assigned work orders
4. Update status → System notifications
5. Generate reports → View analytics

### Staff coordination flow

```
Tenant Complaint
    ↓
BUILDING_MANAGER (receives, assigns)
    ↓
FACILITY_MANAGER (creates work order)
    ↓
TECHNICIAN (completes work)
    ↓
FACILITY_MANAGER (marks resolved)
    ↓
BUILDING_MANAGER (closes complaint)
    ↓
Tenant (notified of resolution)
```

---

## Permission summary

- SUPER_ADMIN: All permissions, cross-organization
- ORG_ADMIN: Full org access, user management
- BUILDING_MANAGER: Building-level operations
- FACILITY_MANAGER: Maintenance and facility operations
- ACCOUNTANT: Financial operations
- SECURITY: Security and parking operations
- TECHNICIAN: Work order execution
- TENANT: Own data only
- AUDITOR: Read-only access

All roles are scoped by `organizationId` (except SUPER_ADMIN), and permissions are enforced at both API and UI levels.
