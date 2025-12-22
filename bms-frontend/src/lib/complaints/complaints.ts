import type { Collection, Db, IndexDescription, Document, OptionalUnlessRequiredId } from 'mongodb';
import { getDb } from '@/lib/db';
import { findTenantById } from '@/lib/tenants/tenants';
import { findUnitById } from '@/lib/units/units';

const COMPLAINTS_COLLECTION_NAME = 'complaints';

export type ComplaintCategory = 'maintenance' | 'noise' | 'security' | 'cleanliness' | 'other';
export type ComplaintPriority = 'low' | 'medium' | 'high' | 'urgent';
export type ComplaintStatus = 'open' | 'assigned' | 'in_progress' | 'resolved' | 'closed';
export type ComplaintType = 'complaint' | 'maintenance_request';
export type MaintenanceCategory =
  | 'plumbing'
  | 'electrical'
  | 'hvac'
  | 'appliance'
  | 'structural'
  | 'other';
export type Urgency = 'low' | 'medium' | 'high' | 'emergency';

export interface Complaint {
  _id: string;
  organizationId: string;
  tenantId: string; // ObjectId ref to tenants
  unitId?: string | null; // ObjectId ref to units (optional)
  category: ComplaintCategory;
  title: string;
  description: string;
  photos?: string[] | null; // URLs or base64
  priority: ComplaintPriority;
  status: ComplaintStatus;
  assignedTo?: string | null; // ObjectId ref to users
  resolvedAt?: Date | null;
  resolutionNotes?: string | null;
  // Maintenance request fields
  type?: ComplaintType; // 'complaint' | 'maintenance_request'
  maintenanceCategory?: MaintenanceCategory; // For maintenance requests
  urgency?: Urgency; // Separate from priority, for maintenance requests
  preferredTimeWindow?: {
    start: Date;
    end: Date;
  } | null;
  linkedWorkOrderId?: string | null; // Reference to work order if created
  createdAt: Date;
  updatedAt: Date;
}

export async function getComplaintsCollection(): Promise<Collection<Complaint>> {
  const db = await getDb();
  return db.collection<Complaint>(COMPLAINTS_COLLECTION_NAME);
}

export async function ensureComplaintIndexes(db?: Db): Promise<void> {
  const database = db ?? (await getDb());
  const collection = database.collection(COMPLAINTS_COLLECTION_NAME);

  const indexes: IndexDescription[] = [
    // Compound index on organizationId, tenantId, and status
    {
      key: { organizationId: 1, tenantId: 1, status: 1 },
      name: 'org_tenant_status',
    },
    // Compound index on organizationId, status, and priority
    {
      key: { organizationId: 1, status: 1, priority: 1 },
      name: 'org_status_priority',
    },
    // Index on assignedTo
    {
      key: { assignedTo: 1 },
      sparse: true,
      name: 'assignedTo',
    },
    // Index on type for filtering maintenance requests
    {
      key: { type: 1 },
      sparse: true,
      name: 'type',
    },
    // Index on maintenanceCategory
    {
      key: { maintenanceCategory: 1 },
      sparse: true,
      name: 'maintenanceCategory',
    },
    // Index on urgency
    {
      key: { urgency: 1 },
      sparse: true,
      name: 'urgency',
    },
    // Index on linkedWorkOrderId
    {
      key: { linkedWorkOrderId: 1 },
      sparse: true,
      name: 'linkedWorkOrderId',
    },
  ];

  await collection.createIndexes(indexes);
}

/**
 * Validates that a tenant exists and belongs to the same organization.
 * Throws an error if validation fails.
 */
async function validateTenantBelongsToOrg(tenantId: string, organizationId: string): Promise<void> {
  const tenant = await findTenantById(tenantId, organizationId);
  if (!tenant) {
    throw new Error('Tenant not found');
  }
  if (tenant.organizationId !== organizationId) {
    throw new Error('Tenant does not belong to the same organization');
  }
}

