import type { Collection, Db, IndexDescription, Document, OptionalUnlessRequiredId } from 'mongodb';
import { getDb } from '@/lib/db';
import { findBuildingById } from '@/lib/buildings/buildings';
import { findUnitById } from '@/lib/units/units';
import { findVisitorLogById } from './visitor-logs';

const INCIDENTS_COLLECTION_NAME = 'securityIncidents';

export type IncidentType =
  | 'theft'
  | 'vandalism'
  | 'trespassing'
  | 'violence'
  | 'suspicious_activity'
  | 'fire'
  | 'medical'
  | 'other';

export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';
export type IncidentStatus = 'reported' | 'under_investigation' | 'resolved' | 'closed';

export interface SecurityIncident {
  _id: string;
  organizationId: string;
  buildingId: string;
  unitId?: string | null;
  incidentType: IncidentType;
  severity: IncidentSeverity;
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
  status: IncidentStatus;
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

export async function getIncidentsCollection(): Promise<Collection<SecurityIncident>> {
  const db = await getDb();
  return db.collection<SecurityIncident>(INCIDENTS_COLLECTION_NAME);
}

export async function ensureIncidentIndexes(db?: Db): Promise<void> {
  const database = db ?? (await getDb());
  const collection = database.collection(INCIDENTS_COLLECTION_NAME);

  const indexes: IndexDescription[] = [
    // Compound index on organizationId, buildingId, and reportedAt
    {
      key: { organizationId: 1, buildingId: 1, reportedAt: -1 },
      name: 'org_building_reported_at',
    },
    // Index on incidentType
    {
      key: { incidentType: 1 },
      name: 'incidentType',
    },
    // Index on severity
    {
      key: { severity: 1 },
      name: 'severity',
    },
    // Index on status
    {
      key: { status: 1 },
      name: 'status',
    },
    // Index on reportedBy
    {
      key: { reportedBy: 1 },
      name: 'reportedBy',
    },
    // Index on unitId (sparse)
    {
      key: { unitId: 1 },
      sparse: true,
      name: 'unitId_sparse',
    },
    // Index on linkedVisitorLogId (sparse)
    {
      key: { linkedVisitorLogId: 1 },
      sparse: true,
      name: 'linkedVisitorLogId_sparse',
    },
    // Index on linkedComplaintId (sparse)
    {
      key: { linkedComplaintId: 1 },
      sparse: true,
      name: 'linkedComplaintId_sparse',
    },
    // Compound index for analytics queries
    {
      key: { organizationId: 1, buildingId: 1, incidentType: 1, severity: 1, status: 1 },
      name: 'analytics_index',
    },
  ];

  await collection.createIndexes(indexes);
}

/**
 * Validates that a building exists and belongs to the same organization.
 */
async function validateBuildingBelongsToOrg(
  buildingId: string,
  organizationId: string,
): Promise<void> {
  const building = await findBuildingById(buildingId, organizationId);
  if (!building) {
    throw new Error('Building not found');
  }
  if (building.organizationId !== organizationId) {
    throw new Error('Building does not belong to the same organization');
  }
}

/**
 * Validates that a unit exists and belongs to the same organization (if provided).
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

/**
 * Validates that a visitor log exists and belongs to the same organization (if provided).
 */
async function validateVisitorLogBelongsToOrg(
  visitorLogId: string | null | undefined,
  organizationId: string,
): Promise<void> {
  if (!visitorLogId) {
    return; // Visitor log is optional
  }

  const visitorLog = await findVisitorLogById(visitorLogId, organizationId);
  if (!visitorLog) {
    throw new Error('Visitor log not found');
  }
  if (visitorLog.organizationId !== organizationId) {
    throw new Error('Visitor log does not belong to the same organization');
  }
}

export interface CreateIncidentInput {
  organizationId: string;
  buildingId: string;
  unitId?: string | null;
  incidentType: IncidentType;
  severity: IncidentSeverity;
  title: string;
  description: string;
  location?: string | null;
  reportedBy: string;
  reportedAt?: Date;
  involvedParties?: Array<{
    name: string;
    role: 'tenant' | 'visitor' | 'staff' | 'unknown';
    contactInfo?: string | null;
  }> | null;
  status?: IncidentStatus;
  linkedVisitorLogId?: string | null;
  linkedComplaintId?: string | null;
}

export async function createIncident(input: CreateIncidentInput): Promise<SecurityIncident> {
  const collection = await getIncidentsCollection();
  const now = new Date();

  // Validate building
  await validateBuildingBelongsToOrg(input.buildingId, input.organizationId);

  // Validate unit if provided
  await validateUnitBelongsToOrg(input.unitId, input.organizationId);

  // Validate visitor log if provided
  await validateVisitorLogBelongsToOrg(input.linkedVisitorLogId, input.organizationId);

  // Validate required fields
  if (!input.title || !input.description || !input.reportedBy) {
    throw new Error('title, description, and reportedBy are required');
  }

  const doc: Omit<SecurityIncident, '_id'> = {
    organizationId: input.organizationId,
    buildingId: input.buildingId,
    unitId: input.unitId ?? null,
    incidentType: input.incidentType,
    severity: input.severity,
    title: input.title.trim(),
    description: input.description.trim(),
    location: input.location?.trim() ?? null,
    reportedBy: input.reportedBy,
    reportedAt: input.reportedAt ?? now,
    involvedParties: input.involvedParties ?? null,
    status: input.status ?? 'reported',
    resolvedAt: null,
    resolutionNotes: null,
    resolvedBy: null,
    photos: null,
    documents: null,
    linkedVisitorLogId: input.linkedVisitorLogId ?? null,
    linkedComplaintId: input.linkedComplaintId ?? null,
    createdAt: now,
    updatedAt: now,
  };

  const result = await collection.insertOne(doc as OptionalUnlessRequiredId<SecurityIncident>);

  return {
    ...(doc as SecurityIncident),
    _id: result.insertedId.toString(),
  } as SecurityIncident;
}

export async function findIncidentById(
  incidentId: string,
  organizationId?: string,
): Promise<SecurityIncident | null> {
  const collection = await getIncidentsCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const query: Record<string, unknown> = { _id: new ObjectId(incidentId) };
    if (organizationId) {
      query.organizationId = organizationId;
    }

    return collection.findOne(query as Document);
  } catch {
    return null;
  }
}

