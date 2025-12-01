# Building-Level Role Assignments - Future Enhancement

## Overview

This document describes a future enhancement to support building-level role assignments, allowing roles to be scoped to specific buildings within an organization.

## Current Implementation (MVP)

In the current MVP implementation:

- All roles are assigned at the **organization level**
- Roles are stored directly in the `users` collection as a `roles` array
- A user with a role (e.g., `BUILDING_MANAGER`) has that role for all buildings in their organization

## Proposed Enhancement

### Use Case

Allow assigning roles at the building level, enabling scenarios such as:

- A user can be `BUILDING_MANAGER` for Building A but not Building B
- A `FACILITY_MANAGER` can manage maintenance for specific buildings only
- A `SECURITY` user can have access to specific buildings' security systems

### Data Model Changes

#### New Collection: `userRoles`

Create a new `userRoles` collection with the following schema:

```typescript
interface UserRoleAssignment {
  _id: ObjectId;
  userId: ObjectId; // Reference to users collection
  organizationId: ObjectId; // Reference to organizations collection
  buildingId?: ObjectId | null; // Optional reference to buildings collection
  role: UserRole; // The role being assigned
  createdAt: Date;
  updatedAt: Date;
  assignedBy: ObjectId; // Reference to users collection (who assigned this role)
}
```

**Indexes:**

- Unique index on `{ userId, organizationId, buildingId, role }` (to prevent duplicate assignments)
- Index on `{ organizationId, buildingId }` (for building-level queries)
- Index on `{ userId, organizationId }` (for user role lookups)

#### Migration Strategy

1. **Phase 1: Dual Support**
   - Keep existing `users.roles` array for backward compatibility
   - Add new `userRoles` collection for building-level assignments
   - When querying user roles, merge both sources

2. **Phase 2: Migration**
   - Migrate existing organization-level roles from `users.roles` to `userRoles` collection
   - Set `buildingId` to `null` for organization-level roles

3. **Phase 3: Cleanup**
   - Remove `users.roles` array (or keep as computed/denormalized field for performance)
   - All role assignments go through `userRoles` collection

### API Changes

#### New Endpoints

1. **POST /api/users/[id]/roles/building**
   - Assign a role to a user for a specific building
   - Body: `{ role: UserRole, buildingId: string }`
   - Requires: `users.assign_roles` permission

2. **DELETE /api/users/[id]/roles/building**
   - Remove a building-level role assignment
   - Query params: `role`, `buildingId`
   - Requires: `users.assign_roles` permission

3. **GET /api/users/[id]/roles**
   - Enhanced to return both organization-level and building-level roles
   - Response format:
     ```json
     {
       "organizationRoles": ["ORG_ADMIN"],
       "buildingRoles": [
         {
           "role": "BUILDING_MANAGER",
           "buildingId": "building123",
           "buildingName": "Building A"
         }
       ]
     }
     ```

#### Modified Endpoints

1. **PATCH /api/users/[id]/roles**
   - Keep for organization-level roles
   - Add validation to prevent conflicts with building-level roles

### Authorization Logic Changes

#### Role Resolution

When checking if a user has a role:

1. Check organization-level roles (from `users.roles` or `userRoles` where `buildingId` is null)
2. If `buildingId` is provided in context, also check building-level roles
3. SUPER_ADMIN always has all roles regardless of building

#### Permission Checks

```typescript
function hasRoleInBuilding(context: AuthContext, role: UserRole, buildingId: string): boolean {
  // SUPER_ADMIN has all roles everywhere
  if (isSuperAdmin(context)) return true;

  // Check organization-level role
  if (context.roles.includes(role)) return true;

  // Check building-level role
  const buildingRole = userRoles.find(
    (r) =>
      r.userId === context.userId &&
      r.organizationId === context.organizationId &&
      r.buildingId === buildingId &&
      r.role === role,
  );

  return !!buildingRole;
}
```

### UI Changes

#### Role Assignment UI

1. **Enhanced Role Selector Component**
   - Add building selector when assigning building-level roles
   - Show both organization-level and building-level roles separately
   - Allow removing building-level roles

2. **User Detail Page**
   - New tab: "Building Roles"
   - Display table of building-level role assignments
   - Show building name, role, and assigned date
   - Allow adding/removing building-level roles

3. **Building Management Page**
   - Show users with roles for that building
   - Quick assign role to user for this building

### Implementation Considerations

#### Performance

- Consider caching role assignments in session/JWT for frequently accessed roles
- Use aggregation pipelines for efficient role lookups
- Denormalize organization-level roles in `users.roles` for quick access

#### Security

- Ensure building-level role assignments respect organization boundaries
- Validate that `buildingId` belongs to user's `organizationId`
- Audit log all role assignment changes

#### Backward Compatibility

- Existing code that checks `user.roles` array should continue to work
- Gradually migrate to new `userRoles` collection-based checks
- Provide migration utilities for existing deployments

### Example Scenarios

#### Scenario 1: Building-Specific Manager

```typescript
// User is BUILDING_MANAGER for Building A only
{
  userId: "user123",
  organizationId: "org1",
  buildingId: "buildingA",
  role: "BUILDING_MANAGER"
}

// User can manage Building A but not Building B
hasRoleInBuilding(context, "BUILDING_MANAGER", "buildingA") // true
hasRoleInBuilding(context, "BUILDING_MANAGER", "buildingB") // false
```

#### Scenario 2: Multi-Building Access

```typescript
// User is FACILITY_MANAGER for multiple buildings
[
  { userId: 'user123', buildingId: 'buildingA', role: 'FACILITY_MANAGER' },
  { userId: 'user123', buildingId: 'buildingB', role: 'FACILITY_MANAGER' },
];

// User can manage both buildings
hasRoleInBuilding(context, 'FACILITY_MANAGER', 'buildingA'); // true
hasRoleInBuilding(context, 'FACILITY_MANAGER', 'buildingB'); // true
```

#### Scenario 3: Organization + Building Roles

```typescript
// User has organization-level ACCOUNTANT role
// AND building-level BUILDING_MANAGER role for Building A
{
  organizationRoles: ["ACCOUNTANT"],
  buildingRoles: [
    { buildingId: "buildingA", role: "BUILDING_MANAGER" }
  ]
}
```

### Testing Strategy

1. **Unit Tests**
   - Test role resolution logic with various combinations
   - Test permission checks with building context
   - Test migration utilities

2. **Integration Tests**
   - Test API endpoints for building-level role assignment
   - Test authorization with building-level roles
   - Test backward compatibility with existing organization-level roles

3. **E2E Tests**
   - Test complete workflow of assigning building-level roles
   - Test user access to building-specific resources
   - Test role removal and updates

### Migration Checklist

- [ ] Create `userRoles` collection schema
- [ ] Add indexes to `userRoles` collection
- [ ] Implement dual-support role resolution
- [ ] Create migration script to move existing roles
- [ ] Update API endpoints for building-level roles
- [ ] Update authorization helpers
- [ ] Update UI components
- [ ] Add audit logging
- [ ] Update documentation
- [ ] Create rollback plan

### Timeline

This enhancement is planned for **Phase 2** of the BMS development, after the MVP is stable and in production use.

### Related Issues

- Role assignment UI component enhancement
- Building management page updates
- Authorization middleware updates
- Session/JWT token structure updates