/**
 * Validates that a unit exists and belongs to the same organization (if provided).
 * Throws an error if validation fails.
 */
async function validateUnitBelongsToOrg(
  unitId: string | null | undefined,
  organizationId: string,
): Promise<void> {
  if (!unitId) {
    return; // Unit is optional
  }

  const unit = await findUnitById(unitId, organizationId);
  if (!unit) {
    throw new Error('Unit not found');
  }
  if (unit.organizationId !== organizationId) {
    throw new Error('Unit does not belong to the same organization');
  }
}

export interface CreateComplaintInput {
  organizationId: string;
  tenantId: string;
  unitId?: string | null;
  category: ComplaintCategory;
  title: string;
  description: string;
  photos?: string[] | null;
  priority?: ComplaintPriority;
  status?: ComplaintStatus;
  // Maintenance request fields
  type?: ComplaintType;
  maintenanceCategory?: MaintenanceCategory;
  urgency?: Urgency;
  preferredTimeWindow?: {
    start: Date;
    end: Date;
  } | null;
}

export async function createComplaint(input: CreateComplaintInput): Promise<Complaint> {
  const collection = await getComplaintsCollection();
  const now = new Date();

  // Validate tenant exists and belongs to same org
  await validateTenantBelongsToOrg(input.tenantId, input.organizationId);

  // Validate unit if provided
  await validateUnitBelongsToOrg(input.unitId, input.organizationId);

  // Validate required fields
  if (!input.title || !input.description || !input.category) {
    throw new Error('title, description, and category are required');
  }

  const doc: Omit<Complaint, '_id'> = {
    organizationId: input.organizationId,
    tenantId: input.tenantId,
    unitId: input.unitId ?? null,
    category: input.category,
    title: input.title.trim(),
    description: input.description.trim(),
    photos: input.photos ?? null,
    priority: input.priority ?? 'medium',
    status: input.status ?? 'open',
    assignedTo: null,
    resolvedAt: null,
    resolutionNotes: null,
    // Maintenance request fields
    type: input.type ?? 'complaint',
    ...(input.maintenanceCategory ? { maintenanceCategory: input.maintenanceCategory } : {}),
    ...(input.urgency ? { urgency: input.urgency } : {}),
    preferredTimeWindow: input.preferredTimeWindow ?? null,
    linkedWorkOrderId: null,
    createdAt: now,
    updatedAt: now,
  };

  const result = await collection.insertOne(doc as OptionalUnlessRequiredId<Complaint>);

  return {
    ...(doc as Complaint),
    _id: result.insertedId.toString(),
  } as Complaint;
}

export async function findComplaintById(
  complaintId: string,
  organizationId?: string,
): Promise<Complaint | null> {
  const collection = await getComplaintsCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const query: Record<string, unknown> = { _id: new ObjectId(complaintId) };
    if (organizationId) {
      query.organizationId = organizationId;
    }

    return collection.findOne(query as Document);
  } catch {
    return null;
  }
}

export async function findComplaintsByTenant(
  tenantId: string,
  organizationId?: string,
): Promise<Complaint[]> {
  const collection = await getComplaintsCollection();

  const query: Record<string, unknown> = {
    tenantId,
  };

  if (organizationId) {
    query.organizationId = organizationId;
  }

  return collection
    .find(query as Document)
    .sort({ createdAt: -1 })
    .toArray();
}

export async function findComplaintsByStatus(
  organizationId: string,
  status: ComplaintStatus,
): Promise<Complaint[]> {
  const collection = await getComplaintsCollection();

  const query: Record<string, unknown> = {
    organizationId,
    status,
  };

  return collection
    .find(query as Document)
    .sort({ priority: 1, createdAt: -1 })
    .toArray();
}

