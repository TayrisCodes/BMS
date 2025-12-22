import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import {
  findCurrencyByCode,
  updateCurrency,
  type UpdateCurrencyInput,
} from '@/lib/currencies/currencies';

interface RouteParams {
  params: Promise<{ code: string }>;
}

/**
 * PUT /api/settings/currencies/[code]
 * Update a currency by code.
 * Requires settings.update permission.
 */
export async function PUT(request: Request, routeParams: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    const { code } = await routeParams.params;

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to update settings
    requirePermission(context, 'settings', 'update');

    const organizationId = context.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    const body = (await request.json()) as Partial<UpdateCurrencyInput>;

    // Find currency by code
    const existingCurrency = await findCurrencyByCode(code, organizationId);
    if (!existingCurrency) {
      return NextResponse.json({ error: 'Currency not found' }, { status: 404 });
    }

    const input: UpdateCurrencyInput = {};
    if (body.code !== undefined) input.code = body.code;
    if (body.symbol !== undefined) input.symbol = body.symbol;
    if (body.exchangeRate !== undefined) input.exchangeRate = body.exchangeRate;
    if (body.isPrimary !== undefined) input.isPrimary = body.isPrimary;
    if (body.isActive !== undefined) input.isActive = body.isActive;

    try {
      const updatedCurrency = await updateCurrency(existingCurrency._id, input, organizationId);

      if (!updatedCurrency) {
        return NextResponse.json({ error: 'Failed to update currency' }, { status: 500 });
      }

      return NextResponse.json({
        message: 'Currency updated successfully',
        currency: {
          _id: updatedCurrency._id,
          organizationId: updatedCurrency.organizationId,
          code: updatedCurrency.code,
          symbol: updatedCurrency.symbol,
          exchangeRate: updatedCurrency.exchangeRate,
          rateTimestamp: updatedCurrency.rateTimestamp?.toISOString() || null,
          isPrimary: updatedCurrency.isPrimary,
          isActive: updatedCurrency.isActive,
          createdAt: updatedCurrency.createdAt.toISOString(),
          updatedAt: updatedCurrency.updatedAt.toISOString(),
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('must be 3 uppercase letters')) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
      }
      throw error;
    }
  } catch (error) {
    console.error('Update currency error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
    }
    return NextResponse.json(
      { error: 'Unexpected error while updating currency' },
      { status: 500 },
    );
  }
}
