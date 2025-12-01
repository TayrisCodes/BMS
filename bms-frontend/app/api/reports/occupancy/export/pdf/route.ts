import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
import { requirePermission } from '@/lib/auth/authz';
import { findBuildingsByOrganization, findBuildingById } from '@/lib/buildings/buildings';
import { findUnitsByBuilding, listUnits } from '@/lib/units/units';
import { findActiveLeaseForUnit } from '@/lib/leases/leases';
import { findOrganizationById } from '@/lib/organizations/organizations';
import { renderToBuffer } from '@react-pdf/renderer';
import { generateOccupancyReportPDF, type OccupancyReportData } from '@/modules/reports/export/pdf';

/**
 * GET /api/reports/occupancy/export/pdf
 * Export occupancy report as PDF.
 * Requires ORG_ADMIN, ACCOUNTANT, or BUILDING_MANAGER role.
 */
export async function GET(request: Request) {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to read units and leases
    requirePermission(context, 'units', 'read');
    requirePermission(context, 'leases', 'read');

    const organizationId = context.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const buildingId = searchParams.get('buildingId') || undefined;

    // If buildingId is specified, validate it belongs to the organization
    if (buildingId) {
      const building = await findBuildingById(buildingId, organizationId);
      if (!building || building.organizationId !== organizationId) {
        return NextResponse.json(
          { error: 'Building not found or does not belong to organization' },
          { status: 404 },
        );
      }
    }

    // Get units
    let units;
    if (buildingId) {
      units = await findUnitsByBuilding(buildingId);
    } else {
      // Get all units for the organization
      units = await listUnits({ organizationId });
    }

    // Calculate occupancy statistics
    const totalUnits = units.length;
    let occupiedUnits = 0;
    let availableUnits = 0;
    let maintenanceUnits = 0;
    let reservedUnits = 0;

    // Check each unit for active lease
    for (const unit of units) {
      if (unit.status === 'occupied') {
        // Double-check by finding active lease
        const activeLease = await findActiveLeaseForUnit(unit._id, organizationId);
        if (activeLease) {
          occupiedUnits += 1;
        } else {
          // Unit status says occupied but no active lease - might be stale
          availableUnits += 1;
        }
      } else if (unit.status === 'available') {
        availableUnits += 1;
      } else if (unit.status === 'maintenance') {
        maintenanceUnits += 1;
      } else if (unit.status === 'reserved') {
        reservedUnits += 1;
      }
    }

    const vacancyRate = totalUnits > 0 ? (availableUnits / totalUnits) * 100 : 0;
    const occupancyRate = totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0;

    // Occupancy by building (if org-level, not building-specific)
    const occupancyByBuilding: Array<{
      buildingId: string;
      buildingName: string;
      totalUnits: number;
      occupiedUnits: number;
      availableUnits: number;
      maintenanceUnits: number;
      reservedUnits: number;
      occupancyRate: number;
      vacancyRate: number;
    }> = [];

    if (!buildingId) {
      // Get all buildings for the organization
      const buildings = await findBuildingsByOrganization(organizationId);

      for (const building of buildings) {
        const buildingUnits = await findUnitsByBuilding(building._id);
        let bldgOccupied = 0;
        let bldgAvailable = 0;
        let bldgMaintenance = 0;
        let bldgReserved = 0;

        for (const unit of buildingUnits) {
          if (unit.status === 'occupied') {
            const activeLease = await findActiveLeaseForUnit(unit._id, organizationId);
            if (activeLease) {
              bldgOccupied += 1;
            } else {
              bldgAvailable += 1;
            }
          } else if (unit.status === 'available') {
            bldgAvailable += 1;
          } else if (unit.status === 'maintenance') {
            bldgMaintenance += 1;
          } else if (unit.status === 'reserved') {
            bldgReserved += 1;
          }
        }

        const bldgTotal = buildingUnits.length;
        const bldgOccupancyRate = bldgTotal > 0 ? (bldgOccupied / bldgTotal) * 100 : 0;
        const bldgVacancyRate = bldgTotal > 0 ? (bldgAvailable / bldgTotal) * 100 : 0;

        occupancyByBuilding.push({
          buildingId: building._id,
          buildingName: building.name,
          totalUnits: bldgTotal,
          occupiedUnits: bldgOccupied,
          availableUnits: bldgAvailable,
          maintenanceUnits: bldgMaintenance,
          reservedUnits: bldgReserved,
          occupancyRate: Math.round(bldgOccupancyRate * 100) / 100,
          vacancyRate: Math.round(bldgVacancyRate * 100) / 100,
        });
      }
    }

    // Get organization details
    const organization = await findOrganizationById(organizationId);
    const orgName = organization?.name || 'Unknown Organization';

    // Prepare report data
    const reportData: OccupancyReportData = {
      summary: {
        totalUnits,
        occupiedUnits,
        availableUnits,
        maintenanceUnits,
        reservedUnits,
        occupancyRate: Math.round(occupancyRate * 100) / 100,
        vacancyRate: Math.round(vacancyRate * 100) / 100,
      },
      occupancyByBuilding: occupancyByBuilding.length > 0 ? occupancyByBuilding : null,
    };

    // Generate PDF
    const pdfDoc = generateOccupancyReportPDF(reportData, orgName);
    const pdfBuffer = await renderToBuffer(pdfDoc as any);

    // Generate filename
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `occupancy-report-${dateStr}.pdf`;

    // Return PDF file
    return new NextResponse(pdfBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Occupancy PDF export error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
    }
    return NextResponse.json(
      { error: 'Unexpected error while exporting occupancy report' },
      { status: 500 },
    );
  }
}