export async function updateComplaintStatus(
  complaintId: string,
  status: ComplaintStatus,
  assignedTo?: string | null,
  resolutionNotes?: string | null,
): Promise<Complaint | null> {
  const collection = await getComplaintsCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const existingComplaint = await findComplaintById(complaintId);
    if (!existingComplaint) {
      return null;
    }

    const now = new Date();
    const updateDoc: Record<string, unknown> = {
      status,
      updatedAt: now,
    };

    // If assignedTo is provided, update it
    if (assignedTo !== undefined) {
      updateDoc.assignedTo = assignedTo ?? null;
      // If assigning to someone, set status to "assigned" if it's currently "open"
      if (assignedTo && existingComplaint.status === 'open') {
        updateDoc.status = 'assigned';
      }
    }

    // If status is being changed to resolved or closed, set resolvedAt
    if (status === 'resolved' || status === 'closed') {
      if (!existingComplaint.resolvedAt) {
        updateDoc.resolvedAt = now;
      }
    } else {
      // If status is being changed from resolved/closed back to something else, clear resolvedAt
      if (existingComplaint.status === 'resolved' || existingComplaint.status === 'closed') {
        updateDoc.resolvedAt = null;
      }
    }

    // If resolutionNotes is provided, update it
    if (resolutionNotes !== undefined) {
      updateDoc.resolutionNotes = resolutionNotes ?? null;
    }

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(complaintId) } as Document,
      { $set: updateDoc } as Document,
      { returnDocument: 'after' },
    );

    return result as Complaint | null;
  } catch {
    return null;
  }
}

export async function updateComplaint(
  complaintId: string,
  updates: Partial<Complaint>,
): Promise<Complaint | null> {
  const collection = await getComplaintsCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const existingComplaint = await findComplaintById(complaintId);
    if (!existingComplaint) {
      return null;
    }

    const updateDoc: Record<string, unknown> = {
      ...updates,
      updatedAt: new Date(),
    };

    // Remove fields that shouldn't be updated directly
    delete updateDoc._id;
    delete updateDoc.organizationId;
    delete updateDoc.createdAt;

    // Trim string fields if present
    if (updateDoc.title && typeof updateDoc.title === 'string') {
      updateDoc.title = updateDoc.title.trim();
    }
    if (updateDoc.description && typeof updateDoc.description === 'string') {
      updateDoc.description = updateDoc.description.trim();
    }
    if (updateDoc.resolutionNotes && typeof updateDoc.resolutionNotes === 'string') {
      updateDoc.resolutionNotes = updateDoc.resolutionNotes.trim();
    }

    // Validate unit if being updated
    if (updateDoc.unitId !== undefined && updateDoc.unitId !== existingComplaint.unitId) {
      await validateUnitBelongsToOrg(
        updateDoc.unitId as string | null,
        existingComplaint.organizationId,
      );
    }

    // Handle status changes
    if (updates.status) {
      const now = new Date();
      // If status is being changed to resolved or closed, set resolvedAt
      if (updates.status === 'resolved' || updates.status === 'closed') {
        if (!existingComplaint.resolvedAt) {
          updateDoc.resolvedAt = now;
        }
      } else {
        // If status is being changed from resolved/closed back to something else, clear resolvedAt
        if (existingComplaint.status === 'resolved' || existingComplaint.status === 'closed') {
          updateDoc.resolvedAt = null;
        }
      }
    }

    // Handle assignedTo changes - if assigning to someone and status is "open", change to "assigned"
    if (updates.assignedTo !== undefined) {
      if (updates.assignedTo && (!updates.status || updates.status === 'open')) {
        updateDoc.status = 'assigned';
      }
    }

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(complaintId) } as Document,
      { $set: updateDoc } as Document,
      { returnDocument: 'after' },
    );

    return result as Complaint | null;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    return null;
  }
}

export async function listComplaints(query: Record<string, unknown> = {}): Promise<Complaint[]> {
  const collection = await getComplaintsCollection();

  return collection
    .find(query as Document)
    .sort({ priority: 1, createdAt: -1 })
    .toArray();
}