export async function findIncidentsByBuilding(
  buildingId: string,
  organizationId?: string,
  filters?: Record<string, unknown>,
): Promise<SecurityIncident[]> {
  const collection = await getIncidentsCollection();

  const query: Record<string, unknown> = {
    buildingId,
    ...filters,
  };

  if (organizationId) {
    query.organizationId = organizationId;
  }

  return collection
    .find(query as Document)
    .sort({ reportedAt: -1 })
    .toArray();
}

export async function findIncidentsByReporter(
  reportedBy: string,
  organizationId?: string,
  filters?: Record<string, unknown>,
): Promise<SecurityIncident[]> {
  const collection = await getIncidentsCollection();

  const query: Record<string, unknown> = {
    reportedBy,
    ...filters,
  };

  if (organizationId) {
    query.organizationId = organizationId;
  }

  return collection
    .find(query as Document)
    .sort({ reportedAt: -1 })
    .toArray();
}

export async function listIncidents(
  organizationId: string,
  filters?: Record<string, unknown>,
): Promise<SecurityIncident[]> {
  const collection = await getIncidentsCollection();

  const query: Record<string, unknown> = {
    organizationId,
    ...filters,
  };

  return collection
    .find(query as Document)
    .sort({ reportedAt: -1 })
    .toArray();
}

