import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { validateOrganizationAccess } from '@/lib/organizations/scoping';
import { findParkingAssignmentById, endParkingAssignment } from '@/lib/parking/parking-assignments';
import { createParkingInvoice } from '@/lib/invoices/invoices';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/parking/assignments/[id]/end
 * End a parking assignment and generate invoice if needed.
 * Requires parking.update permission.
 */
export async function POST(request: Request, routeParams: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    const { id } = await routeParams.params;

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to update parking
    try {
      requirePermission(context, 'parking', 'update');
    } catch {
      if (
        !context.roles.includes('SECURITY') &&
        !context.roles.includes('BUILDING_MANAGER') &&
        !context.roles.includes('FACILITY_MANAGER') &&
        !context.roles.includes('ORG_ADMIN')
      ) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    if (!context.organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    // Get existing assignment to validate organization access
    const existingAssignment = await findParkingAssignmentById(id, context.organizationId);

    if (!existingAssignment) {
      return NextResponse.json({ error: 'Parking assignment not found' }, { status: 404 });
    }

    // Validate organization access
    validateOrganizationAccess(context, existingAssignment.organizationId);

    const body = (await request.json()) as { endDate?: string; generateInvoice?: boolean };
    const endDate = body.endDate ? new Date(body.endDate) : undefined;
    const generateInvoice = body.generateInvoice !== false; // Default to true

    try {
      // End the assignment
      const { assignment, calculatedAmount } = await endParkingAssignment(id, endDate);

      let invoiceId = assignment.invoiceId;

      // Generate invoice if requested and not already generated
      if (generateInvoice && !invoiceId && calculatedAmount > 0) {
        try {
          // For tenant monthly parking, invoice is usually generated upfront
          // For visitor hourly/daily parking, generate invoice now
          if (assignment.assignmentType === 'visitor' || assignment.billingPeriod !== 'monthly') {
            const invoice = await createParkingInvoice({
              organizationId: context.organizationId,
              parkingAssignmentId: assignment._id,
              amount: calculatedAmount,
              description: `Parking fee - ${assignment.billingPeriod} (${assignment.assignmentType})`,
              periodStart: assignment.startDate,
              periodEnd: assignment.endDate || new Date(),
            });

            invoiceId = invoice._id;

            // Update assignment with invoice ID
            const { updateParkingAssignment } = await import('@/lib/parking/parking-assignments');
            await updateParkingAssignment(assignment._id, { invoiceId });
          }
        } catch (invoiceError) {
          console.error('Failed to generate parking invoice:', invoiceError);
          // Continue even if invoice generation fails
        }
      }

      return NextResponse.json({
        message: 'Parking assignment ended successfully',
        parkingAssignment: {
          _id: assignment._id,
          organizationId: assignment.organizationId,
          parkingSpaceId: assignment.parkingSpaceId,
          buildingId: assignment.buildingId,
          assignmentType: assignment.assignmentType,
          tenantId: assignment.tenantId,
          visitorLogId: assignment.visitorLogId,
          vehicleId: assignment.vehicleId,
          startDate: assignment.startDate,
          endDate: assignment.endDate,
          pricingId: assignment.pricingId,
          billingPeriod: assignment.billingPeriod,
          rate: assignment.rate,
          invoiceId: invoiceId || assignment.invoiceId,
          status: assignment.status,
          createdAt: assignment.createdAt,
          updatedAt: assignment.updatedAt,
        },
        calculatedAmount,
        invoiceGenerated: !!invoiceId && invoiceId !== assignment.invoiceId,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return NextResponse.json({ error: error.message }, { status: 404 });
        }
        if (error.message.includes('Only active assignments')) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
        if (error.message.includes('does not have an active lease')) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
      }
      throw error;
    }
  } catch (error) {
    console.error('End parking assignment error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('does not have an organization ID')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('belongs to a different organization')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }
    return NextResponse.json(
      { error: 'Unexpected error while ending parking assignment' },
      { status: 500 },
    );
  }
}
