import { NextResponse } from 'next/server';
import { getAuthContextFromCookies, getCurrentUserFromCookies } from '@/lib/auth/session';
import { findTenantByPhone } from '@/lib/tenants/tenants';
import { findInvoiceById } from '@/lib/invoices/invoices';
import { PaymentIntentService } from '@/modules/payments/payment-intent-service';
import type { PaymentProvider } from '@/modules/payments/payment-intent';

export async function POST(request: Request) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user is a tenant
    if (!context.roles.includes('TENANT')) {
      return NextResponse.json({ error: 'Forbidden: Tenant access required' }, { status: 403 });
    }

    // Validate organization context
    const organizationId = context.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    // Get user to find tenant
    const user = await getCurrentUserFromCookies();
    if (!user || !user.phone) {
      return NextResponse.json(
        { error: 'User not found or phone number missing' },
        { status: 404 },
      );
    }

    // Find tenant by phone
    const tenant = await findTenantByPhone(user.phone, organizationId);
    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found. Please contact your building manager.' },
        { status: 404 },
      );
    }

    // Validate tenant belongs to organization
    if (tenant.organizationId !== organizationId) {
      return NextResponse.json(
        { error: 'Access denied: Tenant does not belong to your organization' },
        { status: 403 },
      );
    }

    const body = (await request.json()) as {
      invoiceId?: string;
      amount: number;
      provider: string;
    };

    // Validate required fields
    if (!body.amount || body.amount <= 0) {
      return NextResponse.json(
        { error: 'Amount is required and must be greater than zero' },
        { status: 400 },
      );
    }

    if (!body.provider) {
      return NextResponse.json({ error: 'Payment provider is required' }, { status: 400 });
    }

    // Validate provider
    const validProviders: PaymentProvider[] = [
      'telebirr',
      'cbe_birr',
      'chapa',
      'hellocash',
      'bank_transfer',
    ];
    if (!validProviders.includes(body.provider as PaymentProvider)) {
      return NextResponse.json(
        { error: `Invalid payment provider. Must be one of: ${validProviders.join(', ')}` },
        { status: 400 },
      );
    }

    // If invoiceId is provided, validate tenant owns the invoice
    if (body.invoiceId) {
      const invoice = await findInvoiceById(body.invoiceId, organizationId);
      if (!invoice) {
        return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
      }
      if (invoice.tenantId !== tenant._id.toString()) {
        return NextResponse.json(
          { error: 'Access denied: Invoice does not belong to you' },
          { status: 403 },
        );
      }
      if (invoice.organizationId !== organizationId) {
        return NextResponse.json(
          { error: 'Access denied: Invoice does not belong to your organization' },
          { status: 403 },
        );
      }
    }

    // Create and initiate payment intent
    const { intent, result } = await PaymentIntentService.createAndInitiatePayment({
      invoiceId: body.invoiceId ?? null,
      tenantId: tenant._id.toString(),
      organizationId,
      amount: body.amount,
      currency: 'ETB',
      provider: body.provider as PaymentProvider,
    });

    return NextResponse.json({
      intentId: intent._id,
      status: intent.status,
      redirectUrl: result.redirectUrl,
      paymentInstructions: result.paymentInstructions,
      referenceNumber: result.referenceNumber,
    });
  } catch (error) {
    console.error('Create payment intent error:', error);

    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.message.includes('does not belong') || error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('amount') || error.message.includes('provider')) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      if (error.message.includes('not enabled')) {
        return NextResponse.json({ error: error.message }, { status: 503 });
      }
    }

    return NextResponse.json(
      { error: 'Failed to create payment intent. Please try again later.' },
      { status: 500 },
    );
  }
}
