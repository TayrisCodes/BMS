import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { withOrganizationScope } from '@/lib/organizations/scoping';
import {
  createUtilityPayment,
  listUtilityPayments,
  type CreateUtilityPaymentInput,
  type UtilityType,
} from '@/lib/utilities/utility-payments';

/**
 * GET /api/utility-payments
 * List utility payments with optional filters.
 * Requires utilities.read permission.
 */
export async function GET(request: Request) {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to read utilities
    try {
      requirePermission(context, 'utilities', 'read');
    } catch {
      // Fallback: Allow FACILITY_MANAGER, BUILDING_MANAGER, ORG_ADMIN to read utility payments
      if (
        !context.roles.includes('FACILITY_MANAGER') &&
        !context.roles.includes('BUILDING_MANAGER') &&
        !context.roles.includes('ORG_ADMIN')
      ) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    if (!context.organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const meterId = searchParams.get('meterId');
    const utilityType = searchParams.get('utilityType') as UtilityType | null;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = parseInt(searchParams.get('limit') || '50');

    const filters: Parameters<typeof listUtilityPayments>[0] = {
      organizationId: context.organizationId,
    };

    if (meterId) {
      filters.meterId = meterId;
    }

    if (utilityType) {
      filters.utilityType = utilityType;
    }

    if (startDate) {
      filters.startDate = new Date(startDate);
    }

    if (endDate) {
      filters.endDate = new Date(endDate);
    }

    const payments = await listUtilityPayments(filters);

    // Apply limit
    const limitedPayments = payments.slice(0, limit);

    return NextResponse.json({
      utilityPayments: limitedPayments.map((payment) => ({
        _id: payment._id,
        organizationId: payment.organizationId,
        meterId: payment.meterId,
        utilityType: payment.utilityType,
        periodStart: payment.periodStart,
        periodEnd: payment.periodEnd,
        amount: payment.amount,
        paymentDate: payment.paymentDate,
        paymentMethod: payment.paymentMethod,
        receiptUrl: payment.receiptUrl,
        receiptFileName: payment.receiptFileName,
        notes: payment.notes,
        createdBy: payment.createdBy,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt,
      })),
      count: limitedPayments.length,
      total: payments.length,
    });
  } catch (error) {
    console.error('Get utility payments error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
      if (error.message.includes('Organization ID is required')) {
        return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
      }
    }
    return NextResponse.json(
      { error: 'Unexpected error while fetching utility payments' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/utility-payments
 * Create a new utility payment.
 * Requires utilities.update permission.
 */
export async function POST(request: Request) {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to update utilities
    try {
      requirePermission(context, 'utilities', 'update');
    } catch {
      // Fallback: Allow FACILITY_MANAGER, BUILDING_MANAGER, ORG_ADMIN to create utility payments
      if (
        !context.roles.includes('FACILITY_MANAGER') &&
        !context.roles.includes('BUILDING_MANAGER') &&
        !context.roles.includes('ORG_ADMIN')
      ) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    if (!context.organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    const body = (await request.json()) as CreateUtilityPaymentInput;

    // Validate required fields
    if (!body.meterId || !body.utilityType || !body.amount || !body.paymentDate) {
      return NextResponse.json(
        {
          error: 'meterId, utilityType, amount, and paymentDate are required',
        },
        { status: 400 },
      );
    }

    // Create utility payment
    const input: CreateUtilityPaymentInput = {
      organizationId: context.organizationId,
      meterId: body.meterId,
      utilityType: body.utilityType,
      periodStart: body.periodStart || new Date(),
      periodEnd: body.periodEnd || new Date(),
      amount: body.amount,
      paymentDate: body.paymentDate,
      paymentMethod: body.paymentMethod || 'other',
      receiptUrl: body.receiptUrl || null,
      receiptFileName: body.receiptFileName || null,
      notes: body.notes || null,
      createdBy: body.createdBy || context.userId || null,
    };

    try {
      const payment = await createUtilityPayment(input);

      return NextResponse.json(
        {
          message: 'Utility payment created successfully',
          utilityPayment: {
            _id: payment._id,
            organizationId: payment.organizationId,
            meterId: payment.meterId,
            utilityType: payment.utilityType,
            periodStart: payment.periodStart,
            periodEnd: payment.periodEnd,
            amount: payment.amount,
            paymentDate: payment.paymentDate,
            paymentMethod: payment.paymentMethod,
            receiptUrl: payment.receiptUrl,
            receiptFileName: payment.receiptFileName,
            notes: payment.notes,
            createdBy: payment.createdBy,
            createdAt: payment.createdAt,
            updatedAt: payment.updatedAt,
          },
        },
        { status: 201 },
      );
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Meter not found')) {
          return NextResponse.json({ error: error.message }, { status: 404 });
        }
        if (error.message.includes('does not belong to the same organization')) {
          return NextResponse.json({ error: error.message }, { status: 403 });
        }
        if (error.message.includes('Invalid') || error.message.includes('must be')) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
      }
      throw error;
    }
  } catch (error) {
    console.error('Create utility payment error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
      if (error.message.includes('Organization ID is required')) {
        return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
      }
    }
    return NextResponse.json(
      { error: 'Unexpected error while creating utility payment' },
      { status: 500 },
    );
  }
}
