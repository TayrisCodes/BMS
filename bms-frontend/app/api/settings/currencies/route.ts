import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import {
  createCurrency,
  listCurrencies,
  type CreateCurrencyInput,
} from '@/lib/currencies/currencies';

/**
 * GET /api/settings/currencies
 * List currencies for the organization.
 * Requires settings.read permission.
 */
export async function GET(request: Request) {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to read settings
    requirePermission(context, 'settings', 'read');

    const organizationId = context.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('activeOnly') === 'true';

    const currencies = await listCurrencies(organizationId, activeOnly);

    return NextResponse.json({
      currencies: currencies.map((currency) => ({
        _id: currency._id,
        organizationId: currency.organizationId,
        code: currency.code,
        symbol: currency.symbol,
        exchangeRate: currency.exchangeRate,
        rateTimestamp: currency.rateTimestamp?.toISOString() || null,
        isPrimary: currency.isPrimary,
        isActive: currency.isActive,
        createdAt: currency.createdAt.toISOString(),
        updatedAt: currency.updatedAt.toISOString(),
      })),
      count: currencies.length,
    });
  } catch (error) {
    console.error('Get currencies error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
    }
    return NextResponse.json(
      { error: 'Unexpected error while fetching currencies' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/settings/currencies
 * Create a new currency.
 * Requires settings.update permission.
 */
export async function POST(request: Request) {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to update settings
    requirePermission(context, 'settings', 'update');

    const organizationId = context.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    const body = (await request.json()) as Partial<CreateCurrencyInput>;

    // Validate required fields
    if (!body.code || !body.symbol) {
      return NextResponse.json(
        {
          error: 'code and symbol are required',
        },
        { status: 400 },
      );
    }

    // Create currency
    const input: CreateCurrencyInput = {
      organizationId,
      code: body.code,
      symbol: body.symbol,
      exchangeRate: body.exchangeRate ?? null,
      isPrimary: body.isPrimary ?? false,
      isActive: body.isActive ?? true,
    };

    try {
      const currency = await createCurrency(input);

      return NextResponse.json(
        {
          message: 'Currency created successfully',
          currency: {
            _id: currency._id,
            organizationId: currency.organizationId,
            code: currency.code,
            symbol: currency.symbol,
            exchangeRate: currency.exchangeRate,
            rateTimestamp: currency.rateTimestamp?.toISOString() || null,
            isPrimary: currency.isPrimary,
            isActive: currency.isActive,
            createdAt: currency.createdAt.toISOString(),
            updatedAt: currency.updatedAt.toISOString(),
          },
        },
        { status: 201 },
      );
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('must be 3 uppercase letters')) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
        if (error.message.includes('already exists')) {
          return NextResponse.json({ error: error.message }, { status: 409 });
        }
      }
      throw error;
    }
  } catch (error) {
    console.error('Create currency error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
    }
    return NextResponse.json(
      { error: 'Unexpected error while creating currency' },
      { status: 500 },
    );
  }
}