export async function updateIncident(
  incidentId: string,
  updates: Partial<
    CreateIncidentInput & {
      status?: IncidentStatus;
      resolvedAt?: Date | null;
      resolutionNotes?: string | null;
      resolvedBy?: string | null;
      photos?: string[] | null;
      documents?: string[] | null;
    }
  >,
  organizationId?: string,
): Promise<SecurityIncident | null> {
  const collection = await getIncidentsCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const existing = await findIncidentById(incidentId, organizationId);
    if (!existing) {
      return null;
    }

    // Validate building if being updated
    if (updates.buildingId !== undefined && updates.buildingId !== existing.buildingId) {
      await validateBuildingBelongsToOrg(updates.buildingId, existing.organizationId);
    }

    // Validate unit if being updated
    if (updates.unitId !== undefined && updates.unitId !== existing.unitId) {
      await validateUnitBelongsToOrg(updates.unitId, existing.organizationId);
    }

    // Validate visitor log if being updated
    if (
      updates.linkedVisitorLogId !== undefined &&
      updates.linkedVisitorLogId !== existing.linkedVisitorLogId
    ) {
      await validateVisitorLogBelongsToOrg(updates.linkedVisitorLogId, existing.organizationId);
    }

    const updateDoc: Record<string, unknown> = {
      ...updates,
      updatedAt: new Date(),
    };

    // Remove fields that shouldn't be updated directly
    delete updateDoc.organizationId;
    delete updateDoc.reportedBy;
    delete updateDoc.reportedAt;
    delete updateDoc.createdAt;

    // Trim string fields if present
    if (updateDoc.title && typeof updateDoc.title === 'string') {
      updateDoc.title = updateDoc.title.trim();
    }
    if (updateDoc.description && typeof updateDoc.description === 'string') {
      updateDoc.description = updateDoc.description.trim();
    }
    if (updateDoc.location && typeof updateDoc.location === 'string') {
      updateDoc.location = updateDoc.location.trim();
    }
    if (updateDoc.resolutionNotes && typeof updateDoc.resolutionNotes === 'string') {
      updateDoc.resolutionNotes = updateDoc.resolutionNotes.trim();
    }

    // If status is being set to resolved, set resolvedAt if not provided
    if (updates.status === 'resolved' && !updates.resolvedAt && !existing.resolvedAt) {
      updateDoc.resolvedAt = new Date();
    }

    // If status is being set to closed, ensure it was resolved first
    if (
      updates.status === 'closed' &&
      existing.status !== 'resolved' &&
      !updates.resolvedAt &&
      !existing.resolvedAt
    ) {
      updateDoc.resolvedAt = new Date();
    }

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(incidentId) } as Document,
      { $set: updateDoc } as Document,
      { returnDocument: 'after' },
    );

    return result as SecurityIncident | null;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    return null;
  }
}

export async function addIncidentPhoto(
  incidentId: string,
  photoUrl: string,
  organizationId?: string,
): Promise<SecurityIncident | null> {
  const collection = await getIncidentsCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const existing = await findIncidentById(incidentId, organizationId);
    if (!existing) {
      return null;
    }

    const photos = existing.photos ?? [];
    if (!photos.includes(photoUrl)) {
      photos.push(photoUrl);
    }

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(incidentId) } as Document,
      {
        $set: {
          photos,
          updatedAt: new Date(),
        },
      } as Document,
      { returnDocument: 'after' },
    );

    return result as SecurityIncident | null;
  } catch {
    return null;
  }
}

export async function addIncidentDocument(
  incidentId: string,
  documentId: string,
  organizationId?: string,
): Promise<SecurityIncident | null> {
  const collection = await getIncidentsCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const existing = await findIncidentById(incidentId, organizationId);
    if (!existing) {
      return null;
    }

    const documents = existing.documents ?? [];
    if (!documents.includes(documentId)) {
      documents.push(documentId);
    }

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(incidentId) } as Document,
      {
        $set: {
          documents,
          updatedAt: new Date(),
        },
      } as Document,
      { returnDocument: 'after' },
    );

    return result as SecurityIncident | null;
  } catch {
    return null;
  }
}

export async function deleteIncident(
  incidentId: string,
  organizationId?: string,
): Promise<boolean> {
  const collection = await getIncidentsCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const query: Record<string, unknown> = { _id: new ObjectId(incidentId) };
    if (organizationId) {
      query.organizationId = organizationId;
    }

    const result = await collection.deleteOne(query as Document);
    return result.deletedCount > 0;
  } catch {
    return false;
  }
}

