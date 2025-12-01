import type { Collection, Db, IndexDescription, Document, OptionalUnlessRequiredId } from 'mongodb';
import { getDb } from '@/lib/db';
import { findMeterById, updateMeter } from '@/lib/meters/meters';

const METER_READINGS_COLLECTION_NAME = 'meterReadings';

export type MeterReadingSource = 'manual' | 'iot' | 'import';

export interface MeterReading {
  _id: string;
  organizationId: string;
  meterId: string; // ObjectId ref to meters
  reading: number; // Reading value
  readingDate: Date; // Date of reading
  readBy?: string | null; // ObjectId ref to users
  source: MeterReadingSource; // How reading was entered
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function getMeterReadingsCollection(): Promise<Collection<MeterReading>> {
  const db = await getDb();
  return db.collection<MeterReading>(METER_READINGS_COLLECTION_NAME);
}

export async function ensureMeterReadingIndexes(db?: Db): Promise<void> {
  const database = db ?? (await getDb());
  const collection = database.collection(METER_READINGS_COLLECTION_NAME);

  const indexes: IndexDescription[] = [
    // Compound index on organizationId, meterId, and readingDate (descending for latest)
    {
      key: { organizationId: 1, meterId: 1, readingDate: -1 },
      name: 'org_meter_reading_date_desc',
    },
    // Index on readingDate
    {
      key: { readingDate: -1 },
      name: 'readingDate_desc',
    },
    // Index on meterId for quick lookups
    {
      key: { meterId: 1 },
      name: 'meterId',
    },
  ];

  await collection.createIndexes(indexes);
}

/**
 * Validates that a meter exists and belongs to the same organization.
 */
async function validateMeterBelongsToOrg(meterId: string, organizationId: string): Promise<void> {
  const meter = await findMeterById(meterId, organizationId);
  if (!meter) {
    throw new Error('Meter not found');
  }
  if (meter.organizationId !== organizationId) {
    throw new Error('Meter does not belong to the same organization');
  }
}

export interface CreateMeterReadingInput {
  organizationId: string;
  meterId: string;
  reading: number;
  readingDate: Date;
  readBy?: string | null;
  source?: MeterReadingSource;
  notes?: string | null;
  allowDecrease?: boolean; // Allow reading to be less than last reading (for corrections)
}

export async function createMeterReading(input: CreateMeterReadingInput): Promise<MeterReading> {
  const collection = await getMeterReadingsCollection();
  const now = new Date();

  // Validate meter exists and belongs to same org
  await validateMeterBelongsToOrg(input.meterId, input.organizationId);

  // Get the meter to check last reading
  const meter = await findMeterById(input.meterId, input.organizationId);
  if (!meter) {
    throw new Error('Meter not found');
  }

  // Validate reading is greater than last reading (unless allowDecrease is true)
  if (!input.allowDecrease && meter.lastReading !== null && meter.lastReading !== undefined) {
    if (input.reading < meter.lastReading) {
      throw new Error(
        `Reading (${input.reading}) must be greater than or equal to last reading (${meter.lastReading}). Set allowDecrease=true for corrections.`,
      );
    }
  }

  // Validate required fields
  if (input.reading === null || input.reading === undefined || input.reading < 0) {
    throw new Error('reading must be a non-negative number');
  }

  const doc: Omit<MeterReading, '_id'> = {
    organizationId: input.organizationId,
    meterId: input.meterId,
    reading: input.reading,
    readingDate: input.readingDate,
    readBy: input.readBy ?? null,
    source: input.source ?? 'manual',
    notes: input.notes ?? null,
    createdAt: now,
    updatedAt: now,
  };

  const result = await collection.insertOne(doc as OptionalUnlessRequiredId<MeterReading>);

  const meterReading = {
    ...(doc as MeterReading),
    _id: result.insertedId.toString(),
  } as MeterReading;

  // Update meter's lastReading and lastReadingDate
  // Only update if this reading is newer than the current lastReadingDate
  const shouldUpdateMeter =
    !meter.lastReadingDate ||
    input.readingDate >= meter.lastReadingDate ||
    // Also update if the reading is higher than current lastReading
    (meter.lastReading !== null &&
      meter.lastReading !== undefined &&
      input.reading > meter.lastReading);

  if (shouldUpdateMeter) {
    await updateMeter(input.meterId, {
      lastReading: input.reading,
      lastReadingDate: input.readingDate,
    });
  }

  return meterReading;
}

export async function findMeterReadingById(
  readingId: string,
  organizationId?: string,
): Promise<MeterReading | null> {
  const collection = await getMeterReadingsCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const query: Record<string, unknown> = { _id: new ObjectId(readingId) };
    if (organizationId) {
      query.organizationId = organizationId;
    }

    return collection.findOne(query as Document);
  } catch {
    return null;
  }
}

