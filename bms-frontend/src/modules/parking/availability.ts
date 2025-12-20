import { findParkingSpacesByBuilding } from '@/lib/parking/parking-spaces';
import { findActiveAssignments } from '@/lib/parking/parking-assignments';
import type { ParkingSpaceType, ParkingSpaceStatus } from '@/lib/parking/parking-spaces';

export interface ParkingAvailability {
  total: number;
  available: number;
  occupied: number;
  reserved: number;
  maintenance: number;
  byType: {
    tenant: {
      total: number;
      available: number;
      occupied: number;
    };
    visitor: {
      total: number;
      available: number;
      occupied: number;
    };
    reserved: {
      total: number;
      available: number;
      occupied: number;
    };
  };
  availableSpaces: Array<{
    _id: string;
    spaceNumber: string;
    spaceType: ParkingSpaceType;
  }>;
}

/**
 * Calculates real-time parking availability for a building.
 * Available = status = 'available' AND no active assignment
 * Occupied = status = 'occupied' OR has active assignment
 */
export async function calculateParkingAvailability(
  buildingId: string,
  organizationId: string,
): Promise<ParkingAvailability> {
  // Get all parking spaces for the building
  const spaces = await findParkingSpacesByBuilding(buildingId, organizationId);

  // Get all active assignments for the building
  const activeAssignments = await findActiveAssignments({
    organizationId,
    buildingId,
  });

  // Create a set of parking space IDs that have active assignments
  const assignedSpaceIds = new Set(activeAssignments.map((a) => a.parkingSpaceId));

  // Initialize counters
  const stats = {
    total: spaces.length,
    available: 0,
    occupied: 0,
    reserved: 0,
    maintenance: 0,
    byType: {
      tenant: { total: 0, available: 0, occupied: 0 },
      visitor: { total: 0, available: 0, occupied: 0 },
      reserved: { total: 0, available: 0, occupied: 0 },
    },
    availableSpaces: [] as Array<{ _id: string; spaceNumber: string; spaceType: ParkingSpaceType }>,
  };

  for (const space of spaces) {
    // Count by status
    if (space.status === 'reserved') {
      stats.reserved++;
    } else if (space.status === 'maintenance') {
      stats.maintenance++;
    } else if (space.status === 'available' && !assignedSpaceIds.has(space._id)) {
      stats.available++;
      stats.availableSpaces.push({
        _id: space._id,
        spaceNumber: space.spaceNumber,
        spaceType: space.spaceType,
      });
    } else {
      stats.occupied++;
    }

    // Count by type
    if (space.spaceType === 'tenant') {
      stats.byType.tenant.total++;
      if (space.status === 'available' && !assignedSpaceIds.has(space._id)) {
        stats.byType.tenant.available++;
      } else {
        stats.byType.tenant.occupied++;
      }
    } else if (space.spaceType === 'visitor') {
      stats.byType.visitor.total++;
      if (space.status === 'available' && !assignedSpaceIds.has(space._id)) {
        stats.byType.visitor.available++;
      } else {
        stats.byType.visitor.occupied++;
      }
    } else if (space.spaceType === 'reserved') {
      stats.byType.reserved.total++;
      if (space.status === 'available' && !assignedSpaceIds.has(space._id)) {
        stats.byType.reserved.available++;
      } else {
        stats.byType.reserved.occupied++;
      }
    }
  }

  return stats;
}