export async function findMeterReadingsByMeter(
  meterId: string,
  organizationId?: string,
  limit?: number,
): Promise<MeterReading[]> {
  const collection = await getMeterReadingsCollection();

  const query: Record<string, unknown> = {
    meterId,
  };

  if (organizationId) {
    query.organizationId = organizationId;
  }

  let cursor = collection.find(query as Document).sort({ readingDate: -1 }); // Latest first

  if (limit && limit > 0) {
    cursor = cursor.limit(limit);
  }

  return cursor.toArray();
}

export async function getLatestReading(
  meterId: string,
  organizationId?: string,
): Promise<MeterReading | null> {
  const readings = await findMeterReadingsByMeter(meterId, organizationId, 1);
  return readings.length > 0 ? (readings[0] ?? null) : null;
}

/**
 * Calculate consumption between two readings for a meter.
 * Returns the difference in reading values between start and end dates.
 */
export async function calculateConsumption(
  meterId: string,
  startDate: Date,
  endDate: Date,
  organizationId?: string,
): Promise<number | null> {
  const collection = await getMeterReadingsCollection();

  // Validate meter exists if organizationId is provided
  if (organizationId) {
    await validateMeterBelongsToOrg(meterId, organizationId);
  }

  // Find readings within the date range, sorted by date
  const query: Record<string, unknown> = {
    meterId,
    readingDate: {
      $gte: startDate,
      $lte: endDate,
    },
  };

  if (organizationId) {
    query.organizationId = organizationId;
  }

  const readings = await collection
    .find(query as Document)
    .sort({ readingDate: 1 }) // Oldest first
    .toArray();

  if (readings.length < 2) {
    // Need at least 2 readings to calculate consumption
    return null;
  }

  const firstReading = readings[0]?.reading ?? null;
  const lastReading = readings[readings.length - 1]?.reading ?? null;

  if (firstReading === null || lastReading === null) {
    return null;
  }

  // Consumption is the difference
  return lastReading - firstReading;
}

export async function updateMeterReading(
  readingId: string,
  updates: Partial<MeterReading>,
): Promise<MeterReading | null> {
  const collection = await getMeterReadingsCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const existingReading = await findMeterReadingById(readingId);
    if (!existingReading) {
      return null;
    }

    const updateDoc: Record<string, unknown> = {
      ...updates,
      updatedAt: new Date(),
    };

    // Remove fields that shouldn't be updated directly
    delete updateDoc._id;
    delete updateDoc.organizationId;
    delete updateDoc.meterId;
    delete updateDoc.createdAt;

    // Convert date strings to Date objects if present
    if (updateDoc.readingDate && typeof updateDoc.readingDate === 'string') {
      updateDoc.readingDate = new Date(updateDoc.readingDate);
    }

    // Validate reading if being updated
    if (updateDoc.reading !== undefined) {
      const readingValue = updateDoc.reading;
      if (typeof readingValue === 'number' && readingValue < 0) {
        throw new Error('reading must be a non-negative number');
      }
    }

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(readingId) } as Document,
      { $set: updateDoc } as Document,
      { returnDocument: 'after' },
    );

    const updatedReading = result as MeterReading | null;

    // If reading or readingDate was updated, update the meter's lastReading/lastReadingDate
    if (updatedReading && (updates.reading !== undefined || updates.readingDate !== undefined)) {
      // Get the latest reading for this meter
      const latestReading = await getLatestReading(
        existingReading.meterId,
        existingReading.organizationId,
      );

      if (latestReading) {
        await updateMeter(existingReading.meterId, {
          lastReading: latestReading.reading,
          lastReadingDate: latestReading.readingDate,
        });
      }
    }

    return updatedReading;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    return null;
  }
}

export async function deleteMeterReading(readingId: string): Promise<boolean> {
  const collection = await getMeterReadingsCollection();
  const { ObjectId } = await import('mongodb');

  try {
    // Get the reading to know which meter to update
    const reading = await findMeterReadingById(readingId);
    if (!reading) {
      return false;
    }

    const result = await collection.deleteOne({ _id: new ObjectId(readingId) } as Document);

    if (result.deletedCount > 0) {
      // Update the meter's lastReading and lastReadingDate based on the new latest reading
      const latestReading = await getLatestReading(reading.meterId, reading.organizationId);

      if (latestReading) {
        await updateMeter(reading.meterId, {
          lastReading: latestReading.reading,
          lastReadingDate: latestReading.readingDate,
        });
      } else {
        // No more readings, clear meter's lastReading and lastReadingDate
        await updateMeter(reading.meterId, {
          lastReading: null,
          lastReadingDate: null,
        });
      }

      return true;
    }

    return false;
  } catch {
    return false;
  }
}

export async function listMeterReadings(
  query: Record<string, unknown> = {},
): Promise<MeterReading[]> {
  const collection = await getMeterReadingsCollection();

  return collection
    .find(query as Document)
    .sort({ readingDate: -1 })
    .toArray();
}
